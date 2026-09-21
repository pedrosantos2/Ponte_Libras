"""
Tradução das glossas para português com o Gemma (Ollama), sem travar a câmera.

A chamada ao Gemma leva alguns segundos. Feita no loop principal, ela congela
a janela: a câmera, o reconhecimento e a tela param até a resposta chegar.
Aqui ela roda numa thread separada e o loop só consulta se a frase já chegou.

Antes de mostrar a frase, ela é conferida com os sinais (ver `verificar`):
um modelo de linguagem às vezes troca, apaga ou inverte o que foi sinalizado,
e um tradutor que diz outra coisa é pior do que não traduzir.
"""
import re
import threading
import unicodedata
from dataclasses import dataclass

import requests

from config import ACTIONS, CLASSE_NEGATIVA, OLLAMA_MODEL, OLLAMA_URL

# Mantém o modelo carregado na memória entre traduções. Sem isso o Ollama o
# descarrega após 5 min parado e a próxima tradução volta a ser lenta.
MANTER_CARREGADO = "30m"


def montar_prompt(glossas, reforco=False):
    prompt = f"Converta estas glossas de LIBRAS para português fluído: {' '.join(glossas)}"
    if reforco:
        prompt += (f". A frase precisa conter todas estas palavras, com o mesmo sentido: "
                   f"{', '.join(glossas)}. Não acrescente negação nem outras ideias.")
    return prompt


def chamar_gemma(glossas, reforco=False, modelo=OLLAMA_MODEL):
    if not glossas:
        return ""
    prompt = montar_prompt(glossas, reforco)
    try:
        payload = {"model": modelo, "prompt": prompt, "stream": False,
                   "keep_alive": MANTER_CARREGADO}
        response = requests.post(OLLAMA_URL, json=payload, timeout=90)
        return response.json().get('response', "Erro na resposta").strip()
    except Exception as e:
        return f"Erro: {e}"


# ---------- verificação da frase ----------

# Formas aceitas para cada glossa, quando o radical da própria palavra não
# basta. Para as demais (inclusive sinais que forem adicionados depois), vale
# o radical automático de `_radicais`.
FORMAS = {
    "OI": ["oi", "ola"],
    "BOM": ["bom", "boa", "bons", "boas"],
    "GOSTAR": ["gost"],
    "ACONTECER": ["aconte"],
    "AMARELO": ["amarel"],
    "NAO": ["nao"],
}

# Palavras que invertem o sentido: só podem aparecer se alguém sinalizou NÃO
NEGACOES = {"nao", "nunca", "nenhum", "nenhuma", "nem", "jamais", "ninguem"}


def _normalizar(texto):
    sem_acento = unicodedata.normalize("NFD", texto.lower())
    return "".join(c for c in sem_acento if unicodedata.category(c) != "Mn")


def _radicais(glossa):
    g = _normalizar(glossa)
    if g.upper() in FORMAS:
        return FORMAS[g.upper()]
    # radical automático: a palavra inteira ou, se for longa, sem as 2 últimas
    # letras (cobre gênero e número: amarelo/amarela, banana/bananas)
    return [g if len(g) <= 4 else g[:-2]]


def verificar(glossas, frase):
    """Confere se a frase diz o que foi sinalizado. Devolve a lista de
    problemas encontrados; lista vazia significa que a frase passou."""
    palavras = re.findall(r"[a-z]+", _normalizar(frase))
    problemas = []
    for g in glossas:
        if not any(p.startswith(r) for p in palavras for r in _radicais(g)):
            problemas.append(f"falta {g}")
    sinalizou_nao = any(_normalizar(g) == "nao" for g in glossas)
    if not sinalizou_nao and NEGACOES.intersection(palavras):
        problemas.append("negação que não foi sinalizada")
    # outro sinal do vocabulário que ninguém fez (ex.: "gosto" sem GOSTAR)
    feitos = {_normalizar(g).upper() for g in glossas}
    for sinal in ACTIONS:
        if sinal == CLASSE_NEGATIVA or _normalizar(sinal).upper() in feitos:
            continue
        if any(p.startswith(r) for p in palavras for r in _radicais(sinal)):
            problemas.append(f"acrescentou {sinal}")
    return problemas


@dataclass
class Traducao:
    glossas: list
    frase: str             # o que mostrar na tela
    confiavel: bool        # False: a frase não conferiu e a tela mostra as glossas
    erro: bool = False     # o Ollama não respondeu


def traduzir(glossas, chamar=chamar_gemma):
    """Pede a frase, confere e, se não conferir, tenta mais uma vez com um
    pedido mais explícito. Se ainda assim falhar, devolve as glossas."""
    glossas = list(glossas)
    for reforco in (False, True):
        frase = chamar(glossas, reforco=reforco)
        if frase.startswith("Erro"):
            return Traducao(glossas, frase, confiavel=False, erro=True)
        if not verificar(glossas, frase):
            return Traducao(glossas, frase, confiavel=True)
    return Traducao(glossas, " ".join(glossas), confiavel=False)


def pre_carregar():
    """Carrega o modelo na memória em segundo plano, ao abrir o tradutor, para
    a primeira tradução não pagar o tempo de carregamento (vários segundos)."""
    def carregar():
        try:
            requests.post(OLLAMA_URL, json={"model": OLLAMA_MODEL, "keep_alive": MANTER_CARREGADO},
                          timeout=120)
        except Exception:
            pass   # sem Ollama o tradutor continua funcionando; a tradução mostra o erro
    threading.Thread(target=carregar, daemon=True).start()


class TradutorEmSegundoPlano:
    """Uma tradução por vez, rodando fora do loop da câmera."""

    def __init__(self, traduzir=traduzir):
        self._traduzir = traduzir
        self._thread = None
        self._resultado = None
        self._descartar = False

    @property
    def ocupado(self):
        return self._thread is not None and self._thread.is_alive()

    def pedir(self, glossas):
        """Começa a traduzir e volta na hora. Ignora o pedido se já houver um."""
        if self.ocupado:
            return False
        glossas = list(glossas)
        self._resultado = None
        self._descartar = False

        def trabalho():
            self._resultado = self._traduzir(glossas)

        # daemon: fechar o tradutor não fica esperando uma resposta pendente
        self._thread = threading.Thread(target=trabalho, daemon=True)
        self._thread.start()
        return True

    def descartar(self):
        """A frase do pedido em andamento não deve mais aparecer (tecla C)."""
        self._descartar = True

    def frase_pronta(self):
        """Devolve a tradução uma única vez, quando ela chega; senão, None."""
        if self._thread is None or self._thread.is_alive():
            return None
        self._thread = None
        if self._descartar:
            return None
        return self._resultado
