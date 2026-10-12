"""
Paridade entre o extrator do Python (extracao.py) e o MediaPipe do navegador
(site/src/paridade.ts).

O site de coleta extrai as coordenadas NO NAVEGADOR e envia só os números —
a imagem da câmera nunca sai do computador da pessoa. Mas o modelo foi
treinado com o extrator do Python. Se os dois não gerarem os mesmos números
para os mesmos pixels, o modelo passa a errar com os dados da web sem que
ninguém perceba.

Para isolar a diferença entre os dois MediaPipe, os frames são reduzidos a
640 px e salvos em PNG (sem perda): Python e navegador leem exatamente os
mesmos pixels. Os mesmos arquivos .task são servidos ao navegador.

Uso:
  ./venv/bin/python testar_paridade_web.py preparar
  (abrir http://localhost:5180/paridade.html — config "paridade" do
   .claude/launch.json — e esperar a página dizer que terminou)
  ./venv/bin/python testar_paridade_web.py comparar

Subcomando "modelo": confere a LSTM escrita em TypeScript (site/src/app/
modelo.ts) contra o Keras. Gera janelas reais do DATA_V2 com as
probabilidades do Keras; a página paridade-modelo.html refaz a normalização
e a rede no navegador e mostra a diferença.
  ./venv/bin/python exportar_modelo_web.py
  ./venv/bin/python testar_paridade_web.py modelo
  (abrir http://localhost:5180/paridade-modelo.html)
"""
import base64
import json
import shutil
import sys
from pathlib import Path

import cv2
import numpy as np

from config import (
    ACTIONS, COORD_SIZE, DATA_PATH, FRAME_COUNT, HAND_SIZE, HAND_LANDMARKER, POSE_LANDMARKER, LABELS_JSON,
    MODELO_LSTM, glossa_de, normalizar_sequencia, _ordenar_maos,
)
from extracao import Extrator, LARGURA_DETECCAO

VIDEOS = [
    ("oi", "videos_baixados/oi/vlibrasil_art1_oi.mp4"),
    ("abacaxi", "videos_baixados/abacaxi/vlibrasil_art2_abacaxi.mp4"),
    ("amarelo", "videos_baixados/amarelo/minds_s01_r1_amarelo.mp4"),
    ("medo", "videos_baixados/medo/minds_s01_r1_medo.mp4"),
]
# Os dois jeitos de extrair que existem no projeto:
#   imagem: bases públicas (processador_videos.py), frame a frame
#   video:  coletor e tradutor, rastreando a mão entre frames — é o que o
#           site de coleta vai usar
MODOS = {
    "imagem": dict(conf_mao=0.5),
    "video": dict(modo_video=True, conf_mao=0.7),
}

PNG = Path("site/public/paridade")
DADOS = Path("site/.paridade")
PONTOS_MAO = 21 * 3


def preparar():
    manifesto = []
    referencia = {}
    for nome, caminho in VIDEOS:
        cap = cv2.VideoCapture(caminho)
        fps = cap.get(cv2.CAP_PROP_FPS)
        frames = []
        while True:
            ok, f = cap.read()
            if not ok:
                break
            h, w = f.shape[:2]
            frames.append(cv2.resize(f, (LARGURA_DETECCAO, int(h * LARGURA_DETECCAO / w))))
        cap.release()

        pasta = PNG / nome
        pasta.mkdir(parents=True, exist_ok=True)
        for i, f in enumerate(frames):
            cv2.imwrite(str(pasta / f"{i:04d}.png"), f)

        # um extrator novo por vídeo: o modo vídeo carrega o rastreamento
        # de um frame para o outro, e o navegador faz igual
        for modo, opcoes in MODOS.items():
            ext = Extrator(**opcoes)
            referencia[f"{nome}/{modo}"] = np.array(
                [ext.extrair(f, i * 1000 / fps)[0] for i, f in enumerate(frames)],
                dtype=np.float32)
            ext.close()

        manifesto.append({"nome": nome, "n": len(frames), "fps": fps})
        print(f"{nome:8s} {len(frames)} frames a {fps:.1f} fps")

    (PNG / "modelos").mkdir(exist_ok=True)
    for modelo in (HAND_LANDMARKER, POSE_LANDMARKER):
        shutil.copy(modelo, PNG / "modelos" / modelo.name)
    (PNG / "manifesto.json").write_text(json.dumps({"videos": manifesto}))
    DADOS.mkdir(parents=True, exist_ok=True)
    np.savez(DADOS / "ref.npz", **referencia)
    print(f"\nFrames em {PNG}/, referência do Python em {DADOS}/ref.npz")


def _maos(frame):
    """Blocos de mão presentes, na ordem que a normalização usa."""
    ordenado = _ordenar_maos(frame[:HAND_SIZE])
    return [ordenado[h * PONTOS_MAO:(h + 1) * PONTOS_MAO]
            for h in range(2) if ordenado[h * PONTOS_MAO:(h + 1) * PONTOS_MAO].any()]


def _janelas(seq, passo=5):
    return [seq[i:i + FRAME_COUNT] for i in range(0, len(seq) - FRAME_COUNT + 1, passo)]


def comparar():
    ref = np.load(DADOS / "ref.npz")
    web = json.loads((DADOS / "web.json").read_text())
    versao = json.loads(Path("site/node_modules/@mediapipe/tasks-vision/package.json").read_text())["version"]
    print(f"MediaPipe do navegador: {versao} (delegate {web['delegate']})\n")

    from tensorflow.keras.models import load_model
    modelo = load_model(MODELO_LSTM)
    classes = json.loads(Path(LABELS_JSON).read_text())

    for modo in MODOS:
        print(f"===== modo {modo} =====")
        tot_jan = tot_iguais = 0
        for nome, _ in VIDEOS:
            a = ref[f"{nome}/{modo}"]
            b = np.frombuffer(base64.b64decode(web["resultados"][f"{nome}/{modo}"]),
                              dtype=np.float32).reshape(a.shape)

            n_a = np.array([len(_maos(f)) for f in a])
            n_b = np.array([len(_maos(f)) for f in b])
            mesmo_n = n_a == n_b

            difs = []
            for fa, fb, ok in zip(a, b, mesmo_n):
                if ok:
                    for ma, mb in zip(_maos(fa), _maos(fb)):
                        difs.append(np.abs(ma - mb))
            difs = np.concatenate(difs) if difs else np.zeros(1)

            corpo = (a[:, HAND_SIZE + 2] > 0) & (b[:, HAND_SIZE + 2] > 0)
            dif_corpo = np.abs(a[corpo, HAND_SIZE:] - b[corpo, HAND_SIZE:])

            # o que importa no fim: o modelo dá a mesma resposta?
            ja = [normalizar_sequencia(j) for j in _janelas(a)]
            jb = [normalizar_sequencia(j) for j in _janelas(b)]
            pares = [(x, y) for x, y in zip(ja, jb) if x is not None and y is not None]
            iguais, dif_conf = 0, []
            if pares:
                pa = modelo.predict(np.array([x for x, _ in pares]), verbose=0)
                pb = modelo.predict(np.array([y for _, y in pares]), verbose=0)
                for ra, rb in zip(pa, pb):
                    ca, cb = ra.argmax(), rb.argmax()
                    iguais += glossa_de(classes[ca]) == glossa_de(classes[cb])
                    dif_conf.append(abs(ra[ca] - rb[ca]))
            tot_jan += len(pares)
            tot_iguais += iguais

            print(f"  {nome:8s} nº de mãos igual em {mesmo_n.mean():5.1%} dos frames"
                  f" | mãos: média {difs.mean():.5f}, máx {difs.max():.4f}"
                  f" | corpo: máx {dif_corpo.max() if dif_corpo.size else 0:.4f}"
                  f" | previsão igual {iguais}/{len(pares)} janelas"
                  f" (confiança muda até {max(dif_conf, default=0):.3f})")
        print(f"  TOTAL: previsão igual em {tot_iguais}/{tot_jan} janelas\n")


def modelo():
    """Janelas reais + probabilidades do Keras, para o navegador comparar."""
    from tensorflow.keras.models import load_model
    rede = load_model(MODELO_LSTM)

    janelas = []
    for classe in ACTIONS:
        arquivos = sorted((DATA_PATH / classe).glob("*.npy"))
        for f in arquivos[::max(1, len(arquivos) // 20)][:20]:
            seq = np.load(f)
            if seq.shape == (FRAME_COUNT, COORD_SIZE):
                janelas.append(seq)
    ref = np.load(DADOS / "ref.npz")
    for nome, _ in VIDEOS:
        janelas += _janelas(ref[f"{nome}/video"])

    normalizadas = [normalizar_sequencia(j) for j in janelas]
    validas = [n is not None for n in normalizadas]
    probs = np.zeros((len(janelas), len(ACTIONS)), dtype=np.float32)
    idx = [i for i, ok in enumerate(validas) if ok]
    probs[idx] = rede.predict(np.array([normalizadas[i] for i in idx], dtype=np.float32), verbose=0)

    b64 = lambda a: base64.b64encode(np.ascontiguousarray(a, dtype="<f4").tobytes()).decode()
    (PNG / "modelo_ref.json").write_text(json.dumps({
        "n": len(janelas), "janelas": b64(np.array(janelas)), "probs": b64(probs),
        "validas": validas,
    }))
    print(f"{len(janelas)} janelas ({sum(validas)} com corpo) -> {PNG}/modelo_ref.json")

    # Reconhecimento contínuo: os 4 vídeos em sequência, com 1 s de "sala
    # vazia" (quadros zerados) entre eles, a 30 FPS. Quais glossas o
    # reconhecedor.py aceita, e em que instante?
    from reconhecedor import ReconhecedorContinuo
    vazio = np.zeros((30, COORD_SIZE), dtype=np.float32)
    fluxo = [vazio]
    for nome, _ in VIDEOS:
        fluxo += [ref[f"{nome}/video"], vazio]
    fluxo = np.concatenate(fluxo)
    rec = ReconhecedorContinuo(rede, ACTIONS, estabilidade=8, min_frames_com_mao=15)
    aceitas = []
    for i, q in enumerate(fluxo):
        g = rec.processar(q, i / 30)
        if g:
            aceitas.append({"quadro": i, "glossa": g})
    (PNG / "reconhecedor_ref.json").write_text(json.dumps({
        "n": len(fluxo), "quadros": b64(fluxo), "aceitas": aceitas,
    }))
    print(f"fluxo de {len(fluxo)} quadros: o Python aceitou {[a['glossa'] for a in aceitas]}")


if __name__ == "__main__":
    {"preparar": preparar, "comparar": comparar, "modelo": modelo}[sys.argv[1]]()
