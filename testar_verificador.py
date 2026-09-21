"""
Testa o verificador de frases (traducao.verificar) com respostas REAIS que o
Gemma 4B e o Gemma 1B deram nas comparações do projeto.

Uso: ./venv/bin/python testar_verificador.py
"""
from traducao import Traducao, traduzir, verificar

# (glossas, frase, deve passar?)
CASOS = [
    # Gemma 4B: frases corretas, precisam passar
    ("OI", "Oi!", True),
    ("OI GOSTAR AMARELO", "Oi, eu gosto de amarelo.", True),
    ("OI GOSTAR AMARELO", "Oi, eu gosto da cor amarela.", True),
    ("GOSTAR LARANJA", "Eu gosto de laranja.", True),
    ("OI BOM", "Oi, bom!", True),
    ("OI BOM", "Oi, bom dia.", True),
    ("BANHEIRO", "Vai ao banheiro.", True),
    ("MEDO", "Eu sinto medo.", True),
    ("MEDO ACONTECER", "Eu tenho medo de acontecer.", True),
    ("GOSTAR BANANA MORANGO", "Eu gosto de banana e morango.", True),
    ("AMARELO LARANJA", "As cores amarelo e laranja.", True),
    ("OI BANHEIRO", "Oi, onde fica o banheiro?", True),
    ("AMARELO BANANA", "A banana é amarela.", True),
    ("ABACAXI BOM", "O abacaxi está bom.", True),
    ("ACONTECER", "Aconteceu.", True),
    ("MEDO BANHEIRO", "Eu tenho medo do banheiro.", True),
    # Gemma 1B: frases que trocam, apagam ou invertem o que foi sinalizado
    ("GOSTAR LARANJA", "Eu quero maçã.", False),
    ("BANHEIRO", "Eu vou para casa.", False),
    ("BANHEIRO", "Eu preciso de banho.", False),
    ("MEDO ACONTECER", "Ame Deus, tem medo.", False),
    ("MEDO ACONTECER", "Não há medo de acontecer.", False),
    ("OI GOSTAR AMARELO", "Ótimo! Gostaria de comer.", False),
    ("AMARELO LARANJA", "Amo laranja.", False),
    ("AMARELO LARANJA", "A cor.", False),
    ("AMARELO BANANA", "Comi banana.", False),
    ("OI BANHEIRO", "Olá!", False),
    ("OI BOM", "OI", False),
    ("MEDO BANHEIRO", "Eu tenho medo.", False),
    ("GOSTAR BANANA MORANGO", "Quero banana, quero morango.", False),
    # Gemma 4B também erra às vezes: apagou o OI, acrescentou GOSTAR
    ("OI GOSTAR BANANA", "Eu gosto de banana.", False),
    ("AMARELO BANANA", "Eu gosto de banana amarela.", False),
    ("OI", "Oi, bom dia!", False),
    # Negação só é aceita se NÃO foi sinalizado
    ("NÃO GOSTAR BANANA", "Eu não gosto de banana.", True),
]

falhas = 0
for glossas, frase, esperado in CASOS:
    problemas = verificar(glossas.split(), frase)
    passou = not problemas
    ok = passou == esperado
    falhas += not ok
    marca = "ok " if ok else "ERRO"
    print(f"{marca} {glossas:22s} {frase!r:34s} {'passa' if passou else 'barra: ' + ', '.join(problemas)}")

# traduzir(): nova tentativa com pedido reforçado e recuo para as glossas
chamadas = []
def modelo_falso(respostas):
    def chamar(glossas, reforco=False):
        chamadas.append(reforco)
        return respostas[len(chamadas) - 1]
    return chamar

chamadas.clear()
t = traduzir(["OI", "GOSTAR", "BANANA"], chamar=modelo_falso(["Eu gosto de banana.", "Oi, eu gosto de banana."]))
cenario1 = t == Traducao(["OI", "GOSTAR", "BANANA"], "Oi, eu gosto de banana.", True) and chamadas == [False, True]

chamadas.clear()
t = traduzir(["GOSTAR", "LARANJA"], chamar=modelo_falso(["Eu quero maçã.", "Eu quero pera."]))
cenario2 = t == Traducao(["GOSTAR", "LARANJA"], "GOSTAR LARANJA", False) and chamadas == [False, True]

chamadas.clear()
t = traduzir(["OI"], chamar=modelo_falso(["Erro: conexão recusada"]))
cenario3 = t.erro and len(chamadas) == 1

for nome, ok in [("corrige na segunda tentativa", cenario1), ("recua para as glossas", cenario2),
                 ("erro do Ollama não tenta de novo", cenario3)]:
    falhas += not ok
    print(f"{'ok ' if ok else 'ERRO'} traduzir(): {nome}")

print(f"\n{len(CASOS) + 3 - falhas}/{len(CASOS) + 3} verificações corretas")
raise SystemExit(1 if falhas else 0)
