import json
import sys
import time
import cv2
from pathlib import Path
from tensorflow.keras.models import load_model

from config import MODELO_LSTM, LABELS_JSON
from extracao import Extrator
from gravador import Gravador
from interface import EstadoTela, Interface
from reconhecedor import ReconhecedorContinuo
from traducao import TradutorEmSegundoPlano, pre_carregar

# --- CARREGA O MODELO E AS CLASSES DO TREINO ---
if not Path(MODELO_LSTM).exists() or not Path(LABELS_JSON).exists():
    print("❌ Modelo não encontrado. Rode primeiro: python treinal_modelo.py")
    sys.exit(1)

model_lstm = load_model(MODELO_LSTM)

# A ordem das classes vem do arquivo salvo NO TREINO — assim a predição
# (que é só um índice) sempre aponta para o nome certo.
with open(LABELS_JSON, encoding='utf-8') as f:
    ACTIONS = json.load(f)

# --- EXTRATOR (mãos + referência do corpo) ---
# Modo vídeo: rastreia as mãos entre frames. A pose roda a cada 3 frames
# (o tronco quase não se move) para não derrubar o FPS.
extrator = Extrator(modo_video=True, conf_mao=0.7, pose_cada=3)

# --- RECONHECEDOR CONTÍNUO (filtros contra falsos positivos) ---
# A lógica de decisão mora em reconhecedor.py, compartilhada com os testes.
rec = ReconhecedorContinuo(model_lstm, ACTIONS, estabilidade=8, min_frames_com_mao=15)

# --- VARIÁVEIS DE ESTADO ---
cap = cv2.VideoCapture(0)
traducao_final_tela = ""
t_inicio = time.monotonic()
t_anterior = t_inicio
fps_medio = 0.0
gravador = Gravador()
interface = Interface()
cv2.namedWindow('Ponte Libras', cv2.WINDOW_NORMAL)
# A tradução roda fora do loop da câmera, que não trava enquanto o Gemma pensa
tradutor = TradutorEmSegundoPlano()
pre_carregar()


def mostrar(quadro):
    """Exibe o quadro; a marca de gravação vai numa cópia, fora do vídeo."""
    if gravador.gravando:
        quadro = quadro.copy()
        interface.desenhar_gravacao(quadro, gravador.duracao)
    cv2.imshow('Ponte Libras', quadro)


print("\n🚀 PONTE LIBRAS - SISTEMA RODANDO")
print(f"Sinais conhecidos: {', '.join(ACTIONS)}")
print("Espaço: Traduzir (Gemma) | C: Limpar Tela | R: Gravar vídeo | Q: Sair\n")

while cap.isOpened():
    success, image = cap.read()
    if not success: break

    image_h, image_w = image.shape[:2]

    agora = time.monotonic()
    t = agora - t_inicio
    dt = agora - t_anterior
    t_anterior = agora
    if dt > 0:
        fps_medio = 0.9 * fps_medio + 0.1 * (1.0 / dt) if fps_medio else 1.0 / dt

    # As coordenadas saem da imagem ORIGINAL (mesma orientação dos vídeos de
    # treino); o espelho é só para a tela ficar natural para quem sinaliza
    current_coords, maos = extrator.extrair(image, int(t * 1000))
    image = cv2.flip(image, 1)

    interface.desenhar_maos(image, maos)

    # O horário do frame vai junto: a janela do reconhecedor é o último
    # 1 segundo, qualquer que seja o FPS desta máquina
    rec.processar(current_coords, t)

    frase = tradutor.frase_pronta()
    if frase is not None:
        traducao_final_tela = frase

    interface.desenhar(image, EstadoTela(
        glossas=rec.glossas,
        candidata=rec.candidata,
        confianca=rec.conf_atual,
        progresso=rec.votos / rec.estabilidade,
        frase=traducao_final_tela,
        processando=tradutor.ocupado,
        fps=fps_medio,
    ))

    # O quadro vai para o arquivo antes da marca de gravação ser desenhada
    gravador.escrever(image)
    mostrar(image)

    # --- CONTROLES DO TECLADO ---
    key = cv2.waitKey(1) & 0xFF
    if key == ord('q'):
        break
    elif key == ord('r'):
        if gravador.gravando:
            caminho, duracao = gravador.parar()
            print(f"⏹  Gravação salva: {caminho} ({duracao:.0f} s)")
        else:
            gravador.iniciar(image_w, image_h)
            print(f"⏺  Gravando em {gravador.caminho} (R para parar)")
    elif key == ord('c'):
        tradutor.descartar()
        rec.limpar()
        traducao_final_tela = ""
    elif key == ord(' ') and rec.glossas and not tradutor.ocupado:
        tradutor.pedir(rec.glossas)
        traducao_final_tela = ""
        # Limpa as glossas: a próxima frase já pode ser sinalizada enquanto
        # o Gemma escreve esta
        rec.limpar()

if gravador.gravando:
    caminho, duracao = gravador.parar()
    print(f"⏹  Gravação salva: {caminho} ({duracao:.0f} s)")
cap.release()
extrator.close()
cv2.destroyAllWindows()
