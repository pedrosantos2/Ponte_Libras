"""
Configuração central do projeto Tradutor LIBRAS-SC.

Todos os scripts importam daqui. Se você adicionar um sinal novo,
mude APENAS a lista ACTIONS abaixo — o resto do pipeline acompanha.
"""
from pathlib import Path
from urllib.request import urlopen

import numpy as np

# --- SINAIS (a ordem importa: é o índice que a rede neural aprende) ---
ACTIONS = [
    # V-LIBRASIL (3 sinalizantes cada)
    "OI", "GOSTAR", "LARANJA", "ABACAXI", "BANANA", "MORANGO",
    # MINDS-Libras (8 sinalizantes × 2 repetições cada)
    "ACONTECER", "AMARELO", "BANHEIRO", "MEDO",
    # MALTA-LIBRAS (dicionários agregados, 8 sinalizantes)
    # (NAO foi removido: todas as amostras disponíveis eram frases compostas)
    "BOM",
    # Classe negativa: sinais e gestos FORA do vocabulário. Sem ela o modelo
    # é obrigado a mapear qualquer gesto para o sinal mais parecido.
    "OUTRO",
]
CLASSE_NEGATIVA = "OUTRO"   # nunca vira glossa na inferência

# --- CAMINHOS ---
DATA_PATH = Path("DATA")                    # dataset de coordenadas (.npy)
VIDEOS_PATH = Path("videos_baixados")       # vídeos-fonte (.mp4)
MODELO_LSTM = "modelo_libras.keras"         # pesos da rede treinada
LABELS_JSON = "labels.json"                 # ordem das classes usada no treino
HAND_LANDMARKER = Path("hand_landmarker.task")

# --- FORMATO DOS DADOS ---
FRAME_COUNT = 30        # frames por sequência
NUM_HANDS = 2
COORD_SIZE = NUM_HANDS * 21 * 3   # 2 mãos × 21 pontos × (x, y, z) = 126

# --- TREINO ---
EPOCHS = 150
BATCH_SIZE = 8

# --- INFERÊNCIA ---
THRESHOLD = 0.95        # confiança mínima para aceitar uma glossa
OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "tradutor-sc"

# --- AGRUPAMENTO PARA O SPLIT TREINO/TESTE ---
import re as _re

def grupo_origem(nome_arquivo: str) -> str:
    """Identifica de qual PESSOA/amostra original um arquivo .npy veio.

    Tudo que deriva da mesma origem precisa cair do mesmo lado do split
    treino/teste, senão o teste avalia o modelo com cópias do que ele já
    viu (data leakage):
    - variações aumentadas ('aug_7_ext_oi...') pertencem ao vídeo original;
    - repetições do mesmo sinalizante ('minds_s05_r1'/'minds_s05_r2' ou
      'malta_a41_...') pertencem à mesma PESSOA.
    """
    nome = _re.sub(r'^aug_\d+_', '', nome_arquivo)
    m = _re.search(r'minds_s(\d+)', nome)
    if m:
        return f'minds_s{m.group(1)}'
    m = _re.search(r'malta_a(\d+)', nome)
    if m:
        return f'malta_a{m.group(1)}'
    return nome


# --- NORMALIZAÇÃO DAS COORDENADAS ---
# Um sinal em LIBRAS é definido por 4 parâmetros: configuração da mão,
# LOCAÇÃO, MOVIMENTO e orientação. A normalização precisa remover só o que
# não é sinal (posição do sinalizante na tela, distância da câmera) e
# preservar todos os 4 parâmetros. Por isso ela é POR SEQUÊNCIA:
# uma referência e uma escala únicas para os 30 frames — a trajetória do
# movimento e a locação relativa ficam intactas.

_PONTOS_POR_MAO = 21 * 3


def _ordenar_maos(coords):
    """Ordem determinística: mão com pulso mais à ESQUERDA (menor x) primeiro.

    O MediaPipe devolve as mãos em ordem aleatória, então o mesmo gesto
    poderia cair ora na 1ª ora na 2ª metade do vetor de 126 coordenadas.
    Mão única detectada também vai sempre para a 1ª metade.
    """
    coords = np.asarray(coords, dtype=float).copy()
    maos = [coords[h * _PONTOS_POR_MAO:(h + 1) * _PONTOS_POR_MAO].copy()
            for h in range(NUM_HANDS)]
    presentes = sorted((m for m in maos if m.any()), key=lambda m: m[0])
    for h in range(NUM_HANDS):
        nova = presentes[h] if h < len(presentes) else np.zeros(_PONTOS_POR_MAO)
        coords[h * _PONTOS_POR_MAO:(h + 1) * _PONTOS_POR_MAO] = nova
    return coords


def normalizar_sequencia(seq):
    """Normaliza uma sequência inteira (FRAME_COUNT, COORD_SIZE).

    1. Ordena as mãos de cada frame (esquerda primeiro).
    2. Para cada mão: subtrai a posição do pulso no PRIMEIRO frame em que ela
       aparece e divide por uma escala única da sequência. Frames sem detecção
       permanecem zerados.
    """
    seq = np.array([_ordenar_maos(f) for f in np.asarray(seq, dtype=float)])

    for h in range(NUM_HANDS):
        bloco = seq[:, h * _PONTOS_POR_MAO:(h + 1) * _PONTOS_POR_MAO]
        presentes = bloco.any(axis=1)
        if not presentes.any():
            continue
        pts = bloco[presentes].reshape(-1, 21, 3)

        referencia = pts[0, 0].copy()        # pulso no 1º frame detectado
        pts -= referencia                    # locação/movimento relativos a ele
        escala = np.abs(pts).max()
        if escala > 0:
            pts /= escala                    # invariância à distância da câmera

        bloco[presentes] = pts.reshape(-1, _PONTOS_POR_MAO)
        seq[:, h * _PONTOS_POR_MAO:(h + 1) * _PONTOS_POR_MAO] = bloco
    return seq


# --- DOWNLOAD DO MODELO MEDIAPIPE ---
_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/"
    "hand_landmarker/float16/1/hand_landmarker.task"
)

def ensure_hand_landmarker() -> str:
    """Baixa o hand_landmarker.task na primeira execução, se necessário."""
    if not HAND_LANDMARKER.exists():
        print("⬇️  Baixando modelo hand_landmarker.task (só na primeira vez)...")
        try:
            with urlopen(_MODEL_URL, timeout=30) as response:
                HAND_LANDMARKER.write_bytes(response.read())
        except Exception:
            # Fallback para o erro comum de certificado SSL no macOS
            import ssl
            context = ssl._create_unverified_context()
            with urlopen(_MODEL_URL, timeout=30, context=context) as response:
                HAND_LANDMARKER.write_bytes(response.read())
    return str(HAND_LANDMARKER)
