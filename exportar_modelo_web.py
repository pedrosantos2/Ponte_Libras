"""
Exporta o modelo treinado para o site rodar o reconhecimento no navegador.

A LSTM é pequena (84 mil pesos), então o site não carrega uma biblioteca de
IA: site/src/app/modelo.ts faz a conta das camadas direto em TypeScript, e
este script só entrega os pesos e o que o navegador precisa saber do
config.py (classes, glossas, limiar). Rodar de novo a cada retreino:

  ./venv/bin/python exportar_modelo_web.py

Gera site/public/modelo/ponte-libras.json (descrição) e .bin (pesos float32).
O testar_paridade_web.py (subcomando "modelo") confere que o navegador dá as
mesmas probabilidades que o Keras.
"""
import hashlib
import json
from pathlib import Path

import numpy as np
from tensorflow.keras.models import load_model

from config import (
    ACTIONS, CLASSE_NEGATIVA, FEATURE_SIZE, FRAME_COUNT, LABELS_JSON, MODELO_LSTM,
    THRESHOLD, glossa_de,
)

SAIDA = Path("site/public/modelo")


def exportar():
    modelo = load_model(MODELO_LSTM)
    classes = json.loads(Path(LABELS_JSON).read_text())
    assert classes == ACTIONS, "labels_v2.json não bate com config.ACTIONS: retreine"

    camadas, blocos, offset = [], [], 0
    for camada in modelo.layers:
        nome = type(camada).__name__
        if nome == "Dropout":
            continue          # só atua no treino
        cfg = camada.get_config()
        if nome == "LSTM":
            assert (cfg["activation"], cfg["recurrent_activation"]) == ("tanh", "sigmoid")
            desc = {"tipo": "lstm", "unidades": cfg["units"], "sequencias": cfg["return_sequences"]}
        elif nome == "Dense":
            desc = {"tipo": "densa", "unidades": cfg["units"], "ativacao": cfg["activation"]}
        else:
            raise ValueError(f"camada sem suporte no site: {nome}")
        desc["pesos"] = []
        for w in camada.get_weights():
            w = np.ascontiguousarray(w, dtype="<f4")
            desc["pesos"].append({"forma": list(w.shape), "inicio": offset, "tamanho": int(w.size)})
            blocos.append(w.tobytes())
            offset += int(w.size)
        camadas.append(desc)

    binario = b"".join(blocos)
    SAIDA.mkdir(parents=True, exist_ok=True)
    (SAIDA / "ponte-libras.bin").write_bytes(binario)
    descricao = {
        "versao": hashlib.sha256(binario).hexdigest()[:12],
        "classes": classes,
        "glossas": {c: glossa_de(c) for c in classes},
        "classe_negativa": CLASSE_NEGATIVA,
        "limiar": THRESHOLD,
        "quadros": FRAME_COUNT,
        "entradas": FEATURE_SIZE,
        "camadas": camadas,
    }
    (SAIDA / "ponte-libras.json").write_text(json.dumps(descricao, ensure_ascii=False, indent=1))
    print(f"{offset} pesos ({len(binario) / 1024:.0f} KB), versão {descricao['versao']} -> {SAIDA}/")


if __name__ == "__main__":
    exportar()
