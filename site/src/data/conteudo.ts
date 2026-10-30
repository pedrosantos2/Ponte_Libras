// Conteúdo do site em um só lugar: atualizar números aqui, não nos componentes.

export const REPO_URL = 'https://github.com/pedrosantos2/Ponte_Libras'
// A plataforma (área com login) é um site separado, em app-plataforma/.
// No build de produção, defina VITE_PLATAFORMA_URL com o endereço dela.
export const PLATAFORMA_URL = import.meta.env.VITE_PLATAFORMA_URL ?? 'http://localhost:5174'

export const etapas = [
  { titulo: 'A câmera filma', texto: 'A pessoa sinaliza em frente à webcam de um notebook ou computador comum.' },
  { titulo: 'O sistema acha as mãos', texto: 'Localiza as duas mãos, o rosto e os ombros, e acompanha o movimento por um segundo.' },
  { titulo: 'A rede reconhece o sinal', texto: 'Uma rede neural treinada com vídeos de várias pessoas identifica qual sinal foi feito.' },
  { titulo: 'A frase sai em português', texto: 'Um modelo de linguagem reescreve a sequência de sinais como uma frase natural.' },
]

export const principios = [
  { titulo: 'Funciona sem internet', texto: 'Todo o processamento acontece no próprio computador, o que serve para lugares com conexão instável.' },
  { titulo: 'Não grava ninguém', texto: 'As imagens da câmera não são salvas nem enviadas para nenhum servidor.' },
  { titulo: 'Não precisa de placa de vídeo', texto: 'Foi desenvolvido num notebook com 8 GB de memória, sem placa de vídeo dedicada. Fazer funcionar em computadores mais simples é um dos próximos passos.' },
  { titulo: 'É de código aberto', texto: 'O código está publicado para quem quiser estudar, usar ou melhorar.' },
]

// Validação cruzada deixando uma pessoa de fora: o teste usa sempre alguém
// que o modelo nunca viu. "pessoas" = sinalizantes distintos no treino.
export const resultados = [
  { sinal: 'AMARELO', pessoas: 8, acerto: 81 },
  { sinal: 'OI', pessoas: 8, acerto: 75 },
  { sinal: 'BANHEIRO', pessoas: 8, acerto: 74 },
  { sinal: 'LARANJA', pessoas: 9, acerto: 71 },
  { sinal: 'MEDO', pessoas: 8, acerto: 67 },
  { sinal: 'ABACAXI', pessoas: 3, acerto: 61 },
  { sinal: 'BOM', pessoas: 7, acerto: 57 },
  { sinal: 'ACONTECER', pessoas: 8, acerto: 52 },
  { sinal: 'GOSTAR', pessoas: 4, acerto: 48 },
  { sinal: 'MORANGO', pessoas: 3, acerto: 27 },
]

export const proximosPassos = [
  { titulo: 'Gravar sinais com a comunidade surda e com estudantes de Libras', texto: 'Cada pessoa nova nos dados melhora o reconhecimento para todas as outras.' },
  { titulo: 'Ampliar o vocabulário', texto: 'Começando pelos sinais mais usados no dia a dia, na sala de aula e no trabalho, escolhidos junto com a comunidade surda, professores e intérpretes.' },
  { titulo: 'Funcionar em computadores mais simples', texto: 'Usar um modelo de linguagem menor, ou rodá-lo num servidor, para o sistema funcionar em máquinas com pouca memória.' },
  { titulo: 'Testar em uma escola e em uma empresa', texto: 'Com acompanhamento de quem vive a inclusão no dia a dia, para entender o que ajuda e o que atrapalha.' },
  { titulo: 'Simplificar a instalação', texto: 'Para que uma escola ou empresa consiga usar sem depender de alguém da área técnica.' },
]

// Vídeos de demonstração gravados com o próprio tradutor (tecla R), sem
// áudio e com legendas embutidas. `descricao` é o texto alternativo: diz o
// que acontece no vídeo para quem não pode ou não quer assisti-lo.
export const videos = [
  {
    arquivo: 'videos/demo-oi-gostar-abacaxi.mp4',
    capa: 'videos/demo-oi-gostar-abacaxi.jpg',
    glossas: ['OI', 'GOSTAR', 'ABACAXI'],
    frase: 'Oi, eu gosto de abacaxi.',
    descricao:
      'Uma pessoa sentada em frente à webcam faz primeiro vários gestos com as mãos que não são sinais, ' +
      'e o sistema não traduz nada. Depois faz os sinais OI, GOSTAR e ABACAXI; cada um aparece como ' +
      'glossa no painel da tela. Ao apertar Espaço, o sistema escreve a frase “Oi, eu gosto de abacaxi.”. ' +
      'Por fim, a pessoa limpa a tela e mostra as mãos abertas, e de novo nada é traduzido.',
  },
]
