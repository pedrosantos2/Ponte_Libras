// Casos da lista de palavras gerada por scripts/gerar-dicionario.mjs: o que
// precisa existir (inclusive plural, feminino, conjugação, composta e
// palavra moderna das extras) e o que não pode (invenções, letra a mais).
// Rodar: npm run testar  (precisa de npm run dicionario antes)
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

// o mesmo critério de src/app/dicionario.ts: o pedaço mais longo do índice
const indice = new Set<string>(JSON.parse(readFileSync('public/dicionario/indice.json', 'utf8')).pedacos)
const chave = (p: string) => {
  const b = p.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  const letras = Array.from({ length: 8 }, (_, i) => (/[a-z]/.test(b[i] ?? '') ? b[i] : '_')).join('')
  for (let n = letras.length; n > 2; n--) if (indice.has(letras.slice(0, n))) return letras.slice(0, n)
  return letras.slice(0, 2)
}
const cache = new Map<string, Set<string>>()
function existe(p: string): boolean {
  const k = chave(p)
  if (!cache.has(k)) {
    try {
      cache.set(k, new Set(gunzipSync(readFileSync(`public/dicionario/${k}.txt.gz`)).toString().split(/\n+/)))
    } catch {
      cache.set(k, new Set())
    }
  }
  return cache.get(k)!.has(p)
}

const casos: [string, boolean][] = [
  ['casa', true], ['casas', true], ['banana', true], ['obrigado', true], ['obrigada', true],
  ['computador', true], ['surdo', true], ['surda', true], ['gostar', true], ['gostei', true],
  ['maçã', true], ['maca', true], ['água', true], ['intérprete', true], ['banheiro', true],
  ['pica-pau', true], ['guarda-chuva', true], ['escola', true], ['libras', true], ['brasil', true],
  ['jaraguá', true], ['internet', true], ['whatsapp', true], ['pix', true], ['cpf', true], ['sus', true],
  ['agua', false], ['asdfgh', false], ['kkkkk', false], ['blablabla', false], ['bananaa', false],
  ['computadorr', false], ['dá-lo-ei', false],
  // achados da revisão: palavras guardadas como prefixo + raiz no VERO
  ['desculpa', true], ['desculpe', true], ['amanhã', true], ['remédio', true], ['remédios', true],
  ['reunião', true], ['reuniões', true], ['desligar', true], ['refazer', true],
  ['superbananas', false],
  // grafias proibidas pelo VERO, e as que só são proibidas com maiúscula
  ['menas', false], ['ague', false], ['aguem', false], ['km', true], ['kg', true], ['cm', true],
]
let erros = 0
for (const [p, esperado] of casos) {
  if (existe(p) !== esperado) {
    erros++
    console.log('ERRO', p, 'esperado', esperado ? 'existir' : 'não existir')
  }
}
console.log(`dicionário: ${casos.length - erros}/${casos.length} casos corretos`)
if (erros) process.exit(1)
