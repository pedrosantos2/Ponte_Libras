import cv2
import mediapipe as mp
import numpy as np
import os
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

from config import (
    ACTIONS, DATA_PATH, VIDEOS_PATH, FRAME_COUNT, COORD_SIZE, NUM_HANDS,
    CLASSE_NEGATIVA, ensure_hand_landmarker,
)

# JANELAS DE TRANSIÇÃO: além do miolo do sinal, o começo e o fim do vídeo
# (pessoa parada, mão subindo / mão descendo) viram amostras da classe OUTRO.
# É o que a webcam vê ENTRE sinais — sem isso a rede nunca aprende a ficar
# em silêncio nessas janelas. Só para vídeos longos o bastante para que
# começo e fim não contenham o sinal em si.
TRANSICAO_MIN_FRAMES = 3 * FRAME_COUNT

# --- SETUP MEDIAPIPE TASKS ---
base_options = python.BaseOptions(model_asset_path=ensure_hand_landmarker())
options = vision.HandLandmarkerOptions(
    base_options=base_options,
    running_mode=vision.RunningMode.IMAGE,
    num_hands=NUM_HANDS,
    min_hand_detection_confidence=0.5 # Menor para aceitar vídeos de internet
)
detector = vision.HandLandmarker.create_from_options(options)

def extrair_coords_do_video(video_path):
    cap = cv2.VideoCapture(str(video_path))
    lista_frames = []
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret: break
        
        # Processamento
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
        results = detector.detect(mp_image)
        
        coords = np.zeros(COORD_SIZE)
        if results.hand_landmarks:
            all_pts = []
            for hand in results.hand_landmarks[:NUM_HANDS]:
                for lm in hand:
                    all_pts.extend([lm.x, lm.y, lm.z])
            coords[:len(all_pts)] = all_pts
        
        lista_frames.append(coords)
    
    cap.release()
    return lista_frames


def janelas_do_video(lista_frames):
    """Devolve as janelas de FRAME_COUNT frames extraídas de um vídeo:
    'miolo' (o sinal) e, se o vídeo for longo, 'trans_ini'/'trans_fim'
    (começo e fim, rotulados como OUTRO no treino)."""
    total_frames = len(lista_frames)
    if total_frames == 0:
        return {}

    if total_frames > FRAME_COUNT:
        # Acha o meio exato do vídeo e pega 15 frames pra trás e 15 pra frente
        meio = total_frames // 2
        inicio = max(0, meio - (FRAME_COUNT // 2))
        recorte = lista_frames[inicio:inicio + FRAME_COUNT]
        while len(recorte) < FRAME_COUNT:
            recorte.append(recorte[-1])
    else:
        # Vídeo super curto: repete o último frame até dar FRAME_COUNT
        recorte = list(lista_frames)
        while len(recorte) < FRAME_COUNT:
            recorte.append(recorte[-1])

    janelas = {'miolo': np.array(recorte)}
    if total_frames >= TRANSICAO_MIN_FRAMES:
        janelas['trans_ini'] = np.array(lista_frames[:FRAME_COUNT])
        janelas['trans_fim'] = np.array(lista_frames[-FRAME_COUNT:])
    return janelas

# --- LOOP PRINCIPAL PELAS PASTAS ---
print("\n🔄 Iniciando processamento de vídeos...\n")
dir_outro = DATA_PATH / CLASSE_NEGATIVA
dir_outro.mkdir(parents=True, exist_ok=True)

for sign in ACTIONS:
    input_dir = VIDEOS_PATH / sign.lower()
    output_dir = DATA_PATH / sign
    output_dir.mkdir(parents=True, exist_ok=True)
    
    if not input_dir.exists():
        print(f"⚠️ Pasta não encontrada: {input_dir}")
        continue
        
    videos = [f for f in os.listdir(input_dir) if f.endswith(('.mp4', '.avi', '.mov'))]
    print(f"📁 Processando {len(videos)} vídeos de: {sign}")
    
    for v_name in videos:
        v_path = input_dir / v_name
        save_path = output_dir / f"ext_{v_name}.npy"
        trans_ini = dir_outro / f"trans_ini_{v_name}.npy"
        # Já extraído (miolo + transições, ou vídeo curto sem transições)?
        if save_path.exists() and (trans_ini.exists() or sign == CLASSE_NEGATIVA
                                   or (output_dir / f".curto_{v_name}").exists()):
            continue  # extração é lenta — não reprocessa
        try:
            janelas = janelas_do_video(extrair_coords_do_video(v_path))
            if not janelas:
                continue
            np.save(save_path, janelas['miolo'])
            # Transições da própria classe OUTRO não acrescentam nada novo
            if 'trans_ini' in janelas and sign != CLASSE_NEGATIVA:
                np.save(trans_ini, janelas['trans_ini'])
                np.save(dir_outro / f"trans_fim_{v_name}.npy", janelas['trans_fim'])
            elif 'trans_ini' not in janelas:
                (output_dir / f".curto_{v_name}").touch()  # marca: sem transições
        except Exception as e:
            print(f"❌ Erro ao processar {v_name}: {e}")

detector.close()
print("\n✅ Processamento concluído! O 'miolo' da ação foi extraído com sucesso.")