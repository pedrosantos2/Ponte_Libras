"""
Importa amostras do dataset MALTA-LIBRAS (Hugging Face) para o formato do projeto.

O MALTA agrega vídeos de vários dicionários de LIBRAS (UFSC, UFV, USP,
SpreadTheSign, canais do YouTube...) — cada fonte é um SINALIZANTE diferente,
que é exatamente o que o modelo precisa para generalizar. Os arquivos .pt
guardam os frames do vídeo (32, 3, 224, 224); aqui rodamos o MediaPipe em
cada frame e salvamos as coordenadas no formato (30, 126) do projeto.

Os .npy gerados são nomeados 'malta_a<ator>_<n>_<palavra>.npy' — o número do
ator identifica a PESSOA, usado pelo split honesto (config.grupo_origem).
"""
import ast
import csv
import subprocess
import urllib.parse
from collections import defaultdict
from pathlib import Path

import numpy as np
import torch
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

from config import (
    ACTIONS, DATA_PATH, FRAME_COUNT, COORD_SIZE, NUM_HANDS, ensure_hand_landmarker,
)

# palavra do CSV (minúscula) -> classe do projeto
PALAVRAS = {
    'oi': 'OI',
    'laranja': 'LARANJA',
    'bom': 'BOM',
}

# Classe negativa OUTRO: N palavras aleatórias FORA do vocabulário, uma
# amostra cada, de sinalizantes variados — ensina o modelo a dizer
# "isso não é nenhum sinal que eu conheço".
AMOSTRAS_OUTRO = 30
SEMENTE = 42

BASE_URL = "https://huggingface.co/datasets/MALTA-Lab/MALTA_LIBRAS/resolve/main/malta_libras_complete"
CSV_URL = f"{BASE_URL}/malta_libras_complete.csv"

# nome do dicionário no CSV -> pasta no repositório
PASTA_POR_DICT = {
    'Acessibilidades2': 'acessibilidade_2',
    'Acessibilidades3': 'acessibilidade_3',
    'SpreadTheSign': 'spread_the_sign',
    'UFSC': 'ufsc',
    'UFSC_V2': 'ufsc_v2',
    'UFV': 'ufv',
    'USP': 'usp',
    'Youtube': 'youtube',
    'Youtube_V2': 'youtube_v2',
}

# (O subconjunto malta_libras_MINDS_subset NÃO é usado: no Hub seus arquivos
#  são ponteiros LFS quebrados de 132 bytes, sem o conteúdo real.)

# --- SETUP MEDIAPIPE ---
base_options = mp_python.BaseOptions(model_asset_path=ensure_hand_landmarker())
detector = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
    base_options=base_options,
    running_mode=vision.RunningMode.IMAGE,
    num_hands=NUM_HANDS,
    min_hand_detection_confidence=0.4,  # vídeos 224x224, detecção mais difícil
))


def tensor_para_sequencia(caminho_pt):
    """Frames (T, 3, 224, 224) -> coordenadas (FRAME_COUNT, COORD_SIZE)."""
    t = torch.load(caminho_pt, weights_only=False, map_location='cpu')
    frames = t.permute(0, 2, 3, 1).numpy()

    seq = []
    for f in frames:
        img = np.ascontiguousarray(f, dtype=np.uint8)
        res = detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=img))
        coords = np.zeros(COORD_SIZE)
        if res.hand_landmarks:
            pts = []
            for hand in res.hand_landmarks[:NUM_HANDS]:
                for lm in hand:
                    pts.extend([lm.x, lm.y, lm.z])
            coords[:len(pts)] = pts
        seq.append(coords)

    # recorte central / padding para FRAME_COUNT
    if len(seq) > FRAME_COUNT:
        inicio = (len(seq) - FRAME_COUNT) // 2
        seq = seq[inicio:inicio + FRAME_COUNT]
    while len(seq) < FRAME_COUNT:
        seq.append(seq[-1])
    return np.array(seq)


def baixar(url, destino):
    r = subprocess.run(['curl', '-sL', '-m', '120', '-o', str(destino), url])
    return r.returncode == 0 and destino.exists() and destino.stat().st_size > 1000


# --- LÊ O ÍNDICE ---
csv_local = Path('/tmp/malta.csv')
if not csv_local.exists():
    baixar(CSV_URL, csv_local)
rows = list(csv.DictReader(open(csv_local)))

# Sorteia as amostras da classe OUTRO: palavras distintas, fora do vocabulário
import random
random.seed(SEMENTE)
vocab = set(PALAVRAS) | {a.lower() for a in ACTIONS}
candidatos = [r for r in rows if r['lemma'].lower() not in vocab and r['lemma'].strip()]
random.shuffle(candidatos)
outro_rows, lemmas_usados = [], set()
for r in candidatos:
    if r['lemma'].lower() in lemmas_usados:
        continue
    lemmas_usados.add(r['lemma'].lower())
    outro_rows.append(r)
    if len(outro_rows) == AMOSTRAS_OUTRO:
        break
ids_outro = {id(r) for r in outro_rows}

contagem = defaultdict(int)
tmp_pt = Path('/tmp/malta_amostra.pt')

for r in rows:
    lemma = r['lemma'].lower()
    if id(r) in ids_outro:
        classe = 'OUTRO'
        lemma = 'outro-' + ''.join(ch for ch in lemma if ch.isalnum())[:12]
    elif lemma in PALAVRAS:
        classe = PALAVRAS[lemma]
    else:
        continue
    pasta_repo = PASTA_POR_DICT.get(r['dictionary'])
    if pasta_repo is None:
        print(f"⚠️ Dicionário desconhecido: {r['dictionary']} — pulando")
        continue

    rel = ast.literal_eval(r['path'])[0].lstrip('./')
    nome_arquivo = rel.split('/', 1)[1]
    url = f"{BASE_URL}/{pasta_repo}/{urllib.parse.quote(nome_arquivo)}"

    (DATA_PATH / classe).mkdir(parents=True, exist_ok=True)
    idx = contagem[(classe, r['actor'])]
    destino = DATA_PATH / classe / f"malta_a{r['actor']}_{idx}_{lemma.replace('ã','a')}.npy"
    if destino.exists():
        contagem[(classe, r['actor'])] += 1
        continue

    if not baixar(url, tmp_pt):
        print(f"❌ Falha no download: {nome_arquivo}")
        continue

    try:
        seq = tensor_para_sequencia(tmp_pt)
        frames_com_mao = int(seq.any(axis=1).sum())
        if frames_com_mao < 5:
            print(f"⚠️ {nome_arquivo}: só {frames_com_mao} frames com mão — descartado")
            continue
        np.save(destino, seq)
        contagem[(classe, r['actor'])] += 1
        print(f"✅ {classe:8s} ator {r['actor']:>4s}: {nome_arquivo[:50]} ({frames_com_mao}/30 frames c/ mão)")
    except Exception as e:
        print(f"❌ Erro em {nome_arquivo}: {e}")

detector.close()

print("\n--- RESUMO POR CLASSE ---")
por_classe = defaultdict(set)
for (classe, ator), n in contagem.items():
    if n:
        por_classe[classe].add(ator)
for classe, atores in sorted(por_classe.items()):
    print(f"{classe}: {len(atores)} sinalizantes novos")
