"""
Coletor de exemplos pela webcam.

Cada gravação é um clipe de 4 segundos guiado na tela:
  0–1 s  abaixe as mãos
  1–3 s  faça o sinal
  3–4 s  abaixe as mãos de novo
O clipe é reamostrado para 30 FPS pelo relógio (a webcam roda no FPS que a
máquina aguentar) e o clipe inteiro é guardado em DATA_V2/_clipes, para poder
ser recortado de novo no futuro. Dele saem os exemplos de treino:
  - o SINAL é achado pelo movimento, não pelo relógio: o segundo com mais
    movimento dentro da fase do sinal, mais duas cópias deslocadas 0,2 s;
  - o começo e o fim viram exemplos de OUTRO, mas só se forem repouso de
    verdade (mão parada perto do rosto parece um sinal e confundiria o modelo);
  - gravando a própria classe OUTRO, os 4 segundos viram 4 exemplos.

Os arquivos levam o nome de quem gravou ('pessoa-<nome>_...'), para a
validação cruzada tratar todas as gravações de uma pessoa como uma pessoa só.
"""
import re
import time
import unicodedata

import cv2
import numpy as np

from config import ACTIONS, CLASSE_NEGATIVA, DATA_PATH, FRAME_COUNT, HAND_SIZE, NUM_HANDS
from extracao import Extrator
from interface import TURQUESA, ALERTA, Interface

FPS_ALVO = 30
PREPARO_S = 1.5              # contagem antes de começar, fora do clipe
FASES = [(1.0, "Abaixe as mãos"), (3.0, "Faça o sinal agora"), (4.0, "Abaixe as mãos de novo")]
DURACAO_S = FASES[-1][0]
META_POR_SINAL = 10
MIN_QUADROS_COM_MAO = FRAME_COUNT // 2
# Onde procurar o sinal (s): a fase do sinal com uma folga para cada lado
BUSCA_SINAL = (0.7, 3.3)
DESLOCAMENTO = 6             # quadros (0,2 s) das cópias deslocadas
# Movimento mínimo numa janela de 1 s para contar como sinal. Calibrado nas
# primeiras gravações: fazendo o sinal, 40 a 69; mão parada, até ~18.
MOVIMENTO_MINIMO = 25.0
# Mão "no rosto": pulso até 0,8 ombro abaixo do nariz. Um trecho de repouso
# com a mão ali em mais de 40% dos quadros não vira exemplo de OUTRO.
ALTURA_ROSTO = 0.8
PASTA_CLIPES = DATA_PATH / "_clipes"
NOME_NA_TELA = {"OI_ACENO": "OI (aceno)", "OI": "OI (letras O e I)"}


def slug(texto):
    sem_acento = unicodedata.normalize("NFD", texto.lower())
    sem_acento = "".join(c for c in sem_acento if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", sem_acento).strip("-")


def reamostrar(tempos, quadros, fps=FPS_ALVO, duracao=DURACAO_S):
    """Quadros capturados em FPS irregular -> um quadro a cada 1/fps segundo
    (vizinho mais próximo no tempo, como no reconhecedor)."""
    tempos = np.asarray(tempos)
    alvos = np.arange(int(round(duracao * fps))) / fps
    idx = np.abs(tempos[None, :] - alvos[:, None]).argmin(axis=1)
    return np.array([quadros[i] for i in idx])


def arquivos_da_pessoa(sinal, pessoa):
    """Clipes gravados por esta pessoa para este sinal."""
    pasta = PASTA_CLIPES / sinal
    return sorted(pasta.glob(f"pessoa-{pessoa}_*.npy")) if pasta.exists() else []


def _referencia(clipe):
    corpo = clipe[:, HAND_SIZE:]
    ok = corpo[:, 2] > 0
    if not ok.any():
        return None
    return np.median(corpo[ok, 1]), np.median(corpo[ok, 2])


def movimento(clipe):
    """Movimento das mãos de um quadro para o próximo, em larguras de ombro."""
    _, ombros = _referencia(clipe)
    e = np.zeros(len(clipe))
    for t in range(1, len(clipe)):
        for h in range(NUM_HANDS):
            a = clipe[t - 1, h * 63:(h + 1) * 63]
            b = clipe[t, h * 63:(h + 1) * 63]
            if a.any() and b.any():
                e[t] += np.abs(b.reshape(21, 3)[:, :2] - a.reshape(21, 3)[:, :2]).sum() / ombros
    return e


def mao_no_rosto(janela, nariz_y, ombros):
    """Fração dos quadros com alguma mão na altura do rosto."""
    n = 0
    for q in janela:
        for h in range(NUM_HANDS):
            m = q[h * 63:(h + 1) * 63]
            if m.any() and (m[1] - nariz_y) / ombros < ALTURA_ROSTO:
                n += 1
                break
    return n / len(janela)


def recortar(sinal, clipe):
    """Clipe -> (janelas do sinal, janelas de OUTRO, aviso, erro)."""
    ref = _referencia(clipe)
    if ref is None:
        return [], [], "", "O corpo não foi detectado. Fique de frente para a câmera."
    nariz_y, ombros = ref
    F = FRAME_COUNT

    if sinal == CLASSE_NEGATIVA:
        return [], [clipe[i:i + F] for i in range(0, len(clipe) - F + 1, F)], "", ""

    e = movimento(clipe)
    ini, fim = int(BUSCA_SINAL[0] * FPS_ALVO), int(BUSCA_SINAL[1] * FPS_ALVO)
    somas = [(e[i:i + F].sum(), i) for i in range(ini, fim - F + 1)]
    melhor, inicio = max(somas)
    janela = clipe[inicio:inicio + F]
    if melhor < MOVIMENTO_MINIMO:
        return [], [], "", "Não vi o movimento do sinal. Grave de novo, durante a fase do sinal."
    if int(janela[:, :HAND_SIZE].any(axis=1).sum()) < MIN_QUADROS_COM_MAO:
        return [], [], "", "As mãos quase não apareceram no sinal. Grave de novo."
    do_sinal = [clipe[i:i + F] for i in (inicio - DESLOCAMENTO, inicio, inicio + DESLOCAMENTO)
                if 0 <= i and i + F <= len(clipe)]

    outro, aviso = [], ""
    for trecho in (clipe[:F], clipe[-F:]):
        if mao_no_rosto(trecho, nariz_y, ombros) > 0.4:
            aviso = "Sinal salvo. Dica: abaixe as mãos no começo e no fim."
        else:
            outro.append(trecho)
    return do_sinal, outro, aviso, ""


def salvar(sinal, pessoa, clipe):
    """Recorta o clipe e salva. Devolve (arquivos, aviso, erro)."""
    do_sinal, outro, aviso, erro = recortar(sinal, clipe)
    if erro:
        return [], "", erro
    n = len(arquivos_da_pessoa(sinal, pessoa)) + 1
    base = f"pessoa-{pessoa}_{n:02d}_{slug(sinal)}_{int(time.time())}"
    salvos = []
    (PASTA_CLIPES / sinal).mkdir(parents=True, exist_ok=True)
    caminho = PASTA_CLIPES / sinal / f"{base}.npy"
    np.save(caminho, clipe)
    salvos.append(caminho)
    for i, janela in enumerate(do_sinal):
        (DATA_PATH / sinal).mkdir(parents=True, exist_ok=True)
        caminho = DATA_PATH / sinal / f"{base}_j{i}.npy"
        np.save(caminho, janela)
        salvos.append(caminho)
    for i, janela in enumerate(outro):
        (DATA_PATH / CLASSE_NEGATIVA).mkdir(parents=True, exist_ok=True)
        caminho = DATA_PATH / CLASSE_NEGATIVA / f"trans{i}_{base}.npy"
        np.save(caminho, janela)
        salvos.append(caminho)
    return salvos, aviso, ""


def main():
    pessoa = ""
    while not pessoa:
        pessoa = slug(input("Seu nome ou apelido (identifica quem gravou): "))
    print(f"\nGravando como: {pessoa}")
    print("Espaço: gravar | N/P: próximo/anterior sinal | Z: desfazer a última | Q: sair\n")

    extrator = Extrator(modo_video=True, conf_mao=0.7, pose_cada=2)
    interface = Interface()
    cap = cv2.VideoCapture(0)
    cv2.namedWindow("Ponte Libras - Coletor", cv2.WINDOW_NORMAL)

    idx = 0
    estado = "livre"             # livre | preparo | gravando
    t_estado = 0.0
    tempos, quadros = [], []
    ultimos = []                 # arquivos da última gravação (para desfazer)
    mensagem, cor_msg = "", TURQUESA
    t0 = time.monotonic()

    while cap.isOpened():
        ok, imagem = cap.read()
        if not ok:
            break
        agora = time.monotonic() - t0
        coords, maos = extrator.extrair(imagem, int(agora * 1000))
        imagem = cv2.flip(imagem, 1)
        interface.desenhar_maos(imagem, maos)
        sinal = ACTIONS[idx]

        fase, progresso = "", 0.0
        if estado == "preparo":
            falta = PREPARO_S - (agora - t_estado)
            fase = f"Prepare-se: {falta:.1f} s"
            if falta <= 0:
                estado, t_estado, tempos, quadros = "gravando", agora, [], []
        elif estado == "gravando":
            dt = agora - t_estado
            tempos.append(dt)
            quadros.append(coords)
            fase = next(nome for limite, nome in FASES if dt < limite) if dt < DURACAO_S else FASES[-1][1]
            progresso = dt / DURACAO_S
            if dt >= DURACAO_S:
                salvos, aviso, erro = salvar(sinal, pessoa, reamostrar(tempos, quadros))
                if erro:
                    mensagem, cor_msg = erro, ALERTA
                else:
                    ultimos = salvos
                    mensagem, cor_msg = (aviso, ALERTA) if aviso else ("Gravação salva.", TURQUESA)
                    print(f"✅ {sinal}: {salvos[0].name} ({len(salvos) - 1} exemplos)")
                estado = "livre"

        gravados = len(arquivos_da_pessoa(sinal, pessoa))
        interface.desenhar_coleta(imagem, NOME_NA_TELA.get(sinal, sinal), pessoa, gravados, META_POR_SINAL,
                                  fase, progresso, mensagem, cor_msg)
        cv2.imshow("Ponte Libras - Coletor", imagem)

        tecla = cv2.waitKey(1) & 0xFF
        if tecla == ord("q"):
            break
        if estado != "livre":
            continue      # durante a gravação, só Q funciona
        if tecla in (ord(" "), ord("s")):
            estado, t_estado, mensagem = "preparo", agora, ""
        elif tecla == ord("n"):
            idx, mensagem = (idx + 1) % len(ACTIONS), ""
        elif tecla == ord("p"):
            idx, mensagem = (idx - 1) % len(ACTIONS), ""
        elif ord("1") <= tecla <= ord("9") and tecla - ord("1") < len(ACTIONS):
            idx, mensagem = tecla - ord("1"), ""
        elif tecla == ord("z"):
            if ultimos:
                for caminho in ultimos:
                    caminho.unlink(missing_ok=True)
                mensagem, cor_msg, ultimos = "Última gravação apagada.", TURQUESA, []
            else:
                mensagem, cor_msg = "Nada para desfazer.", ALERTA

    cap.release()
    extrator.close()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
