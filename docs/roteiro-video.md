# Roteiro do vídeo de demonstração do Ponte Libras

Duração-alvo: **60 a 90 segundos**, sem áudio. Toda a informação vai em
legendas escritas na tela, porque o vídeo precisa funcionar para quem é surdo.

## Antes de gravar

**Ambiente**
- Luz vindo de frente para você (janela ou luminária atrás do notebook). Luz
  por trás deixa as mãos escuras e o sistema perde os dedos.
- Fundo liso, sem outras pessoas passando.
- Roupa lisa, de cor que contraste com a pele. Evite estampas.
- Enquadramento da cabeça até a cintura, a cerca de 1 metro da câmera. As mãos
  precisam ficar dentro do quadro durante todo o sinal.
- Notebook apoiado firme, sem mexer durante a gravação.

**Computador**
- Feche os outros programas (o Mac tem 8 GB e o Gemma usa 3,3 GB).
- Abra o tradutor e faça **uma tradução de aquecimento** antes de gravar. A
  primeira chamada ao Gemma é a mais lenta, porque ele carrega o modelo na
  memória.
- Confira o FPS no canto superior direito: acima de 12 está bom.

**Ensaio**
- Assista aos vídeos de referência dos sinais e treine cada um algumas vezes:

  ```bash
  open videos_baixados/oi/vlibrasil_art1_oi.mp4 videos_baixados/banheiro/minds_s02_r1_banheiro.mp4
  ```

- Faça a sequência inteira sem gravar, para ver se o Gemma produz uma frase
  boa com as glossas escolhidas. Se a frase sair estranha, me avise antes de
  gravar.
- Teste dois ou três gestos que não são sinais (cena 5) e escolha um que o
  sistema ignore de forma consistente.

## Como gravar

1. Rode o tradutor:

   ```bash
   cd /Users/pedrin_047/Documents/tradutor-libras && ./venv/bin/python tradutor_final.py
   ```

2. Aperte **R** para começar a gravar. Aparece "GRAVANDO 00:00" no canto da
   tela; essa marca **não vai para o vídeo**, é só para você.
3. Siga as cenas abaixo.
4. Aperte **R** de novo para parar. O terminal mostra onde o arquivo foi salvo
   (pasta `gravacoes/`).
5. Grave **3 ou 4 vezes inteiras**. Cada R começa um arquivo novo, e depois
   escolhemos a melhor.

Entre um sinal e outro, **baixe as mãos para fora do quadro**. Isso zera o
reconhecedor e evita que o movimento de transição vire uma glossa.

## Cenas

| # | Tempo | O que você faz | Legenda na tela |
|---|---|---|---|
| 1 | 0–8 s | Fica parado, de frente para a câmera, mãos abaixadas. | Ponte Libras reconhece sinais de Libras pela webcam, num notebook comum e sem internet. |
| 2 | 8–20 s | Faz **OI** (letras O e I, perto do rosto) e baixa as mãos. | Os pontos verdes são as mãos que o sistema enxerga. Ao reconhecer o sinal, a glossa OI aparece embaixo. |
| 3 | 20–35 s | Faz **BANHEIRO** e baixa as mãos. | Cada sinal reconhecido entra na sequência de glossas, que é a forma escrita dos sinais. |
| 4 | 35–55 s | Aperta **Espaço** e espera a frase aparecer na barra de cima. | Um modelo de linguagem, rodando no próprio computador, escreve a frase em português. |
| 5 | 55–68 s | Aperta **C** para limpar e faz um gesto que não é sinal (o que você escolheu no ensaio). | Gestos que não fazem parte do vocabulário não viram tradução. |
| 6 | 68–80 s | Tela final (eu monto na edição). | Protótipo de TCC em Engenharia de Software, Católica de Santa Catarina. Quer ajudar a melhorar o sistema? Grave sinais com a gente. + endereço do projeto |

Os tempos são aproximados. Não precisa cronometrar: faça cada cena com calma
que eu ajusto na edição.

## Se algo der errado durante a gravação

- **O sistema errou um sinal:** não pare. Um erro real, com uma legenda
  explicando, combina com o que o site diz sobre os resultados. Se preferir,
  usamos outro take.
- **O Gemma demorou muito:** tudo bem. Eu encurto a espera na edição e coloco
  uma legenda avisando que o tempo foi encurtado, para não dar impressão falsa
  de velocidade.
- **Na cena 5 o sistema inventou uma glossa:** é uma limitação conhecida. Ou
  trocamos o gesto, ou mantemos com a legenda "Às vezes o sistema ainda
  confunde gestos desconhecidos com sinais. É uma das limitações em estudo."

## Depois de gravar

Me diga o nome dos arquivos (ou só "gravei") e eu:
1. escolho com você o melhor take;
2. corto as esperas e monto a tela final;
3. coloco as legendas embutidas no vídeo (funcionam em qualquer lugar: site,
   formulário, redes sociais);
4. converto para o formato que o navegador toca e gero uma imagem de capa;
5. coloco no site, com uma descrição em texto do que acontece no vídeo.

## Observação sobre o espelho

A janela do tradutor é espelhada, como um espelho de verdade, para ficar
natural para quem sinaliza. O vídeo grava a janela como ela aparece, então quem
assistir vê a sua mão direita do lado direito da tela. Em Libras isso não muda
o sinal, só a mão que parece dominante.

## Opcional, mas recomendado

Se conseguir, mostre o vídeo para uma pessoa surda ou intérprete de Libras
antes de publicar, para conferir se os sinais estão bem executados e se as
legendas fazem sentido para quem vai assistir.
