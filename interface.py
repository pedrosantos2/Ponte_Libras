"""
Interface da janela do tradutor, com a mesma identidade do site: azul-turquesa
(cor de orgulho da comunidade surda), fonte Atkinson Hyperlegible Next e a mão
desenhada como no topo da página.

O texto é desenhado com o Pillow, que usa a fonte do projeto. Cada painel é
renderizado só quando o conteúdo muda e reaproveitado nos quadros seguintes,
para não pesar no FPS.
"""
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

PASTA_FONTES = Path(__file__).parent / "assets" / "fontes"

# Cores em RGB (Pillow) e BGR (OpenCV)
TURQUESA = (31, 193, 200)
TINTA = (4, 38, 44)
BRANCO = (255, 255, 255)
APAGADO = (159, 196, 200)
ALERTA = (255, 180, 160)
VERMELHO = (229, 72, 77)


def _bgr(rgb):
    return rgb[::-1]


# Ligações entre os 21 pontos de cada mão, na convenção do MediaPipe
LIGACOES = [
    (0, 1), (1, 2), (2, 3), (3, 4), (0, 5), (5, 6), (6, 7), (7, 8),
    (5, 9), (9, 10), (10, 11), (11, 12), (9, 13), (13, 14), (14, 15), (15, 16),
    (13, 17), (17, 18), (18, 19), (19, 20), (0, 17),
]


@dataclass
class EstadoTela:
    glossas: list = field(default_factory=list)
    candidata: str = ""
    confianca: float = 0.0
    progresso: float = 0.0     # 0 a 1: quanto falta para a glossa ser aceita
    frase: str = ""
    processando: bool = False
    aviso: str = ""            # ex.: a frase não conferiu com os sinais
    fps: float = 0.0


class Interface:
    def __init__(self):
        self._fontes = {}
        self._pilulas = {}
        self._painel_chave = None
        self._painel = None
        self._largura_fps = 0
        self._textos = {}
        self._barra = None   # geometria da barra de progresso no painel (px finais)

    # ---------- utilidades ----------
    def _fonte(self, peso, tamanho):
        chave = (peso, tamanho)
        if chave not in self._fontes:
            caminho = PASTA_FONTES / f"AtkinsonHyperlegibleNext-{peso}.ttf"
            try:
                self._fontes[chave] = ImageFont.truetype(str(caminho), tamanho)
            except OSError:
                self._fontes[chave] = ImageFont.load_default(tamanho)
        return self._fontes[chave]

    @staticmethod
    def _largura(fonte, texto):
        return fonte.getlength(texto)

    @staticmethod
    def _colar(quadro, camada, x, y):
        """Cola uma camada sobre o quadro, respeitando a transparência e as
        bordas. A camada guarda a cor já multiplicada pelo alfa e o
        complemento do alfa, então a mistura são duas operações do OpenCV."""
        cor, resto = camada
        h, w = cor.shape[:2]
        H, W = quadro.shape[:2]
        if x >= W or y >= H or x + w <= 0 or y + h <= 0:
            return
        x0, y0 = max(x, 0), max(y, 0)
        x1, y1 = min(x + w, W), min(y + h, H)
        fatia = (slice(y0 - y, y1 - y), slice(x0 - x, x1 - x))
        roi = quadro[y0:y1, x0:x1]
        roi[:] = cv2.add(cv2.multiply(roi, resto[fatia], scale=1 / 255), cor[fatia])

    @staticmethod
    def _para_camada(img, tamanho):
        """Imagem RGBA do Pillow, desenhada em dobro, -> camada no tamanho
        final. Reduzir pela metade suaviza cantos e curvas (o Pillow desenha
        formas sem antisserrilhado)."""
        arr = np.array(img.resize(tamanho, Image.LANCZOS)).astype(np.float32)
        alfa = arr[:, :, 3:4] / 255.0
        cor = (arr[:, :, [2, 1, 0]] * alfa).round().astype(np.uint8)
        resto = np.repeat(((1.0 - alfa) * 255).round().astype(np.uint8), 3, axis=2)
        return cor, resto

    def _pilula(self, texto, s, peso=700, cor=BRANCO, ponto=None):
        """Etiqueta arredondada sobre fundo escuro semitransparente."""
        chave = (texto, s, peso, cor, ponto)
        if chave in self._pilulas:
            return self._pilulas[chave]
        final = s
        s = 2 * s
        fonte = self._fonte(peso, round(17 * s))
        px, py = round(14 * s), round(8 * s)
        extra = round(18 * s) if ponto else 0
        w = round(self._largura(fonte, texto)) + 2 * px + extra
        h = round(17 * s * 1.25) + 2 * py
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.rounded_rectangle((0, 0, w - 1, h - 1), radius=h // 2, fill=(*TINTA, 205))
        if ponto:
            r = round(5 * s)
            cx, cy = px + r, h // 2
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=ponto)
        d.text((px + extra, h // 2), texto, font=fonte, fill=cor, anchor="lm")
        if len(self._pilulas) > 64:
            self._pilulas.clear()
        self._pilulas[chave] = self._para_camada(img, (round(w * final / s), round(h * final / s)))
        return self._pilulas[chave]

    # ---------- mãos ----------
    def desenhar_maos(self, quadro, maos):
        """Desenha o esqueleto das mãos. O quadro exibido é espelhado, então
        o x de cada ponto também é."""
        H, W = quadro.shape[:2]
        s = H / 720
        grossura = max(2, round(2.2 * s))
        raio = max(2, round(3.2 * s))
        for mao in maos:
            pts = [(int((1 - lm.x) * W), int(lm.y * H)) for lm in mao]
            for a, b in LIGACOES:
                cv2.line(quadro, pts[a], pts[b], _bgr(TURQUESA), grossura, cv2.LINE_AA)
            for i, p in enumerate(pts):
                cv2.circle(quadro, p, raio + (2 if i == 0 else 0), _bgr(BRANCO), -1, cv2.LINE_AA)

    # ---------- painel inferior ----------
    def _montar_painel(self, estado, largura_final, s):
        largura = 2 * largura_final
        s = 2 * s
        pad = round(24 * s)
        tam_chip = round(18 * s)
        tam_frase = round(32 * s)
        alto_chips = round(tam_chip * 1.25) + 2 * round(6 * s)
        altura = pad + alto_chips + round(16 * s) + round(tam_frase * 1.3) + pad
        img = Image.new("RGBA", (largura, altura), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.rounded_rectangle((0, 0, largura - 1, altura - 1), radius=round(20 * s), fill=(*TINTA, 228))

        # teclas, na coluna da direita
        teclas = [("Espaço", "traduzir"), ("C", "limpar"), ("R", "gravar"), ("Q", "sair")]
        f_tecla = self._fonte(700, round(14 * s))
        f_rotulo = self._fonte(400, round(14 * s))
        linha = round(22 * s)
        larg_tecla = round(self._largura(f_tecla, "Espaço")) + round(14 * s)
        larg_col = larg_tecla + round(8 * s) + round(self._largura(f_rotulo, "traduzir"))
        mostrar_teclas = largura > 760 * s
        limite_texto = largura - pad - (larg_col + round(28 * s) if mostrar_teclas else 0)
        if mostrar_teclas:
            x0 = largura - pad - larg_col
            y0 = (altura - linha * len(teclas)) // 2
            for i, (tecla, rotulo) in enumerate(teclas):
                y = y0 + i * linha
                d.rounded_rectangle((x0, y + round(2 * s), x0 + larg_tecla, y + linha - round(3 * s)),
                                    radius=round(4 * s), outline=APAGADO, width=max(1, round(s)))
                d.text((x0 + larg_tecla / 2, y + linha / 2), tecla, font=f_tecla, fill=BRANCO, anchor="mm")
                d.text((x0 + larg_tecla + round(8 * s), y + linha / 2), rotulo, font=f_rotulo,
                       fill=APAGADO, anchor="lm")

        # linha 1: glossas reconhecidas e a que está sendo reconhecida agora
        f_chip = self._fonte(800, tam_chip)
        cx, cy = pad, pad
        pchip_x = round(10 * s)
        chips = list(estado.glossas)
        larguras = [round(self._largura(f_chip, g)) + 2 * pchip_x for g in chips]
        reserva = 0
        if estado.candidata:
            reserva = round(self._largura(f_chip, estado.candidata)) + 2 * pchip_x + round(70 * s)
        # se não couber tudo, mostra as glossas mais recentes
        while chips and pad + sum(larguras) + round(8 * s) * len(chips) + reserva > limite_texto:
            chips.pop(0)
            larguras.pop(0)
        for g, w in zip(chips, larguras):
            d.rounded_rectangle((cx, cy, cx + w, cy + alto_chips), radius=round(6 * s), fill=TURQUESA)
            d.text((cx + w / 2, cy + alto_chips / 2), g, font=f_chip, fill=TINTA, anchor="mm")
            cx += w + round(8 * s)
        if estado.candidata:
            w = round(self._largura(f_chip, estado.candidata)) + 2 * pchip_x
            espessura = max(2, round(2 * s))
            d.rounded_rectangle((cx, cy, cx + w, cy + alto_chips), radius=round(6 * s),
                                outline=TURQUESA, width=espessura)
            d.text((cx + w / 2, cy + alto_chips / 2), estado.candidata, font=f_chip, fill=TURQUESA, anchor="mm")
            # trilho da barra de progresso; o preenchimento e a porcentagem
            # mudam a cada quadro e são desenhados por cima, fora do painel
            by = cy + alto_chips + round(5 * s)
            d.rounded_rectangle((cx, by, cx + w, by + round(4 * s)), radius=round(2 * s), fill=(*APAGADO, 70))
            self._barra = (cx // 2, by // 2, w // 2, max(2, round(4 * s) // 2),
                           (cx + w + round(10 * s)) // 2, round(cy + alto_chips / 2) // 2)
        else:
            self._barra = None
        if not chips and not estado.candidata and estado.aviso:
            d.text((pad, cy + alto_chips / 2), estado.aviso,
                   font=self._fonte(500, tam_chip), fill=ALERTA, anchor="lm")
        elif not chips and not estado.candidata and not estado.frase and not estado.processando:
            d.text((pad, cy + alto_chips / 2), "Faça um sinal em frente à câmera",
                   font=self._fonte(500, tam_chip), fill=APAGADO, anchor="lm")

        # linha 2: a frase em português, como uma legenda
        fy = pad + alto_chips + round(16 * s)
        if estado.processando:
            texto, cor, peso = "Escrevendo a frase…", APAGADO, 500
        elif estado.frase:
            texto, peso = estado.frase, 700
            cor = ALERTA if estado.frase.startswith("Erro") else BRANCO
        elif estado.glossas:
            texto, cor, peso = "Aperte Espaço para escrever a frase", APAGADO, 500
        else:
            texto, cor, peso = "", BRANCO, 700
        if texto:
            tamanho = tam_frase
            espaco = limite_texto - pad
            fonte = self._fonte(peso, tamanho)
            while self._largura(fonte, texto) > espaco and tamanho > round(20 * s):
                tamanho -= max(1, round(s))
                fonte = self._fonte(peso, tamanho)
            while self._largura(fonte, texto) > espaco and len(texto) > 4:
                texto = texto[:-2].rstrip() + "…"
            d.text((pad, fy), texto, font=fonte, fill=cor, anchor="lt")

        return self._para_camada(img, (largura_final, altura // 2))

    def _texto(self, texto, peso, tamanho, cor):
        """Texto solto como camada, em cache (ex.: a porcentagem de confiança)."""
        chave = (texto, peso, tamanho, cor)
        if chave not in self._textos:
            fonte = self._fonte(peso, 2 * tamanho)
            w = round(fonte.getlength(texto)) + 4
            h = round(2 * tamanho * 1.3)
            img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            ImageDraw.Draw(img).text((2, h // 2), texto, font=fonte, fill=cor, anchor="lm")
            if len(self._textos) > 256:
                self._textos.clear()
            self._textos[chave] = self._para_camada(img, (w // 2, h // 2))
        return self._textos[chave]

    # ---------- composição ----------
    def desenhar(self, quadro, estado):
        H, W = quadro.shape[:2]
        s = H / 720
        margem = round(20 * s)

        self._colar(quadro, self._pilula("Ponte Libras", s, peso=800), margem, margem)
        fps = self._pilula(f"{estado.fps:.0f} FPS", s, peso=500, cor=APAGADO)
        self._colar(quadro, fps, W - margem - fps[0].shape[1], margem)
        self._largura_fps = fps[0].shape[1]

        largura = W - 2 * margem
        chave = (tuple(estado.glossas), estado.candidata, estado.frase, estado.processando,
                 estado.aviso, largura, round(s, 3))
        if chave != self._painel_chave:
            self._painel = self._montar_painel(estado, largura, s)
            self._painel_chave = chave
        px, py = margem, H - margem - self._painel[0].shape[0]
        self._colar(quadro, self._painel, px, py)

        if self._barra and estado.candidata:
            bx, by, bw, bh, tx, ty = self._barra
            fim = bx + max(bh, round(bw * min(1.0, estado.progresso)))
            cv2.rectangle(quadro, (px + bx, py + by), (px + fim, py + by + bh - 1), _bgr(TURQUESA), -1)
            pct = self._texto(f"{estado.confianca:.0%}", 500, round(15 * s), APAGADO)
            self._colar(quadro, pct, px + tx, py + ty - pct[0].shape[0] // 2)

    def desenhar_gravacao(self, quadro, segundos):
        """Marca de gravação. Vai só na tela, nunca no arquivo gravado."""
        H, W = quadro.shape[:2]
        s = H / 720
        margem = round(20 * s)
        texto = f"Gravando {int(segundos) // 60:02d}:{int(segundos) % 60:02d}"
        pilula = self._pilula(texto, s, peso=700, ponto=VERMELHO)
        # fica à esquerda da etiqueta de FPS
        x = W - margem - self._largura_fps - round(10 * s) - pilula[0].shape[1]
        self._colar(quadro, pilula, x, margem)

    # ---------- coletor ----------
    def desenhar_coleta(self, quadro, sinal, pessoa, gravados, meta, fase="", progresso=0.0,
                        mensagem="", cor_mensagem=APAGADO):
        """Tela do coletor: sinal atual, contagem, fase da gravação e ajuda."""
        H, W = quadro.shape[:2]
        s = H / 720
        margem = round(20 * s)
        self._colar(quadro, self._pilula("Coletor do Ponte Libras", s, peso=800), margem, margem)
        quem = self._pilula(f"Gravando como: {pessoa}", s, peso=500, cor=APAGADO)
        self._colar(quadro, quem, W - margem - quem[0].shape[1], margem)

        largura = W - 2 * margem
        chave = ("coleta", sinal, gravados, meta, fase, mensagem, cor_mensagem, largura, round(s, 3))
        if chave != self._painel_chave:
            k = 2 * s
            L = 2 * largura
            pad = round(24 * k)
            altura = round(150 * k)
            img = Image.new("RGBA", (L, altura), (0, 0, 0, 0))
            d = ImageDraw.Draw(img)
            d.rounded_rectangle((0, 0, L - 1, altura - 1), radius=round(20 * k), fill=(*TINTA, 228))
            d.text((pad, pad), sinal, font=self._fonte(800, round(40 * k)), fill=TURQUESA, anchor="lt")
            d.text((pad, pad + round(54 * k)), f"{gravados} de {meta} gravações",
                   font=self._fonte(500, round(17 * k)), fill=APAGADO, anchor="lt")
            texto_fase = fase or "Aperte Espaço para gravar"
            d.text((round(L * 0.36), pad), texto_fase, font=self._fonte(700, round(30 * k)),
                   fill=BRANCO if fase else APAGADO, anchor="lt")
            if mensagem:
                d.text((round(L * 0.36), pad + round(54 * k)), mensagem,
                       font=self._fonte(500, round(17 * k)), fill=cor_mensagem, anchor="lt")
            ajuda = ["Espaço  gravar", "N / P  próximo / anterior", "Z  desfazer", "Q  sair"]
            for i, t in enumerate(ajuda):
                d.text((L - pad, pad + i * round(24 * k)), t, font=self._fonte(400, round(15 * k)),
                       fill=APAGADO, anchor="rt")
            self._painel = self._para_camada(img, (largura, altura // 2))
            self._painel_chave = chave
        px, py = margem, H - margem - self._painel[0].shape[0]
        self._colar(quadro, self._painel, px, py)
        if fase:
            # barra de progresso da gravação, na base do painel
            x0 = px + round(largura * 0.36)
            x1 = px + largura - round(24 * s)
            y = py + self._painel[0].shape[0] - round(26 * s)
            cv2.rectangle(quadro, (x0, y), (x1, y + round(6 * s)), (70, 70, 70), -1)
            cv2.rectangle(quadro, (x0, y), (x0 + round((x1 - x0) * min(1.0, progresso)), y + round(6 * s)),
                          _bgr(TURQUESA), -1)
