"""
Lógica de reconhecimento CONTÍNUO: transforma a sequência de frames da webcam
em glossas, com filtros contra falsos positivos.

Separado do tradutor_final.py para que a MESMA lógica rode na webcam e nos
testes automatizados (testar_tradutor.py).
"""
import numpy as np

from config import (
    FRAME_COUNT, THRESHOLD, CLASSE_NEGATIVA, normalizar_sequencia,
)


class ReconhecedorContinuo:
    """Recebe um frame de coordenadas por vez e devolve a glossa quando
    (e só quando) há convicção suficiente.

    Filtros:
    - min_frames_com_mao: só prevê se boa parte da janela tiver mão detectada
      (a rede SEMPRE responde algo quando a janela enche, até com você parado)
    - threshold: confiança mínima da softmax
    - estabilidade: a mesma classe precisa vencer por N frames seguidos
      (janelas de transição disparam classes erradas por 1-2 frames)
    """

    def __init__(self, model, actions, threshold=THRESHOLD,
                 estabilidade=8, min_frames_com_mao=15, silencio=15,
                 veto_outro=0.2):
        self.model = model
        self.actions = actions
        self.threshold = threshold
        self.estabilidade = estabilidade
        self.min_frames_com_mao = min_frames_com_mao
        # Após aceitar uma glossa, ignora N frames: o movimento de RETORNO
        # da mão ao descanso não deve ser lido como um sinal novo
        self.silencio = silencio
        # Veto da classe OUTRO: mesmo quando outra classe vence, se a rede
        # dá probabilidade razoável a "não é nenhum sinal que conheço",
        # é melhor ficar em silêncio do que chutar
        self.veto_outro = veto_outro
        self.idx_outro = actions.index(CLASSE_NEGATIVA) if CLASSE_NEGATIVA in actions else None
        self.limpar()

    def limpar(self):
        self.sequence = []
        self.glossas = []
        self.last_prediction = ""
        self.candidata = ""
        self.votos = 0
        self.conf_atual = 0.0
        self.frames_em_silencio = 0

    def processar(self, coords):
        """Processa um frame (vetor de COORD_SIZE). Devolve a glossa aceita
        neste frame, ou None."""
        self.sequence.append(coords)
        self.sequence = self.sequence[-FRAME_COUNT:]
        frames_com_mao = sum(1 for c in self.sequence if np.any(c))

        if frames_com_mao < self.min_frames_com_mao:
            # Mãos fora da tela: zera o estado (permite repetir o mesmo
            # sinal depois e evita prever com a janela "vazia")
            self.candidata, self.votos, self.conf_atual = "", 0, 0.0
            self.last_prediction = ""
            return None

        if len(self.sequence) < FRAME_COUNT:
            return None

        if self.frames_em_silencio > 0:
            self.frames_em_silencio -= 1
            self.candidata, self.votos = "", 0
            return None

        entrada = np.expand_dims(normalizar_sequencia(np.array(self.sequence)), axis=0)
        res = self.model.predict(entrada, verbose=0)[0]
        idx = int(np.argmax(res))
        self.conf_atual = float(res[idx])

        if self.conf_atual <= self.threshold:
            self.candidata, self.votos = "", 0
            return None

        pred = self.actions[idx]
        if pred == CLASSE_NEGATIVA or (
                self.idx_outro is not None
                and float(res[self.idx_outro]) > self.veto_outro):
            # "Não é nenhum sinal que eu conheço": silêncio, sem glossa
            self.candidata, self.votos = "", 0
            return None

        if pred == self.candidata:
            self.votos += 1
        else:
            self.candidata, self.votos = pred, 1

        if self.votos == self.estabilidade and self.candidata != self.last_prediction:
            self.glossas.append(self.candidata)
            self.last_prediction = self.candidata
            self.frames_em_silencio = self.silencio
            return self.candidata
        return None
