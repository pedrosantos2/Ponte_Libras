// Confere se as palavras do nome de um sinal novo existem no português do
// Brasil. A lista vem de scripts/gerar-dicionario.mjs (VERO, do LibreOffice,
// mais as palavras modernas de scripts/palavras-extras.txt), dividida pelas
// primeiras letras: cada consulta baixa só o pedaço que precisa (até ~110 KB).

type Pedaco = { palavras: Set<string>; raizes: Set<string>; porBase: Map<string, string[]> | null }
const pedacos = new Map<string, Promise<Pedaco>>()
let indice: Promise<Set<string>> | null = null

const semAcento = (p: string) => p.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

function carregarIndice(): Promise<Set<string>> {
  indice ??= fetch('./dicionario/indice.json')
    .then((r) => {
      if (!r.ok) throw new Error(`dicionário: ${r.status}`)
      return r.json() as Promise<{ pedacos: string[] }>
    })
    .then((j) => new Set(j.pedacos))
  // se falhar (sem internet), tenta de novo na próxima consulta
  indice.catch(() => (indice = null))
  return indice
}

// O pedaço de uma palavra: o mais longo do índice que começa como ela (as
// mesmas letras sem acento do gerador, com "_" para o que não é letra)
async function chave(palavra: string): Promise<string> {
  const existentes = await carregarIndice()
  const b = semAcento(palavra)
  const letras = Array.from({ length: 8 }, (_, i) => (/[a-z]/.test(b[i] ?? '') ? b[i] : '_')).join('')
  for (let n = letras.length; n > 2; n--) if (existentes.has(letras.slice(0, n))) return letras.slice(0, n)
  return letras.slice(0, 2)
}

async function texto(resposta: Response): Promise<string> {
  const bytes = new Uint8Array(await resposta.arrayBuffer())
  // alguns servidores já entregam o .gz descomprimido: confere a assinatura
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return new TextDecoder().decode(bytes)
  const fluxo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(fluxo).text()
}

async function pedaco(palavra: string): Promise<Pedaco> {
  const k = await chave(palavra)
  let p = pedacos.get(k)
  if (!p) {
    p = fetch(`./dicionario/${k}.txt.gz`).then(async (r) => {
      if (r.status === 404) return { palavras: new Set<string>(), raizes: new Set<string>(), porBase: null }
      if (!r.ok) throw new Error(`dicionário: ${r.status}`)
      // entradas do dicionário, uma linha vazia, formas geradas
      const [entradas, geradas = ''] = (await texto(r)).split('\n\n')
      const raizes = new Set(entradas.split('\n'))
      return { palavras: new Set([...raizes, ...geradas.split('\n')]), raizes, porBase: null }
    })
    p.catch(() => pedacos.delete(k))
    pedacos.set(k, p)
  }
  return p
}

async function existe(palavra: string): Promise<boolean> {
  return palavra !== '' && (await pedaco(palavra)).palavras.has(palavra)
}

// "agua" -> ["água"]; as entradas do dicionário vêm antes das formas geradas
async function parecidas(palavra: string): Promise<string[]> {
  const p = await pedaco(palavra)
  if (!p.porBase) {
    p.porBase = new Map()
    for (const w of p.palavras) {
      const b = semAcento(w)
      p.porBase.set(b, [...(p.porBase.get(b) ?? []), w])
    }
  }
  const achadas = p.porBase.get(semAcento(palavra)) ?? []
  return achadas.sort((a, b) => Number(p.raizes.has(b)) - Number(p.raizes.has(a))).slice(0, 3)
}

export type Conferencia = { ok: true } | { ok: false; palavra: string; sugestoes: string[] }

// glossa já normalizada (maiúsculas): "BANHEIRO FEMININO", "PICA-PAU"
export async function conferirNoDicionario(glossa: string): Promise<Conferencia> {
  for (const termo of glossa.toLocaleLowerCase('pt-BR').split(' ')) {
    if (await existe(termo)) continue
    // palavra composta fora da lista: vale se cada parte existir (uma parte
    // vazia, de hífen solto ou repetido, reprova)
    const partes = termo.split('-')
    if (partes.length > 1 && (await Promise.all(partes.map(existe))).every(Boolean)) continue
    const sugestoes = await parecidas(termo)
    return { ok: false, palavra: termo.toLocaleUpperCase('pt-BR'), sugestoes: sugestoes.map((s) => s.toLocaleUpperCase('pt-BR')) }
  }
  return { ok: true }
}
