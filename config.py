"""
Configuração central do projeto Ponte Libras.

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
# (o sufixo _v2 marca a representação com referência do corpo; os arquivos
#  sem sufixo são do formato antigo, só mãos, e não são compatíveis)
DATA_PATH = Path("DATA_V2")                 # dataset de coordenadas (.npy)
VIDEOS_PATH = Path("videos_baixados")       # vídeos-fonte (.mp4)
MODELO_LSTM = "modelo_libras_v2.keras"      # pesos da rede treinada
LABELS_JSON = "labels_v2.json"              # ordem das classes usada no treino
HAND_LANDMARKER = Path("hand_landmarker.task")
POSE_LANDMARKER = Path("pose_landmarker_lite.task")

# --- FORMATO DOS DADOS ---
FRAME_COUNT = 30        # frames por sequência
NUM_HANDS = 2
HAND_SIZE = NUM_HANDS * 21 * 3    # 2 mãos × 21 pontos × (x, y, z) = 126
CORPO_SIZE = 3                    # nariz_x, nariz_y, largura dos ombros
COORD_SIZE = HAND_SIZE + CORPO_SIZE   # vetor CRU salvo nos .npy = 129
FEATURE_SIZE = HAND_SIZE          # entrada da rede, após normalizar = 126

# --- TREINO ---
EPOCHS = 150
BATCH_SIZE = 8

# --- INFERÊNCIA ---
THRESHOLD = 0.95        # confiança mínima para aceitar uma glossa
OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "ponte-libras"

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
    # prefixos que não mudam a ORIGEM: variação aumentada, janela de
    # transição (trans_ini_/trans_fim_) e o próprio 'ext_' do processador
    nome = _re.sub(r'^(aug_\d+_|trans_(ini|fim)_|ext_)+', '', nome_arquivo)
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
# preservar todos os 4 parâmetros. Por isso ela é POR SEQUÊNCIA e ancorada
# no CORPO: uma referência (nariz) e uma escala (ombros) únicas para os 30
# frames — a trajetória do movimento e a locação ficam intactas.

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
    """Sequência crua (FRAME_COUNT, COORD_SIZE) -> entrada da rede
    (FRAME_COUNT, FEATURE_SIZE), ou None se o corpo não foi detectado.

    1. Ordena as mãos de cada frame (esquerda primeiro).
    2. Re-expressa cada ponto das mãos em relação ao NARIZ e em unidades de
       LARGURA DOS OMBROS (mediana da sequência, robusta a falhas pontuais).
       "Mão na altura da boca", "na testa" ou "no peito" viram números
       diferentes — é o parâmetro de LOCAÇÃO — e iguais para qualquer pessoa,
       enquadramento ou distância da câmera. Movimento e configuração da mão
       ficam intactos. Frames sem mão detectada permanecem zerados.
    """
    seq = np.asarray(seq, dtype=float)
    corpo = seq[:, HAND_SIZE:]
    validos = corpo[:, 2] > 0
    if not validos.any():
        return None
    nariz_x, nariz_y, ombros = np.median(corpo[validos], axis=0)

    maos = np.array([_ordenar_maos(f[:HAND_SIZE]) for f in seq])
    for h in range(NUM_HANDS):
        bloco = maos[:, h * _PONTOS_POR_MAO:(h + 1) * _PONTOS_POR_MAO]
        presentes = bloco.any(axis=1)
        if not presentes.any():
            continue
        pts = bloco[presentes].reshape(-1, 21, 3)
        pts[:, :, 0] -= nariz_x
        pts[:, :, 1] -= nariz_y
        pts /= ombros
        bloco[presentes] = pts.reshape(-1, _PONTOS_POR_MAO)
        maos[:, h * _PONTOS_POR_MAO:(h + 1) * _PONTOS_POR_MAO] = bloco
    return maos


# --- DOWNLOAD DOS MODELOS MEDIAPIPE ---
_BASE = "https://storage.googleapis.com/mediapipe-models"
_HAND_URL = f"{_BASE}/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
_POSE_URL = f"{_BASE}/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"


def _garantir(caminho: Path, url: str) -> str:
    """Baixa o modelo na primeira execução, se necessário."""
    if not caminho.exists():
        print(f"⬇️  Baixando {caminho.name} (só na primeira vez)...")
        try:
            with urlopen(url, timeout=60) as response:
                caminho.write_bytes(response.read())
        except Exception:
            # Fallback para o erro comum de certificado SSL no macOS
            import ssl
            context = ssl._create_unverified_context()
            with urlopen(url, timeout=60, context=context) as response:
                caminho.write_bytes(response.read())
    return str(caminho)


def ensure_hand_landmarker() -> str:
    return _garantir(HAND_LANDMARKER, _HAND_URL)


def ensure_pose_landmarker() -> str:
    return _garantir(POSE_LANDMARKER, _POSE_URL)
