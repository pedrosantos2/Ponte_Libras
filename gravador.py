"""
Grava em MP4 exatamente o que a janela do tradutor mostra, em tempo real.

O loop do tradutor roda no FPS que a máquina aguenta (10 a 20 num notebook
comum), mas um arquivo de vídeo precisa de FPS fixo. Se cada quadro fosse
escrito uma vez só, o vídeo sairia acelerado. Por isso o arquivo é gravado a
30 FPS e o quadro atual é repetido quantas vezes for preciso para o tempo do
vídeo acompanhar o relógio.
"""
import time
from datetime import datetime
from pathlib import Path

import cv2

PASTA_GRAVACOES = Path("gravacoes")


class Gravador:
    FPS = 30

    def __init__(self, pasta=PASTA_GRAVACOES):
        self.pasta = Path(pasta)
        self._writer = None
        self.caminho = None

    @property
    def gravando(self):
        return self._writer is not None

    @property
    def duracao(self):
        return time.monotonic() - self._t0 if self.gravando else 0.0

    def iniciar(self, largura, altura):
        self.pasta.mkdir(parents=True, exist_ok=True)
        self.caminho = self.pasta / f"ponte-libras-{datetime.now():%Y%m%d-%H%M%S}.mp4"
        # mp4v é o codec que o OpenCV grava de forma confiável em qualquer
        # sistema; para publicar na web o arquivo é convertido depois (H.264)
        self._writer = cv2.VideoWriter(str(self.caminho), cv2.VideoWriter_fourcc(*"mp4v"),
                                       self.FPS, (largura, altura))
        if not self._writer.isOpened():
            self._writer = None
            raise RuntimeError(f"Não foi possível criar {self.caminho}")
        self._t0 = time.monotonic()
        self._escritos = 0

    def escrever(self, quadro):
        """Escreve o quadro, repetido até o vídeo alcançar o tempo real."""
        if not self.gravando:
            return
        alvo = int(self.duracao * self.FPS) + 1
        while self._escritos < alvo:
            self._writer.write(quadro)
            self._escritos += 1

    def parar(self):
        """Fecha o arquivo e devolve (caminho, duração em segundos)."""
        if not self.gravando:
            return None, 0.0
        duracao = self._escritos / self.FPS
        self._writer.release()
        self._writer = None
        return self.caminho, duracao

