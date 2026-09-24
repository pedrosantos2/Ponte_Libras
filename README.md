# 🤟 Ponte Libras

Sistema de reconhecimento de **LIBRAS** (Língua Brasileira de Sinais) que usa visão computacional
para detectar sinais a partir da webcam ou de vídeos e os traduz para **português fluído** com a
ajuda de um modelo de linguagem local (Ollama).

O pipeline rastreia as **mãos e o corpo** com o MediaPipe, classifica a sequência de movimentos com
uma rede neural **LSTM** e converte as "glossas" detectadas (palavras-sinal) em frases naturais
através de um modelo Gemma customizado — que roda na própria máquina, sem enviar imagem para
nenhum servidor.

```
Webcam/Vídeo ──▶ MediaPipe mãos + pose (129) ──▶ normalização (126) ──▶ LSTM
                                                                         │
                     português ◀── verificação ◀── Ollama/Gemma ◀── glossas
```

---

## ✨ Como funciona

**1. Representação do sinal.** Cada frame vira um vetor de **129 números** (`extracao.py`):
126 coordenadas `(x, y, z)` de 2 mãos × 21 pontos, mais `nariz_x`, `nariz_y` e a `largura dos
ombros`. Um sinal em LIBRAS é definido por quatro parâmetros — configuração da mão, **locação**,
movimento e orientação — e a referência do corpo é o que permite distinguir a mão na boca, na
testa ou no peito.

**2. Normalização por sequência** (`config.normalizar_sequencia`). As coordenadas das mãos são
re-expressas em relação ao nariz, em unidades de largura de ombro, usando uma única referência
para os 30 frames. Isso remove o que não é sinal (onde a pessoa está na tela, a que distância da
câmera) e preserva os quatro parâmetros. A rede recebe um tensor `(30, 126)`.

**3. Classificação.** A LSTM devolve a probabilidade de cada classe. Existe uma classe negativa
`OUTRO`, treinada com janelas de transição e com sinais fora do vocabulário: sem ela o modelo é
obrigado a encaixar qualquer gesto no sinal mais parecido. Uma glossa só é aceita acima de
**0,95** de confiança e depois de se manter estável por alguns décimos de segundo.

**4. Reconhecimento contínuo por tempo** (`reconhecedor.py`). A janela analisada é sempre o
**último 1 segundo**, reamostrado para 30 frames — o mesmo ritmo do treino. Por isso o
reconhecimento funciona igual numa webcam a 10 ou a 30 FPS.

**5. Tradução com verificação** (`traducao.py`). As glossas vão para o Gemma numa thread separada,
para não congelar a câmera. Antes de exibir, a frase é conferida contra os sinais: toda glossa
precisa aparecer, nenhuma negação pode ser inventada e nenhum outro sinal do vocabulário pode ser
acrescentado. Se falhar, o sistema tenta uma vez com um pedido reforçado e, se ainda assim falhar,
mostra as glossas cruas — um tradutor que diz outra coisa é pior do que não traduzir.

---

## 📂 Estrutura do projeto

```
tradutor-libras/
├── config.py               # ⭐ Configuração central (sinais, caminhos, normalização)
├── extracao.py             # Extrai as 129 coordenadas de um frame (mãos + pose)
├── enquadramento.py        # Simula a pessoa sentada perto da webcam do notebook
│
│   # dados
├── coletor_dados.py        # Coleta sinais pela webcam, em clipes guiados
├── processador_videos.py   # Extrai coordenadas de vídeos .mp4 → .npy
├── importar_malta.py       # Importa o dataset MALTA-LIBRAS (Hugging Face)
├── augment_total.py        # Data augmentation (espelho, rotação, time-warp)
│
│   # treino e avaliação
├── treinal_modelo.py       # Treina a LSTM → modelo_libras_v2.keras + labels_v2.json
├── validacao_cruzada.py    # Leave-one-signer-out, em pé e sentado
├── testar_tradutor.py      # Testa o fluxo contínuo sem webcam, com vídeos reais
├── testar_verificador.py   # Testa o verificador de frases (36 casos)
│
│   # aplicação
├── tradutor_final.py       # Tradutor em tempo real (webcam)
├── reconhecedor.py         # Glossas a partir do fluxo de frames
├── traducao.py             # Gemma em segundo plano + verificação da frase
├── interface.py            # Desenho da janela (identidade visual do projeto)
├── gravador.py             # Grava a janela em MP4, para demonstrações
├── Modelfile               # Modelo Gemma customizado (Ollama)
│
├── site/                   # Página do projeto (Vite + React)
├── docs/roteiro-video.md   # Roteiro do vídeo de demonstração
├── assets/fontes/          # Atkinson Hyperlegible Next (licença própria)
│
├── videos_baixados/        # Vídeos-fonte por sinal (entrada do processador)
├── DATA_V2/                # Dataset de coordenadas (.npy), uma pasta por sinal
├── modelo_libras_v2.keras  # Pesos da LSTM treinada
└── labels_v2.json          # Ordem das classes usada no treino
```

> Para adicionar um sinal novo, edite **apenas** a lista `ACTIONS` em `config.py` —
> todos os scripts importam de lá.

> ⚠️ Dados (`DATA_V2/`, `*.npy`), modelos (`*.keras`, `*.task`), gravações e o `venv/` são
> ignorados pelo Git. O repositório versiona o código e alguns vídeos-fonte.

> O sufixo `_v2` marca a representação com referência do corpo. Arquivos sem o sufixo são do
> formato antigo (só mãos) e **não** são compatíveis.

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

Os modelos do MediaPipe (`hand_landmarker.task` e `pose_landmarker_lite.task`) são baixados
automaticamente na primeira execução.

### Modelo de tradução (Ollama)

O tradutor usa um modelo Gemma customizado definido no `Modelfile`. Crie-o uma vez:

```bash
ollama create ponte-libras -f Modelfile
```

> O `Modelfile` parte de `gemma3:4b`. O Ollama baixará o modelo base automaticamente na primeira
> vez. Em máquinas com pouca memória livre, `gemma3:1b` responde mais rápido com alguma perda de
> fluência — basta trocar a linha `FROM`.

---

## 🚀 Uso

### 1. Obter dados de treino

**a) Pela webcam**, com o coletor guiado:

```bash
python coletor_dados.py
```

Ao abrir, ele pergunta o seu nome, que identifica quem gravou. Cada gravação é um clipe de 4
segundos guiado na tela (abaixe as mãos, faça o sinal, abaixe as mãos de novo), reamostrado para
30 FPS pelo relógio. O sinal é localizado pelo movimento dentro da fase do sinal e vira três
exemplos; o começo e o fim viram exemplos da classe `OUTRO` só se forem repouso de verdade. O
clipe inteiro fica guardado em `DATA_V2/_clipes`.

Teclas: **Espaço** grava, **N**/**P** trocam de sinal, **Z** desfaz a última gravação e **Q** sai.

**b) A partir de vídeos** — coloque arquivos `.mp4` em `videos_baixados/<SINAL>/` e extraia:

```bash
python processador_videos.py
# Gera os .npy correspondentes em DATA_V2/<SINAL>/
```

**c) A partir do MALTA-LIBRAS** (Hugging Face), que agrega vários dicionários de LIBRAS:

```bash
python importar_malta.py
```

### 2. Aumentar o dataset (opcional, recomendado)

Cria variações (espelhamento, rotação, time-warp e jitter) que sobrevivem à normalização:

```bash
python augment_total.py
```

### 3. Treinar o modelo

```bash
python treinal_modelo.py
# → modelo_libras_v2.keras + labels_v2.json
```

### 4. Avaliar com honestidade

```bash
python validacao_cruzada.py
# Leave-one-signer-out: a pessoa de teste nunca aparece no treino
```

### 5. Traduzir em tempo real

Inicie o Ollama, depois rode o tradutor:

```bash
python tradutor_final.py
# Espaço: traduzir as glossas com o Gemma
# C: limpar a frase  •  R: gravar a janela em MP4  •  Q: sair
```

---

## 🧠 Detalhes técnicos

| Componente        | Configuração                                                   |
|-------------------|----------------------------------------------------------------|
| Rastreamento      | MediaPipe Hand Landmarker (`num_hands=2`) + Pose Landmarker    |
| Vetor por frame   | 129 valores (126 das mãos + nariz_x, nariz_y, largura de ombros) |
| Entrada da rede   | `(30 frames, 126)` após normalizar pelo corpo                  |
| Arquitetura       | 2× LSTM (64→64) + Dropout(0.3) + Dense(32) + softmax           |
| Treino            | Adam, `categorical_crossentropy`, 150 épocas, batch 8, pesos de classe |
| Threshold         | 0.95 de confiança, com estabilidade mínima, e veto da classe `OUTRO` |
| Janela            | último 1 s reamostrado para 30 frames (independente do FPS)    |
| Tradução          | Ollama `ponte-libras` (Gemma 3 4B), `temperature=0`, em thread separada |

### Vocabulário atual

`OI` (duas variantes: datilologia O-I e aceno, treinadas como classes separadas e mostradas com a
mesma glossa), `GOSTAR`, `LARANJA`, `ABACAXI`, `BANANA`, `MORANGO`, `ACONTECER`, `AMARELO`,
`BANHEIRO`, `MEDO`, `BOM`, mais a classe negativa `OUTRO`.

---

## 📊 Resultados atuais

Validação cruzada **leave-one-signer-out** (3 folds): em cada fold, uma pessoa inteira fica fora do
treino e só aparece no teste. As gravações do autor (`pessoa-*`) ficam sempre no treino, para que o
número meça a generalização para **sinalizantes das bases públicas**, não para quem gravou o
dataset. A coluna "sentado" aplica `enquadramento.simular_sentado()` às mesmas amostras de teste:
a câmera do notebook corta na altura do peito e a mão que desce sai do quadro.

**Acurácia média geral: 56,1% em pé | 42,2% sentado** (13 classes, chute aleatório ≈ 7,7%).

| Sinal | Em pé | Sentado | Pessoas no dataset |
|---|---|---|---|
| AMARELO | 89% | 89% | 8 |
| LARANJA | 83% | 83% | 9 |
| OI (datilologia) | 79% | 81% | 8 |
| BOM | 78% | 78% | 8 |
| OUTRO | 66% | 67% | 76 |
| MORANGO | 62% | 50% | 3 |
| GOSTAR | 62% | 19% | 4 |
| MEDO | 56% | 48% | 8 |
| ACONTECER | 44% | 11% | 8 |
| ABACAXI | 42% | 2% | 3 |
| BANHEIRO | 37% | 4% | 8 |
| OI (aceno) | 17% | 17% | 1 |
| BANANA | 14% | 0% | 3 |

Leitura dos números:

- A correlação com a **quantidade de pessoas** no treino é direta: os sinais com 8 ou 9
  sinalizantes estão entre os melhores; os com 3 ou 4 (frutas, GOSTAR) são os piores. O gargalo é
  diversidade de dados, não arquitetura.
- **OI (aceno)** tem uma única fonte — é uma variante que quase não aparece nas bases públicas.
- **Sentado** derruba justamente os sinais feitos na altura da cintura ou do peito (ACONTECER,
  ABACAXI, BANHEIRO, GOSTAR), que saem do enquadramento da webcam do notebook.
- Cada treino começa de pesos aleatórios, então os números oscilam alguns pontos entre execuções.
  Com 3 folds e poucos sinalizantes, diferença de ~10 pontos num sinal isolado é ruído.

No fluxo contínuo simulado (`testar_tradutor.py`): 5/5 sinais conhecidos reconhecidos sem "caronas",
repouso em silêncio e 1 glossa indevida em 2 vídeos de sinais desconhecidos. O verificador de
frases passa em 36/36 casos (`testar_verificador.py`).

### Histórico da metodologia

Bom material de TCC — a maior parte do ganho veio de corrigir a **avaliação**, não o modelo:

| Etapa | Acurácia honesta | O que mudou |
|---|---|---|
| Primeira medição | "100%" | Ilusão: augmentation **antes** do split (data leakage) |
| Split por grupo | 33% | Teste = sinalizante nunca visto. O baseline real |
| Normalização por sequência | 48,5% | Preserva locação e movimento (antes eram destruídos) |
| Mais sinalizantes (MALTA) | 54,3% | OI foi de 0% a 81% com 8 pessoas |
| Referência do corpo (v2) | 57,5% | Locação: LARANJA +21pp, ABACAXI +28pp, BOM +24pp |
| Exemplos sentados no treino | 65,9% / 56,9% | Medida na época, com `pessoa-*` também no teste |
| Métrica atual | 56,1% / 42,2% | Métrica mais dura: `pessoa-*` só no treino, e a nova classe OI_ACENO (1 pessoa) entra na média |

> A queda na última linha **não é regressão do modelo**: é a régua que ficou mais honesta. Antes, as
> gravações do autor podiam cair no teste — e reconhecer quem gravou o dataset é bem mais fácil do
> que reconhecer um estranho.

Achado que orientou a v2: os sinais localizados na **região da boca** (frutas, BOM) se confundiam
entre si porque a locação era o parâmetro discriminante e o pipeline antigo, ancorado no pulso, não
a capturava.

---

## ⚠️ Limitações conhecidas

- **Poucos sinalizantes** em boa parte dos sinais (3 a 4 nas frutas e em GOSTAR, 1 em OI_ACENO).
  É a melhoria de maior impacto disponível.
- **BANANA** está perto de 0%: além de ter 3 fontes, é um sinal de movimento curto que a janela de
  1 segundo captura mal.
- `grupo_origem()` **não reconhece o padrão de nome do V-LIBRASIL** (`vlibrasil_art1_oi.mp4.npy`),
  que cai no fallback do nome do arquivo. Dentro de uma classe os três sinalizantes ficam
  separados corretamente, mas a mesma pessoa não é identificada **entre** classes — então ela pode
  estar no teste de um sinal e no treino de outro. Corrigir isso deve baixar um pouco os números
  atuais e torná-los mais honestos.
- A validação durante o treino reusa o conjunto de teste (aceitável com poucos dados; o ideal é um
  conjunto de validação separado quando o dataset crescer).
- O reconhecimento é de **sinais isolados**, não de LIBRAS em contexto: não há expressão facial
  (um parâmetro gramatical da língua), nem concordância verbal, nem uso do espaço de sinalização.
- **Não substitui intérprete humano.** É uma ponte para situações do dia a dia em que hoje não há
  ninguém para interpretar.

---

## 🗺️ Próximos passos

- [x] Centralizar a lista de sinais e os hiperparâmetros em `config.py` + `labels_v2.json`
- [x] Unificar a captura (mãos + corpo) em todas as fontes de dados
- [x] Split por grupo no treino e validação cruzada leave-one-signer-out
- [x] Normalização por sequência (locação e movimento preservados)
- [x] Classe negativa `OUTRO` para gestos fora do vocabulário
- [x] Reconhecimento por tempo, independente do FPS da webcam
- [x] Verificação da frase do Gemma contra os sinais detectados
- [x] Robustez para a pessoa **sentada** na webcam do notebook
- [ ] Mais sinalizantes por sinal (gravações próprias e parcerias) — maior impacto
- [ ] Identificar o sinalizante do V-LIBRASIL entre classes em `grupo_origem()`
- [ ] Conjunto de validação separado do teste
- [ ] Expandir o vocabulário

---

## 🤝 Contribuindo

O projeto nasceu de um TCC, mas o objetivo é servir a quem usa LIBRAS. Duas formas de ajudar valem
mais do que qualquer ajuste de código:

1. **Gravar sinais** — mais pessoas diferentes no dataset é, hoje, a melhoria de maior impacto.
2. **Revisar os sinais** com quem é surdo ou intérprete: variantes regionais e erros de execução
   nos vídeos-fonte são um risco real.

Issues e Pull Requests são bem-vindos. A branch `main` é protegida e as mudanças entram por PR.

---

## 📄 Licença

Código sob licença MIT (veja `LICENSE`), de Pedro Henrique Santos.

A fonte Atkinson Hyperlegible Next, em `assets/fontes/`, tem licença própria (SIL Open Font
License, veja `assets/fontes/OFL.txt`). Os vídeos de treino pertencem às bases públicas citadas
(V-LIBRASIL, MINDS-Libras, MALTA-LIBRAS) e não são redistribuídos aqui.
