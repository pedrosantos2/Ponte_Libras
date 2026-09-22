"""
Lógica de reconhecimento CONTÍNUO: transforma a sequência de frames da webcam
em glossas, com filtros contra falsos positivos.

Separado do tradutor_final.py para que a MESMA lógica rode na webcam e nos
testes automatizados (testar_tradutor.py).

Tudo aqui é medido em TEMPO, não em número de frames: o modelo foi treinado
com vídeos a 30 FPS (janela de 30 frames = 1 segundo), mas a webcam roda no
FPS que a máquina aguentar. A janela é sempre o último 1 segundo, reamostrado
para FRAME_COUNT frames — o sinal chega à rede na mesma escala de tempo do
treino, seja a 10 ou a 30 FPS.
"""
import numpy as np
import tensorflow as tf

from config import (
    FRAME_COUNT, HAND_SIZE, THRESHOLD, CLASSE_NEGATIVA, glossa_de, normalizar_sequencia,
)

FPS_TREINO = 30.0
JANELA_S = FRAME_COUNT / FPS_TREINO   # duração da janela vista no treino


class ReconhecedorContinuo:
    """Recebe um frame de coordenadas por vez e devolve a glossa quando
    (e só quando) há convicção suficiente.

    Filtros (os parâmetros em frames são convertidos para tempo a 30 FPS):
    - min_frames_com_mao: só prevê se boa parte da janela tiver mão detectada
      (a rede SEMPRE responde algo quando a janela enche, até com você parado)
    - threshold: confiança mínima da softmax
    - estabilidade: a mesma classe precisa vencer por esse tempo seguido
      (janelas de transição disparam classes erradas por instantes)
    - silencio: após aceitar uma glossa, ignora esse tempo — o movimento de
      RETORNO da mão ao descanso não deve ser lido como um sinal novo
    - veto_outro: silêncio se a rede der probabilidade razoável à classe OUTRO
    """

    def __init__(self, model, actions, threshold=THRESHOLD,
                 estabilidade=8, min_frames_com_mao=15, silencio=15,
                 veto_outro=0.2):
        self.model = model
        # tf.function evita o overhead do model.predict() a cada frame
        self._inferir = tf.function(lambda x: model(x, training=False),
                                    reduce_retracing=True)
        self.actions = actions
        self.threshold = threshold
        self.estabilidade = estabilidade
        self.estabilidade_s = estabilidade / FPS_TREINO
        self.min_frames_com_mao = min_frames_com_mao
        self.silencio_s = silencio / FPS_TREINO
        self.veto_outro = veto_outro
        self.idx_outro = actions.index(CLASSE_NEGATIVA) if CLASSE_NEGATIVA in actions else None
        self.limpar()

    def limpar(self):
        self.buffer = []            # [(t, coords)]
        self.glossas = []
        self.last_prediction = ""
        self.candidata = ""
        self.t_candidata = 0.0
        self.votos = 0              # progresso da estabilidade (para o HUD)
        self.conf_atual = 0.0
        self.silencio_ate = -1.0
        self._n = 0

    def _resetar_candidata(self):
        self.candidata, self.votos = "", 0

    def _janela(self, t):
        """Último JANELA_S segundos, reamostrado para FRAME_COUNT frames
        (vizinho mais próximo no tempo — interpolar misturaria frames com e
        sem mão detectada)."""
        tempos = np.array([b[0] for b in self.buffer])
        alvos = np.linspace(t - JANELA_S, t, FRAME_COUNT, endpoint=False) + JANELA_S / FRAME_COUNT
        idx = np.abs(tempos[None, :] - alvos[:, None]).argmin(axis=1)
        return np.array([self.buffer[i][1] for i in idx])

    def processar(self, coords, t=None):
        """Processa um frame (vetor de COORD_SIZE) capturado no instante t
        (segundos). Sem t, assume 30 FPS. Devolve a glossa aceita, ou None."""
        if t is None:
            t = self._n / FPS_TREINO
        self._n += 1

        self.buffer.append((t, np.asarray(coords, dtype=float)))
        # guarda um pouco mais que a janela para a reamostragem ter borda
        while self.buffer and self.buffer[0][0] < t - JANELA_S - 0.2:
            self.buffer.pop(0)

        if t - self.buffer[0][0] < JANELA_S * 0.9:
            return None   # ainda não há 1 segundo de histórico

        janela = self._janela(t)
        if int(janela[:, :HAND_SIZE].any(axis=1).sum()) < self.min_frames_com_mao:
            # Mãos fora da tela: zera o estado (permite repetir o mesmo
            # sinal depois e evita prever com a janela "vazia")
            self._resetar_candidata()
            self.conf_atual = 0.0
            self.last_prediction = ""
            return None

        if t < self.silencio_ate:
            self._resetar_candidata()
            return None

        normalizada = normalizar_sequencia(janela)
        if normalizada is None:
            # Corpo não detectado na janela: sem referência de locação
            self._resetar_candidata()
            return None
        entrada = np.expand_dims(normalizada, axis=0).astype(np.float32)
        res = self._inferir(tf.constant(entrada)).numpy()[0]
        idx = int(np.argmax(res))
        self.conf_atual = float(res[idx])

        if self.conf_atual <= self.threshold:
            self._resetar_candidata()
            return None

        # variantes do mesmo sinal (ex.: OI e OI_ACENO) valem como a mesma glossa
        pred = glossa_de(self.actions[idx])
        if pred == CLASSE_NEGATIVA or (
                self.idx_outro is not None
                and float(res[self.idx_outro]) > self.veto_outro):
            # "Não é nenhum sinal que eu conheço": silêncio, sem glossa
            self._resetar_candidata()
            return None

        if pred != self.candidata:
            self.candidata, self.t_candidata = pred, t
        decorrido = t - self.t_candidata
        self.votos = min(self.estabilidade, int(decorrido * FPS_TREINO) + 1)

        if decorrido >= self.estabilidade_s and self.candidata != self.last_prediction:
            self.glossas.append(self.candidata)
            self.last_prediction = self.candidata
            self.silencio_ate = t + self.silencio_s
            return self.candidata
        return None
