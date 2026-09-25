"""
Extração de coordenadas de UM frame — usada por todos os scripts (coletor,
processador de vídeos, importador do MALTA, tradutor e testes), para que o
treino e a webcam vejam exatamente a mesma representação.

Cada frame vira um vetor de COORD_SIZE = 129 números:
  [0:126]   2 mãos × 21 pontos × (x, y, z)        — MediaPipe Hand Landmarker
  [126:129] nariz_x, nariz_y, largura_dos_ombros  — MediaPipe Pose Landmarker

A referência do corpo é o que permite ao modelo saber ONDE a mão está em
relação ao rosto (boca, testa, peito) — o parâmetro de LOCAÇÃO do sinal.
"""
import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

from config import (
    COORD_SIZE, HAND_SIZE, NUM_HANDS,
    ensure_hand_landmarker, ensure_pose_landmarker,
)

LARGURA_DETECCAO = 640   # a detecção roda numa cópia reduzida (mais rápido)
NARIZ, OMBRO_E, OMBRO_D = 0, 11, 12


class Extrator:
    def __init__(self, modo_video=False, conf_mao=0.5, pose_cada=1):
        """modo_video: rastreia as mãos entre frames (webcam/vídeo contínuo).
        pose_cada: roda a pose a cada N frames e reaproveita no intervalo
        (o tronco quase não se move; economiza ~30 ms por frame)."""
        self.modo_video = modo_video
        self.pose_cada = max(1, pose_cada)
        self._n = 0
        self._corpo = np.zeros(3)

        self.maos = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=ensure_hand_landmarker()),
            running_mode=vision.RunningMode.VIDEO if modo_video else vision.RunningMode.IMAGE,
            num_hands=NUM_HANDS,
            min_hand_detection_confidence=conf_mao,
            min_hand_presence_confidence=conf_mao,
            min_tracking_confidence=0.5,
        ))
        self.pose = vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=ensure_pose_landmarker()),
            running_mode=vision.RunningMode.IMAGE,
        ))

    def extrair(self, frame_bgr, t_ms=None):
        """Frame BGR (OpenCV) -> (coords[129], mãos detectadas para desenhar)."""
        return self.extrair_rgb(cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB), t_ms)

    def extrair_rgb(self, rgb, t_ms=None):
        h, w = rgb.shape[:2]
        if w > LARGURA_DETECCAO:
            rgb = cv2.resize(rgb, (LARGURA_DETECCAO, int(h * LARGURA_DETECCAO / w)))
        imagem = mp.Image(image_format=mp.ImageFormat.SRGB,
                          data=np.ascontiguousarray(rgb, dtype=np.uint8))

        if self.modo_video:
            res = self.maos.detect_for_video(imagem, int(t_ms))
        else:
            res = self.maos.detect(imagem)

        coords = np.zeros(COORD_SIZE)
        if res.hand_landmarks:
            pts = []
            for mao in res.hand_landmarks[:NUM_HANDS]:
                for lm in mao:
                    pts.extend([lm.x, lm.y, lm.z])
            coords[:len(pts)] = pts

        if self._n % self.pose_cada == 0:
            rp = self.pose.detect(imagem)
            if rp.pose_landmarks:
                lm = rp.pose_landmarks[0]
                ombros = float(np.hypot(lm[OMBRO_E].x - lm[OMBRO_D].x,
                                        lm[OMBRO_E].y - lm[OMBRO_D].y))
                self._corpo = np.array([lm[NARIZ].x, lm[NARIZ].y, ombros])
            else:
                self._corpo = np.zeros(3)
        self._n += 1
        coords[HAND_SIZE:] = self._corpo

        return coords, (res.hand_landmarks or [])

    def close(self):
        self.maos.close()
        self.pose.close()
