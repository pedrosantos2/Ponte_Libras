import numpy as np
import os
import random

from config import ACTIONS, DATA_PATH
from enquadramento import FAIXA_CORTE, simular_sentado

# Alvo de amostras por classe APÓS o augment. Classes com muitos vídeos
# originais recebem poucas variações; classes com poucos recebem muitas.
# Sem esse balanceamento, o modelo aprende a chutar a classe majoritária.
ALVO_POR_CLASSE = 66
PROB_SENTADO = 0.5   # metade das variações simula a pessoa sentada

def aplicar_augment(dados_originais):
    """Cria uma variação da sequência simulando diferenças reais entre pessoas.

    As transformações escolhidas SOBREVIVEM à normalização feita no treino
    (escala e translação seriam canceladas por ela, então não adiantam):
      1. ESPELHAMENTO — sinalizantes canhotos fazem o sinal espelhado
      2. ROTAÇÃO leve — inclinação de câmera/postura
      3. TIME-WARP — pessoas sinalizam em velocidades diferentes
      4. JITTER — tremor natural das mãos
      5. SENTADO (antes das outras) — webcam de notebook com a pessoa sentada:
         a mão que desce abaixo do peito sai do quadro
    """
    dados = np.copy(dados_originais)
    if random.random() < PROB_SENTADO:
        dados = simular_sentado(dados, random.uniform(*FAIXA_CORTE))
    n_frames, n_coords = dados.shape
    mascara = dados.any(axis=1)  # frames com mão detectada

    # 1. ESPELHAMENTO horizontal (50% de chance): x -> 1 - x
    if random.random() < 0.5:
        for ponto in range(0, n_coords, 3):
            xs = dados[:, ponto]
            dados[:, ponto] = np.where(mascara & (xs != 0), 1.0 - xs, xs)

    # 2. ROTAÇÃO leve em torno do centro da imagem (±10°)
    ang = np.radians(random.uniform(-10, 10))
    cos_a, sin_a = np.cos(ang), np.sin(ang)
    for ponto in range(0, n_coords, 3):
        x, y = dados[:, ponto] - 0.5, dados[:, ponto + 1] - 0.5
        detectado = mascara & ((dados[:, ponto] != 0) | (dados[:, ponto + 1] != 0))
        dados[:, ponto]     = np.where(detectado, x * cos_a - y * sin_a + 0.5, dados[:, ponto])
        dados[:, ponto + 1] = np.where(detectado, x * sin_a + y * cos_a + 0.5, dados[:, ponto + 1])

    # 3. TIME-WARP: reamostra os frames como se o sinal fosse mais rápido/lento
    velocidade = random.uniform(0.8, 1.2)
    indices = np.clip(np.round(np.arange(n_frames) * velocidade).astype(int), 0, n_frames - 1)
    dados = dados[indices]

    # 4. JITTER (ruído pequeno só nos pontos detectados)
    ruido = np.random.uniform(-0.003, 0.003, dados.shape)
    dados = np.where(dados != 0, dados + ruido, dados)

    return dados

print("🧬 Iniciando Expansão do Dataset do Ponte Libras...")

for action in ACTIONS:
    pasta_acao = DATA_PATH / action
    if not pasta_acao.exists():
        print(f"⚠️ Pasta {action} não encontrada. Pulando...")
        continue
    
    arquivos_originais = [f for f in os.listdir(pasta_acao) if f.endswith('.npy') and not f.startswith('aug_')]
    if not arquivos_originais:
        continue

    # pelo menos 1 variação por original: até a classe OUTRO, que já tem
    # muitos exemplos, precisa ganhar versões com a pessoa sentada
    variacoes = max(1, round(ALVO_POR_CLASSE / len(arquivos_originais)) - 1)
    total = len(arquivos_originais) * (variacoes + 1)
    print(f"📁 {action}: {len(arquivos_originais)} originais × {variacoes} variações = {total} amostras")

    for nome_arq in arquivos_originais:
        caminho_arq = pasta_acao / nome_arq
        dados_base = np.load(caminho_arq)

        for i in range(variacoes):
            dados_novos = aplicar_augment(dados_base)
            novo_nome = f"aug_{i}_{nome_arq}"
            np.save(pasta_acao / novo_nome, dados_novos)

print("\n✅ Dataset expandido com sucesso! Agora as 3 pastas estão prontas para o treino.")