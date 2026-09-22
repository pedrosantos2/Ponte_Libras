"""
Validação cruzada leave-one-signer-out.

Com poucos sinalizantes, um único split treino/teste é loteria: a acurácia
muda muito dependendo de QUEM cai no teste. Aqui rodamos N_FOLDS treinos,
cada um deixando uma pessoa diferente de fora POR CLASSE, e reportamos a
média — o número estável e defensável para o TCC.
"""
import os
import numpy as np
from sklearn.utils.class_weight import compute_class_weight
from tensorflow.keras.utils import to_categorical
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout

from config import (
    ACTIONS, DATA_PATH, FRAME_COUNT, COORD_SIZE, FEATURE_SIZE,
    EPOCHS, BATCH_SIZE, glossa_de, normalizar_sequencia, grupo_origem,
)
from enquadramento import simular_sentado

N_FOLDS = 3


def montar_modelo():
    model = Sequential([
        LSTM(64, return_sequences=True, input_shape=(FRAME_COUNT, FEATURE_SIZE)),
        LSTM(64, return_sequences=False),
        Dropout(0.3),
        Dense(32, activation='relu'),
        Dense(len(ACTIONS), activation='softmax')
    ])
    model.compile(optimizer='Adam', loss='categorical_crossentropy',
                  metrics=['categorical_accuracy'])
    return model


# --- CARREGA TUDO UMA VEZ ---
# Xs: as mesmas sequências como uma webcam de notebook veria com a pessoa
# sentada. Só entram no TESTE: medem se o modelo aguenta essa situação.
X, Xs, labels, grupos = [], [], [], []
for ci, action in enumerate(ACTIONS):
    d = os.path.join(DATA_PATH, action)
    if not os.path.exists(d):
        continue
    for f in sorted(os.listdir(d)):
        if not f.endswith('.npy'):
            continue
        seq = np.load(os.path.join(d, f))
        if seq.shape != (FRAME_COUNT, COORD_SIZE):
            continue
        normalizada = normalizar_sequencia(seq)
        if normalizada is None:
            continue   # corpo não detectado: sem referência de locação
        X.append(normalizada)
        Xs.append(normalizar_sequencia(simular_sentado(seq)))
        labels.append(ci)
        grupos.append(grupo_origem(f))

X = np.array(X)
Xs = np.array(Xs)
labels = np.array(labels)
grupos = np.array(grupos)
y = to_categorical(labels, num_classes=len(ACTIONS)).astype(int)

grupos_por_classe = {ci: sorted({g for g, l in zip(grupos, labels) if l == ci})
                     for ci in set(labels)}

# Pesos de classe: OUTRO tem muito mais amostras (janelas de transição)
pesos = compute_class_weight('balanced', classes=np.arange(len(ACTIONS)), y=labels)
class_weight = dict(enumerate(pesos))

# --- RODA OS FOLDS ---
acertos_classe = {a: [] for a in ACTIONS}
acertos_sentado = {a: [] for a in ACTIONS}
for fold in range(N_FOLDS):
    # Em cada fold, a pessoa de teste de cada classe muda (rotaciona)
    grupos_teste = {ci: gs[fold % len(gs)] for ci, gs in grupos_por_classe.items()}
    # A pessoa de teste sai do treino em TODAS as classes (suas janelas de
    # transição, rotuladas OUTRO, vão junto para o teste)
    mascara_teste = np.isin(grupos, list(set(grupos_teste.values())))

    print(f"\n===== FOLD {fold + 1}/{N_FOLDS} =====")
    model = montar_modelo()
    model.fit(X[~mascara_teste], y[~mascara_teste],
              epochs=EPOCHS, batch_size=BATCH_SIZE, verbose=0,
              class_weight=class_weight)

    pred = model.predict(X[mascara_teste], verbose=0).argmax(1)
    pred_s = model.predict(Xs[mascara_teste], verbose=0).argmax(1)
    reais = labels[mascara_teste]
    # acerto pela GLOSSA: prever OI para um OI_ACENO (ou o contrário) está certo
    g = np.array([glossa_de(a) for a in ACTIONS])
    for ci, action in enumerate(ACTIONS):
        sel = reais == ci
        if sel.any():
            acc = float((g[pred[sel]] == g[ci]).mean())
            acc_s = float((g[pred_s[sel]] == g[ci]).mean())
            acertos_classe[action].append(acc)
            acertos_sentado[action].append(acc_s)
            print(f"  {action:10s} teste={grupos_teste[ci][:30]:32s} em pé {acc:4.0%} | sentado {acc_s:4.0%}")

# --- RESUMO ---
print("\n===== MÉDIA POR SINAL (leave-one-signer-out) =====")
todas, todas_s = [], []
for action in ACTIONS:
    accs, accs_s = acertos_classe[action], acertos_sentado[action]
    if accs:
        todas.append(np.mean(accs))
        todas_s.append(np.mean(accs_s))
        print(f"  {action:10s} em pé {np.mean(accs):4.0%} | sentado {np.mean(accs_s):4.0%}"
              f"  (folds em pé: {[f'{a:.0%}' for a in accs]})")
print(f"\nACURÁCIA MÉDIA GERAL: em pé {np.mean(todas):.1%} | sentado {np.mean(todas_s):.1%}")
