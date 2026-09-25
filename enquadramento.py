"""
Simula a pessoa sentada perto da webcam de um notebook.

Os vídeos de treino mostram gente em pé, enquadrada até a cintura: a mão em
repouso aparece o tempo todo. Sentado perto do notebook, a câmera corta na
altura do peito e essa mão (ou qualquer mão que desça) sai do quadro.

A simulação corta nas mesmas unidades que o modelo enxerga depois da
normalização: posição vertical em relação ao nariz, medida em larguras de
ombro. Em pé, a mão de repouso fica ~2,4 ombros abaixo do nariz; sentado
perto, o quadro corta por volta de 1,5.
"""
import numpy as np

from config import HAND_SIZE, NUM_HANDS

_PONTOS_POR_MAO = 21 * 3
CORTE_SENTADO = 1.5          # usado na avaliação
FAIXA_CORTE = (1.1, 2.2)     # sorteado no treino


def simular_sentado(seq, corte=CORTE_SENTADO):
    """Sequência crua (FRAME_COUNT, COORD_SIZE) -> a mesma sequência como a
    webcam veria com a pessoa sentada: a mão cujo pulso está abaixo do corte
    some naquele quadro (fica zerada, como quando o MediaPipe não a detecta)."""
    seq = np.array(seq, dtype=float, copy=True)
    corpo = seq[:, HAND_SIZE:]
    validos = corpo[:, 2] > 0
    if not validos.any():
        return seq
    nariz_y = np.median(corpo[validos, 1])
    ombros = np.median(corpo[validos, 2])
    limite = nariz_y + corte * ombros
    for h in range(NUM_HANDS):
        bloco = seq[:, h * _PONTOS_POR_MAO:(h + 1) * _PONTOS_POR_MAO]
        presente = bloco.any(axis=1)
        pulso_y = bloco[:, 1]
        bloco[presente & (pulso_y > limite)] = 0
    return seq
