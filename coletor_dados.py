"""
Coletor de exemplos pela webcam.

Cada gravação é um clipe de 3,2 segundos guiado na tela:
  0,0–1,0 s  mãos em repouso
  1,0–2,2 s  faça o sinal
  2,2–3,2 s  volte ao repouso
O clipe é reamostrado para 30 FPS pelo relógio (a webcam roda no FPS que a
máquina aguentar) e vira três exemplos, como os vídeos de treino:
  - o segundo central, com o sinal, na pasta do sinal;
  - o começo e o fim, com a mão subindo e descendo, na pasta OUTRO.

Os arquivos levam o nome de quem gravou ('pessoa-<nome>_...'), para a
validação cruzada tratar todas as gravações de uma pessoa como uma pessoa só.
"""
import re
import time
import unicodedata

import cv2
import numpy as np

from config import ACTIONS, CLASSE_NEGATIVA, DATA_PATH, FRAME_COUNT, HAND_SIZE
from extracao import Extrator
from interface import TURQUESA, ALERTA, Interface

FPS_ALVO = 30
PREPARO_S = 1.5              # contagem antes de começar, fora do clipe
FASES = [(1.0, "Mãos em repouso"), (2.2, "Faça o sinal agora"), (3.2, "Volte ao repouso")]
DURACAO_S = FASES[-1][0]
META_POR_SINAL = 10
MIN_QUADROS_COM_MAO = FRAME_COUNT // 2


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
    pasta = DATA_PATH / sinal
    return sorted(pasta.glob(f"pessoa-{pessoa}_*.npy")) if pasta.exists() else []


def salvar(sinal, pessoa, clipe):
    """Divide o clipe em miolo e transições e salva. Devolve (arquivos, erro)."""
    meio = len(clipe) // 2
    miolo = clipe[meio - FRAME_COUNT // 2: meio + FRAME_COUNT // 2]
    if int(miolo[:, :HAND_SIZE].any(axis=1).sum()) < MIN_QUADROS_COM_MAO:
        return [], "As mãos quase não apareceram no sinal. Grave de novo."
    if not (miolo[:, HAND_SIZE + 2] > 0).any():
        return [], "O corpo não foi detectado. Fique de frente para a câmera."
    n = len(arquivos_da_pessoa(sinal, pessoa)) + 1
    base = f"pessoa-{pessoa}_{n:02d}_{slug(sinal)}_{int(time.time())}"
    (DATA_PATH / sinal).mkdir(parents=True, exist_ok=True)
    (DATA_PATH / CLASSE_NEGATIVA).mkdir(parents=True, exist_ok=True)
    salvos = [DATA_PATH / sinal / f"{base}.npy"]
    np.save(salvos[0], miolo)
    for nome, janela in [("trans_ini", clipe[:FRAME_COUNT]), ("trans_fim", clipe[-FRAME_COUNT:])]:
        caminho = DATA_PATH / CLASSE_NEGATIVA / f"{nome}_{base}.npy"
        np.save(caminho, janela)
        salvos.append(caminho)
    return salvos, ""


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
                salvos, erro = salvar(sinal, pessoa, reamostrar(tempos, quadros))
                if erro:
                    mensagem, cor_msg = erro, ALERTA
                else:
                    ultimos = salvos
                    mensagem, cor_msg = "Gravação salva.", TURQUESA
                    print(f"✅ {sinal}: {salvos[0].name}")
                estado = "livre"

        gravados = len(arquivos_da_pessoa(sinal, pessoa))
        interface.desenhar_coleta(imagem, sinal, pessoa, gravados, META_POR_SINAL,
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
