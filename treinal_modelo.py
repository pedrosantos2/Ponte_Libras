import json
import os
import numpy as np
from sklearn.model_selection import train_test_split
from tensorflow.keras.utils import to_categorical
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
import tensorflow as tf

from config import (
    ACTIONS, DATA_PATH, FRAME_COUNT, COORD_SIZE,
    EPOCHS, BATCH_SIZE, MODELO_LSTM, LABELS_JSON,
    normalizar_sequencia, grupo_origem,
)

EXPECTED_SHAPE = (FRAME_COUNT, COORD_SIZE)
LABEL_MAP = {label: num for num, label in enumerate(ACTIONS)}


sequences, labels, grupos = [], [], []

print("--- ANALISANDO DATASET ---")
for action in ACTIONS:
    dir_path = os.path.join(DATA_PATH, action)
    if not os.path.exists(dir_path):
        print(f"⚠️ Pasta não encontrada para o sinal {action}")
        continue

    files = [f for f in os.listdir(dir_path) if f.endswith('.npy')]

    for file in files:
        res = np.load(os.path.join(dir_path, file))

        # VERIFICAÇÃO DE SEGURANÇA: só aceita o shape que a rede espera
        if res.shape == EXPECTED_SHAPE:
            # Normaliza a sequência inteira: os .npy guardam coordenadas
            # cruas, a rede sempre vê a versão invariante à posição/escala
            sequences.append(normalizar_sequencia(res))
            labels.append(LABEL_MAP[action])
            grupos.append(f"{action}/{grupo_origem(file)}")
        else:
            print(f"⚠️ Ignorando arquivo corrompido/antigo: {file} | Shape: {res.shape}")

if len(sequences) == 0:
    print("❌ Erro: Nenhum dado válido encontrado. Verifique se gravou os sinais com 2 mãos.")
    exit()

X = np.array(sequences)
y = to_categorical(labels, num_classes=len(ACTIONS)).astype(int)
labels = np.array(labels)
grupos = np.array(grupos)

# --- SPLIT TREINO/TESTE SEM VAZAMENTO ---
# O certo é separar por amostra ORIGINAL (grupo): todas as variações
# aumentadas de um mesmo vídeo ficam juntas no treino OU no teste.
# Isso só é possível se cada sinal tiver pelo menos 2 vídeos originais.
grupos_por_classe = {}
for g, l in zip(grupos, labels):
    grupos_por_classe.setdefault(l, set()).add(g)

if any(len(gs) >= 2 for gs in grupos_por_classe.values()):
    # Reserva 1 grupo (vídeo original + suas variações) para teste em cada
    # sinal que tiver 2+ vídeos; sinais com 1 vídeo ficam só no treino.
    grupos_teste = set()
    for classe, gs in grupos_por_classe.items():
        if len(gs) >= 2:
            grupos_teste.add(sorted(gs)[0])
        else:
            print(f"⚠️ {ACTIONS[classe]} tem só 1 vídeo original: fica fora do teste. "
                  f"Colete mais vídeos desse sinal!")
    mascara_teste = np.isin(grupos, list(grupos_teste))
    X_train, y_train = X[~mascara_teste], y[~mascara_teste]
    X_test, y_test = X[mascara_teste], y[mascara_teste]
    print("✅ Split por grupo: o teste usa vídeos que o treino nunca viu.")
else:
    print("⚠️ AVISO: todos os sinais têm apenas 1 vídeo original. O split será por arquivo,")
    print("   então variações aumentadas do mesmo vídeo caem em treino E teste.")
    print("   A acurácia reportada ficará INFLADA — colete mais vídeos por sinal!")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.1, stratify=labels)

# --- MODELO LSTM ---
# Rede pequena de propósito: com poucas dezenas de amostras reais, uma rede
# grande decora o dataset em vez de aprender os sinais (overfitting).
model = Sequential([
    # tanh (padrão) é mais estável que relu em LSTMs e habilita a
    # implementação otimizada (cuDNN) quando houver GPU
    LSTM(64, return_sequences=True, input_shape=(FRAME_COUNT, COORD_SIZE)),
    LSTM(64, return_sequences=False),

    Dropout(0.3),

    Dense(32, activation='relu'),
    Dense(len(ACTIONS), activation='softmax')
])
model.compile(optimizer='Adam', loss='categorical_crossentropy', metrics=['categorical_accuracy'])

print(f"\n--- TREINANDO COM {len(X_train)} SEQUÊNCIAS (teste: {len(X_test)}) ---")
model.fit(X_train, y_train, epochs=EPOCHS, batch_size=BATCH_SIZE,
          validation_data=(X_test, y_test))

# --- MODELO FINAL: treina do zero com 100% DOS DADOS ---
# A avaliação acima mede a acurácia honesta (pessoa fora do treino).
# O modelo de PRODUÇÃO não precisa desse sacrifício: prática padrão em
# datasets pequenos é avaliar com held-out e treinar o modelo final com
# tudo — aqui isso dá +1 sinalizante às classes que só têm 3.
print("\n--- TREINANDO MODELO FINAL COM 100% DOS DADOS ---")
model_final = tf.keras.models.clone_model(model)
model_final.compile(optimizer='Adam', loss='categorical_crossentropy',
                    metrics=['categorical_accuracy'])
model_final.fit(X, y, epochs=EPOCHS, batch_size=BATCH_SIZE, verbose=2)

# --- SALVA O MODELO E A ORDEM DAS CLASSES ---
# O labels.json garante que a inferência use EXATAMENTE a mesma ordem
# de classes do treino — sem ele, um índice trocado traduz o sinal errado.
model_final.save(MODELO_LSTM)
with open(LABELS_JSON, 'w', encoding='utf-8') as f:
    json.dump(ACTIONS, f, ensure_ascii=False, indent=2)

print(f"\n✅ Modelo salvo em {MODELO_LSTM} + classes em {LABELS_JSON}")
