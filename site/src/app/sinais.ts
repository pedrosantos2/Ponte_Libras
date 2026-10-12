// As classes do modelo (config.ACTIONS), com quantas pessoas diferentes das
// bases públicas cada uma tem hoje. Quanto menos pessoas, mais o sinal erra
// com quem o modelo nunca viu — por isso os mais carentes aparecem primeiro.
export type Sinal = {
  classe: string
  nome: string
  pessoas: number
  dica?: string
}

const SINAIS: Sinal[] = [
  { classe: 'OI', nome: 'OI', pessoas: 8, dica: 'Datilologia: letra O e depois letra I.' },
  { classe: 'OI_ACENO', nome: 'OI (aceno)', pessoas: 1, dica: 'A variante com a mão aberta, acenando.' },
  { classe: 'GOSTAR', nome: 'GOSTAR', pessoas: 4 },
  { classe: 'LARANJA', nome: 'LARANJA', pessoas: 9 },
  { classe: 'ABACAXI', nome: 'ABACAXI', pessoas: 3 },
  { classe: 'BANANA', nome: 'BANANA', pessoas: 3 },
  { classe: 'MORANGO', nome: 'MORANGO', pessoas: 3 },
  { classe: 'ACONTECER', nome: 'ACONTECER', pessoas: 8 },
  { classe: 'AMARELO', nome: 'AMARELO', pessoas: 8 },
  { classe: 'BANHEIRO', nome: 'BANHEIRO', pessoas: 8 },
  { classe: 'MEDO', nome: 'MEDO', pessoas: 8 },
  { classe: 'BOM', nome: 'BOM', pessoas: 7 },
]

export const POUCAS_PESSOAS = 4
export const META_POR_SINAL = 10

export const OUTRO: Sinal = {
  classe: 'OUTRO',
  nome: 'Sem sinal',
  pessoas: 34,
  dica: 'Mexa as mãos à vontade, sem fazer nenhum sinal. Ensina o sistema a não inventar palavras.',
}

export const LISTA: Sinal[] = [...[...SINAIS].sort((a, b) => a.pessoas - b.pessoas), OUTRO]
