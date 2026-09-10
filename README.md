# 🤟 Tradutor LIBRAS-SC

Sistema de reconhecimento de **LIBRAS** (Língua Brasileira de Sinais) que usa visão computacional
para detectar sinais a partir da webcam ou de vídeos e os traduz para **português fluído** com a
ajuda de um modelo de linguagem local (Ollama).

O pipeline rastreia as **mãos** com o MediaPipe Hand Landmarker, classifica a sequência de
movimentos com uma rede neural **LSTM** e converte as "glossas" detectadas (palavras-sinal) em
frases naturais através de um modelo Gemma customizado.

```
Webcam/Vídeo ──▶ MediaPipe (126 coords) ──▶ LSTM ──▶ Glossas ──▶ Ollama/Gemma ──▶ Português
```

---

## ✨ Como funciona

Cada sinal é representado por uma **sequência de 30 frames**, e cada frame contém as coordenadas
`(x, y, z)` de **2 mãos × 21 pontos = 126 valores**. Quando uma mão não é detectada, os valores
ficam zerados para manter o formato fixo esperado pela rede.

A LSTM recebe um tensor `(30, 126)` e devolve a probabilidade de cada sinal. Quando a confiança
ultrapassa o *threshold* (0.85), a glossa é adicionada à frase. Ao final, o conjunto de glossas é
enviado ao Ollama, que devolve a tradução em português.

---

## 📂 Estrutura do projeto

```
tradutor-libras/
├── config.py               # ⭐ Configuração central (sinais, caminhos, hiperparâmetros)
├── coletor_dados.py        # Coleta sinais pela webcam (grava sequências .npy)
├── processador_videos.py   # Extrai coordenadas de vídeos .mp4 → .npy
├── augment_total.py        # Data augmentation (10× variações por amostra)
├── treinal_modelo.py       # Treina a LSTM → modelo_libras.keras + labels.json
├── tradutor_final.py       # Tradutor em tempo real (webcam + OpenCV + Ollama)
├── Modelfile               # Definição do modelo Gemma customizado (Ollama)
├── requirements.txt        # Dependências Python
│
├── videos_baixados/        # Vídeos-fonte por sinal (entrada do processador)
│   ├── oi/ gostar/ laranja/ abacaxi/ banana/ morango/ ...
├── DATA/                   # Dataset de coordenadas (.npy), uma pasta por sinal
│   ├── OI/ GOSTAR/ LARANJA/ ABACAXI/ BANANA/ MORANGO/ ...
│
├── hand_landmarker.task    # Modelo MediaPipe (baixado automaticamente)
├── modelo_libras.keras     # Pesos da LSTM treinada
└── labels.json             # Ordem das classes usada no treino (gerado junto)
```

> Para adicionar um sinal novo, edite **apenas** a lista `ACTIONS` em `config.py` —
> todos os scripts importam de lá.

> ⚠️ Arquivos de dados (`*.npy`), modelos (`*.h5`, `*.task`) e o `venv/` são ignorados pelo Git
> (veja `.gitignore`). O repositório versiona apenas o código e alguns vídeos-fonte.

---

## 🔧 Pré-requisitos

- **Python 3.12**
- **Webcam** (para coleta e tradução em tempo real)
- **[Ollama](https://ollama.com)** instalado e rodando localmente (para a etapa de tradução)

### Dependências Python

```bash
python3.12 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

pip install -r requirements.txt
```

### Modelo de tradução (Ollama)

O tradutor usa um modelo Gemma customizado definido no `Modelfile`. Crie-o uma vez:

```bash
ollama create tradutor-sc -f Modelfile
```

> O `Modelfile` parte de `gemma3:4b`. O Ollama baixará o modelo base automaticamente na primeira vez.

---

## 🚀 Uso

### 1. Obter dados de treino

Você pode coletar sinais de duas formas:

**a) Pela webcam** — grava sequências de 30 frames ao vivo:

```bash
python coletor_dados.py
# 1/2/3: trocar de sinal  •  S: gravar 30 frames  •  Q: sair
```

**b) A partir de vídeos** — coloque arquivos `.mp4` em `videos_baixados/<SINAL>/` e extraia:

```bash
python processador_videos.py
# Gera os .npy correspondentes em DATA/<SINAL>/
```

### 2. Aumentar o dataset (opcional, recomendado)

Cria 10 variações (escala, translação e jitter) de cada amostra para robustez:

```bash
python augment_total.py
```

### 3. Treinar o modelo

Treina a LSTM com os `.npy` em `DATA/` e salva os pesos:

```bash
python treinal_modelo.py
# → modelo_libras.keras + labels.json
```

### 4. Traduzir em tempo real

Inicie o Ollama, depois rode o tradutor:

```bash
python tradutor_final.py
# Espaço: traduzir as glossas com o Gemma
# C: limpar a frase  •  Q: sair
```

---

## 🧠 Detalhes técnicos

| Componente        | Configuração                                              |
|-------------------|-----------------------------------------------------------|
| Detecção de mãos  | MediaPipe Hand Landmarker (`num_hands=2`)                 |
| Entrada da rede   | `(30 frames, 126 coords)`                                 |
| Arquitetura       | 3× LSTM (64→128→64) + Dropout + Dense (64→32→softmax)     |
| Treino            | Adam, `categorical_crossentropy`, 300 épocas, batch 8     |
| Threshold         | 0.85 de confiança para aceitar uma glossa                 |
| Tradução          | Ollama `tradutor-sc` (Gemma 3 4B), `temperature=0`        |

---

## 📊 Resultados atuais

Experimento central — mesma rede e pipeline, variando apenas a **diversidade de
sinalizantes** por sinal (avaliação com pessoa inteira fora do treino):

Validação cruzada leave-one-signer-out (3 folds, `validacao_cruzada.py`),
12 classes — média geral **54,3%**:

| Sinais | Sinalizantes | Acurácia média | Observação |
|---|---|---|---|
| OI | 8 (MALTA) | **81%** | Era 0% com 3 pessoas — resgatado pelo MALTA |
| AMARELO, BANHEIRO | 8 | 83% | Estáveis |
| MEDO, ACONTECER | 8 | 67–71% | |
| BOM (novo) | 8 (MALTA) | 62% | Sinal na região da boca |
| NAO (novo) | 9 (MALTA) | 42% | Amostras contêm frases compostas |
| GOSTAR | 2 | 38% | Caiu com o vocabulário maior |
| Frutas (LARANJA, ABACAXI, BANANA, MORANGO) | 3 | 14–39% | Cluster congestionado na boca |

Achado da rodada: os sinais localizados na **região da boca** (frutas, BOM, NAO)
se confundem entre si — a locação é o parâmetro discriminante e o pipeline atual
(só mãos, ancorado no pulso) não a captura bem. Somado a landmarks mais ruidosos
das amostras 224×224 do MALTA, o ganho em OI (+81pp) veio com queda nas frutas.

Conclusões:
- O gargalo é a **quantidade de pessoas diferentes** no treino: 2 pessoas → volátil
  (0–100% dependendo de quem testa); 7 pessoas → ~85% estável.
- **OI falha sistematicamente** por ser datilologia (sinal quase estático de
  configuração de dedos) — a LSTM é especializada em movimento. Sinais
  datilológicos exigem tratamento próprio.
- O modelo de produção (`modelo_libras.keras`) é treinado com **100% dos dados**
  após a avaliação — prática padrão em datasets pequenos.

Histórico do diagnóstico (bom material de metodologia):
- 100% "de acurácia" com vazamento de dados (augment antes do split) → número ilusório
- 33% com split por grupo (teste = sinalizante nunca visto) → baseline real
- 48,5% após normalização por sequência (preserva locação/movimento) + augmentation
  de espelhamento/rotação/time-warp + rede menor
- Erros restantes concentrados **entre os sinais de frutas** (locação/configuração
  parecidas) — o gargalo agora é diversidade de sinalizantes, não código

## ⚠️ Limitações conhecidas

- Apenas 2 sinalizantes no treino por sinal — o modelo ainda memoriza pessoas;
  mais sinalizantes (MINDS-Libras, gravações próprias) é a melhoria de maior impacto.
- A validação durante o treino reusa o conjunto de teste (aceitável com poucos dados,
  mas o ideal é um conjunto de validação separado quando o dataset crescer).
- "OI" tem variantes regionais (aceno vs datilologia O-I); o dataset usa a variante
  do V-LIBRASIL. Vídeos de variantes divergentes estão em `videos_baixados/_descartados/`.

---

## 🗺️ Próximos passos

- [x] Centralizar a lista de sinais e os hiperparâmetros em `config.py` + `labels.json`
- [x] Adicionar `requirements.txt`
- [x] Unificar a captura para 2 mãos (126 coords) em todas as fontes
- [x] 3+ vídeos originais por sinal (V-LIBRASIL) + split por grupo no treino
- [x] Normalização por sequência (ordem das mãos, locação e movimento preservados)
- [x] Augmentation que sobrevive à normalização (espelho, rotação, time-warp)
- [ ] Mais sinalizantes por sinal (MINDS-Libras e/ou gravações próprias) — maior impacto
- [ ] Usar um conjunto de validação separado do teste
- [ ] Expandir o vocabulário de sinais
