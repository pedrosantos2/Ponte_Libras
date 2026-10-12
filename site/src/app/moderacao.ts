// Filtro do nome de um sinal novo, digitado por quem grava. É a primeira
// camada: barra palavrão e ofensa na hora, inclusive disfarçados (acento,
// letra repetida, número no lugar de letra). A segunda camada é humana —
// nenhum sinal novo entra no treino sem revisão.

// Termos bloqueados, já sem acento e em minúsculas. CURTOS valem só como
// palavra inteira (senão "puta" barraria "computador" e "cu" barraria
// "cuidado"); LONGOS valem também dentro de outra palavra ("filhodaputa").
//
// Ficaram de fora, de propósito, palavras que são vocabulário legítimo e que
// uma pessoa surda precisa para falar com médico, escola ou delegacia
// (sexo, estupro, pedofilia), nomes de animais e povos (macaco, judeu) e
// palavras que contêm um termo ofensivo sem sê-lo (pica-pau, viaduto).
// O que escapar daqui a revisão humana pega.
const CURTOS = [
  'cu', 'puta', 'viado', 'porno', 'cuzao', 'xota', 'bosta', 'merda', 'porra', 'foda', 'fodase',
  'fdp', 'pqp', 'vtnc', 'tnc', 'krl', 'crl', 'vsf', 'pnc',
]
const LONGOS = [
  // palavrões e termos sexuais usados como xingamento
  'caralho', 'buceta', 'boceta', 'putaria', 'filhodaputa', 'piroca', 'punheta', 'siririca',
  'xereca', 'xoxota', 'arrombad', 'cacete', 'foder', 'fodid', 'fudid', 'fuder', 'safad',
  'vagabund', 'corno', 'baitola', 'boiola', 'traveco', 'sapatao',
  // ofensas e preconceito
  'otario', 'babaca', 'idiota', 'imbecil', 'retardad', 'aleijad', 'crioul', 'negrinh', 'tiziu',
  // termos que a comunidade surda rejeita
  'surdomud', 'mudinh', 'surdinh',
]

// Nomes e vocabulário legítimo que contêm um termo da lista (sem acento,
// minúsculas): a revisão humana continua valendo para eles
const EXCECOES = new Set([
  'pornografia', 'pornografia infantil', 'casa arrombada', 'porta arrombada', 'arrombador', 'arrombadores',
  'aleijadinho', 'rio negrinho', 'negrinho do pastoreio', 'cavalo crioulo', 'corno ingles', 'vira-bosta',
  'retardador', 'retardadores',
])

// número ou símbolo no lugar de letra
const TROCAS: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' }

// minúsculas, sem acento, número no lugar de letra desfeito ("P0RRÃ" -> "porra")
function semDisfarce(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[013457@$!]/g, (c) => TROCAS[c])
}
// letra repetida vira uma só: "porraaa" -> "pora"
const colapsar = (s: string) => s.replace(/(.)\1+/g, '$1')

const curtos = CURTOS.map((t) => ({ termo: semDisfarce(t), colapsado: colapsar(semDisfarce(t)) }))
const longos = LONGOS.map((t) => colapsar(semDisfarce(t)))

// Termo curto: a palavra inteira. Letra repetida só conta como disfarce se a
// palavra ficou MAIS LONGA que o termo ("porraaa"), não mais curta: "porã"
// também vira "pora", mas é outra palavra.
const bateCurto = (p: string) =>
  curtos.some((t) => p === t.termo || (colapsar(p) === t.colapsado && p.length >= t.termo.length))
// Termo longo: o começo da palavra ("otários" sim, "notário" não)
const bateLongo = (p: string) => longos.some((l) => colapsar(p).startsWith(l))

export type Verificacao = { ok: true; glossa: string } | { ok: false; motivo: string }

// "  maçã verde " -> "MAÇÃ VERDE": as glossas do projeto são em maiúsculas
export function normalizarNome(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR')
}

export function verificarNome(texto: string): Verificacao {
  const glossa = normalizarNome(texto)
  if (glossa.length < 2) return { ok: false, motivo: 'Digite o nome do sinal.' }
  if (glossa.length > 30) return { ok: false, motivo: 'Use no máximo 30 letras.' }
  if (/(^|[ -])-|-($|[ -])/.test(glossa)) {
    return { ok: false, motivo: 'Use o hífen só entre duas palavras, como em PICA-PAU.' }
  }
  if (!/^\p{L}+(?:[ -]\p{L}+)*$/u.test(glossa)) {
    return { ok: false, motivo: 'Use só letras, espaço ou hífen, começando por uma letra.' }
  }
  if (glossa.split(/[ -]/).length > 3) return { ok: false, motivo: 'Use no máximo 3 palavras.' }

  // cada palavra, cada parte de palavra com hífen e a palavra com hífen
  // inteira ("surdo-mudo"); letras soltas ("c u") são lidas juntas
  const reduzida = semDisfarce(glossa)
  if (EXCECOES.has(reduzida)) return { ok: true, glossa }
  const termos = reduzida.split(' ')
  const candidatos = termos.flatMap((t) => [t.replace(/-/g, ''), ...t.split('-')])
  // pedaços curtos são lidos juntos: "c u", "po rra"
  if (termos.length > 1 && termos.every((t) => t.length <= 3)) candidatos.push(termos.join(''))
  if (candidatos.some((c) => bateCurto(c) || bateLongo(c))) {
    return { ok: false, motivo: 'Esse nome não é permitido. Se for um sinal de verdade, fale com a gente.' }
  }
  return { ok: true, glossa }
}
