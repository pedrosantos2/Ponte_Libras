// A marca do Ponte Libras: um quadro parado da animação do sinal OI (o "I",
// com o dedo mínimo levantado), como o Ponte Libras vê a mão pela câmera.
// Os pontos foram copiados do quadro 72 de dados/mao-oi.json, já encaixados
// num quadrado de 32 unidades, para a barra não carregar o arquivo inteiro.
// O favicon (public/favicon.svg) usa o mesmo desenho, sem os pontos brancos.

const PONTOS: [number, number][] = [
  [13.7, 26.0], [17.6, 23.0], [19.9, 19.0], [21.2, 15.6], [19.4, 13.8],
  [14.4, 14.9], [15.4, 11.1], [17.5, 11.6], [18.8, 13.4],
  [13.1, 14.7], [14.2, 10.3], [16.9, 11.2], [18.5, 13.1],
  [11.9, 14.8], [13.0, 10.0], [16.0, 10.7], [17.9, 12.4],
  [10.8, 15.3], [11.0, 10.9], [11.1, 8.0], [11.1, 6.0],
]

// Ligações entre os 21 pontos da mão, na convenção do MediaPipe
export const LIGACOES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
]

const TRACOS = LIGACOES.map(([a, b]) => `M${PONTOS[a][0]} ${PONTOS[a][1]}L${PONTOS[b][0]} ${PONTOS[b][1]}`).join('')

export function Marca() {
  return (
    <svg className="marca" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="7" fill="var(--tinta)" />
      <path d={TRACOS} fill="none" stroke="var(--turquesa)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <g fill="var(--branco)">
        {PONTOS.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={0.9} />
        ))}
      </g>
    </svg>
  )
}
