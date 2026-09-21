"""
Tradução das glossas para português com o Gemma (Ollama), sem travar a câmera.

A chamada ao Gemma leva alguns segundos. Feita no loop principal, ela congela
a janela: a câmera, o reconhecimento e a tela param até a resposta chegar.
Aqui ela roda numa thread separada e o loop só consulta se a frase já chegou.
"""
import threading

import requests

from config import OLLAMA_MODEL, OLLAMA_URL

# Mantém o modelo carregado na memória entre traduções. Sem isso o Ollama o
# descarrega após 5 min parado e a próxima tradução volta a ser lenta.
MANTER_CARREGADO = "30m"


def chamar_gemma(glossas):
    if not glossas:
        return ""
    prompt = f"Converta estas glossas de LIBRAS para português fluído: {' '.join(glossas)}"
    try:
        payload = {"model": OLLAMA_MODEL, "prompt": prompt, "stream": False,
                   "keep_alive": MANTER_CARREGADO}
        response = requests.post(OLLAMA_URL, json=payload, timeout=90)
        return response.json().get('response', "Erro na resposta").strip()
    except Exception as e:
        return f"Erro: {e}"


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

    def __init__(self, traduzir=chamar_gemma):
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
        """Devolve a frase uma única vez, quando ela chega; senão, None."""
        if self._thread is None or self._thread.is_alive():
            return None
        self._thread = None
        if self._descartar:
            return None
        return self._resultado
