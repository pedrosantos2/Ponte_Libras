// Gera a lista de palavras do português do Brasil usada para conferir o nome
// de um sinal novo (src/app/dicionario.ts).
//
// Fonte: VERO, o corretor do LibreOffice (pacote dictionary-pt). Ele guarda
// raízes com regras de afixo — COMPUTADOR sai de COMPUTAR, OBRIGADO de
// OBRIGAR —, então aqui as regras são expandidas uma vez, do jeito do
// "unmunch" do Hunspell, e o navegador recebe só as palavras prontas.
//
// A lista é dividida pelas duas primeiras letras: para conferir CASA o site
// baixa só o pedaço "ca", não o dicionário inteiro.
//
// Rodar: npm run dicionario  (também roda antes do build, e antes do dev se
// a lista ainda não existir). Palavras modernas que o VERO não conhece ficam
// em scripts/palavras-extras.txt.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const ORIGEM = 'node_modules/dictionary-pt'
const SAIDA = 'public/dicionario'
const EXTRAS = 'scripts/palavras-extras.txt'

if (process.argv.includes('--se-faltar') && existsSync(`${SAIDA}/LEIA-ME.txt`)) process.exit(0)

const aff = readFileSync(`${ORIGEM}/index.aff`, 'utf8').split('\n')
const dic = readFileSync(`${ORIGEM}/index.dic`, 'utf8').split('\n').slice(1)

// ---------- regras de afixo ----------
let PROIBIDA = ''
const classes = new Map() // flag -> { prefixo, cruzado, regras }
for (const linha of aff) {
  const p = linha.trim().split(/\s+/)
  if (p[0] === 'FORBIDDENWORD') PROIBIDA = p[1]
  if (p[0] !== 'PFX' && p[0] !== 'SFX') continue
  const [tipo, flag] = p
  if (!classes.has(flag)) {
    // cabeçalho: SFX A Y 3
    classes.set(flag, { prefixo: tipo === 'PFX', cruzado: p[2] === 'Y', regras: [] })
    continue
  }
  // regra: SFX A  o  es/flags  condição
  const [, , tira, poe, cond = '.'] = p
  const [acrescimo, continuacao = ''] = poe.split('/')
  classes.get(flag).regras.push({
    tira: tira === '0' ? '' : tira,
    poe: acrescimo === '0' ? '' : acrescimo,
    continuacao: [...continuacao],
    cond: new RegExp(tipo === 'SFX' ? `(${cond})$` : `^(${cond})`, 'u'),
  })
}

function aplicar(classe, palavra) {
  const saida = []
  for (const r of classe.regras) {
    if (!r.cond.test(palavra)) continue
    if (classe.prefixo) {
      if (palavra.startsWith(r.tira)) saida.push({ forma: r.poe + palavra.slice(r.tira.length), regra: r })
    } else if (palavra.endsWith(r.tira)) {
      saida.push({ forma: palavra.slice(0, palavra.length - r.tira.length) + r.poe, regra: r })
    }
  }
  return saida
}

// ---------- expansão (como o unmunch) ----------
const palavras = new Set()
const raizes = new Set() // entradas do dicionário: vêm antes nas sugestões
let raizAtual = ''
const guardar = (forma, flags) => {
  if (flags.includes(PROIBIDA)) return
  // Verbo com pronome colado ("dá-lo-ei", "encontrou-se-lhe") é 3/4 do
  // dicionário expandido e nunca é nome de sinal: forma gerada com hífen só
  // entra se a raiz já tinha hífen (pica-pau -> pica-paus continua valendo).
  if (forma.includes('-') && !raizAtual.includes('-')) return
  palavras.add(forma.toLocaleLowerCase('pt-BR'))
}

const proibidas = new Set() // grafias que o VERO marca como erradas

for (const linha of dic) {
  if (!linha.trim()) continue
  const [raiz, flagsTexto = ''] = linha.trim().split('/')
  raizAtual = raiz
  const flags = [...flagsTexto]
  if (flags.includes(PROIBIDA)) {
    proibidas.add(raiz.toLocaleLowerCase('pt-BR'))
    continue
  }
  guardar(raiz, flags)
  raizes.add(raiz.toLocaleLowerCase('pt-BR'))

  const simples = [] // formas de 1 sufixo, de classe cruzada: aceitam prefixo
  for (const f of flags) {
    const c = classes.get(f)
    if (!c || c.prefixo) continue
    for (const { forma, regra } of aplicar(c, raiz)) {
      guardar(forma, regra.continuacao)
      if (regra.continuacao.includes(PROIBIDA)) continue
      if (c.cruzado) simples.push(forma)
      // sufixo duplo: a regra libera outro sufixo (ou prefixo) sobre a forma nova
      for (const g of regra.continuacao) {
        const c2 = classes.get(g)
        if (!c2) continue
        for (const s of aplicar(c2, forma)) guardar(s.forma, s.regra.continuacao)
      }
    }
  }

  // Prefixos: muitas palavras comuns são guardadas como prefixo + raiz
  // (DESCULPA = des + culpa, AMANHÃ = a + manhã, REMÉDIO = re + médio). Eles
  // entram sobre a raiz e sobre as formas de 1 sufixo (plural, feminino,
  // conjugação sem pronome), mas não sobre os sufixos encadeados, que
  // multiplicariam a lista sem acrescentar palavra que alguém use como sinal.
  for (const f of flags) {
    const c = classes.get(f)
    if (!c || !c.prefixo) continue
    for (const { forma, regra } of aplicar(c, raiz)) guardar(forma, regra.continuacao)
    if (!c.cruzado) continue
    for (const s of simples) for (const { forma, regra } of aplicar(c, s)) guardar(forma, regra.continuacao)
  }
}

for (const linha of readFileSync(EXTRAS, 'utf8').split('\n')) {
  const p = linha.trim()
  if (p && !p.startsWith('#')) {
    palavras.add(p.toLocaleLowerCase('pt-BR'))
    raizes.add(p.toLocaleLowerCase('pt-BR'))
  }
}

// uma grafia proibida não vale nem quando outra raiz a gera — a menos que
// ela mesma seja uma entrada permitida ("Km" é proibida, "km" não)
for (const p of proibidas) {
  if (raizes.has(p)) continue
  palavras.delete(p)
}

// ---------- pedaços pelas primeiras letras (sem acento) ----------
// Duas letras bastam para quase tudo; um grupo grande demais é dividido pela
// letra seguinte, quantas vezes for preciso ("des" tem 226 mil palavras). O
// índice lista os pedaços, e o navegador usa o mais longo que bate.
const LIMITE = 40000
const letra = (base, i) => (/[a-z]/.test(base[i] ?? '') ? base[i] : '_')
const base = (palavra) => palavra.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const pedacos = new Map()
function dividir(chave, lista, nivel) {
  if (lista.length <= LIMITE || nivel >= 8) {
    pedacos.set(chave, lista)
    return
  }
  const sub = new Map()
  for (const p of lista) {
    const k = chave + letra(base(p), nivel)
    if (!sub.has(k)) sub.set(k, [])
    sub.get(k).push(p)
  }
  for (const [k, l] of sub) dividir(k, l, nivel + 1)
}
const grupos = new Map()
for (const p of palavras) {
  const b = base(p)
  const k = letra(b, 0) + letra(b, 1)
  if (!grupos.has(k)) grupos.set(k, [])
  grupos.get(k).push(p)
}
for (const [k, lista] of grupos) dividir(k, lista, 2)

rmSync(SAIDA, { recursive: true, force: true })
mkdirSync(SAIDA, { recursive: true })
let bytes = 0
for (const [k, lista] of pedacos) {
  // primeiro as entradas do dicionário, uma linha vazia, depois as formas geradas
  const primeiro = lista.filter((p) => raizes.has(p)).sort()
  const depois = lista.filter((p) => !raizes.has(p)).sort()
  const gz = gzipSync(primeiro.join('\n') + '\n\n' + depois.join('\n'), { level: 9 })
  writeFileSync(`${SAIDA}/${k}.txt.gz`, gz)
  bytes += gz.length
}
writeFileSync(`${SAIDA}/indice.json`, JSON.stringify({ pedacos: [...pedacos.keys()].sort() }))
writeFileSync(
  `${SAIDA}/LEIA-ME.txt`,
  'Lista de palavras gerada por scripts/gerar-dicionario.mjs a partir do VERO\n' +
    '(Verificador Ortográfico Livre, LibreOffice), pacote dictionary-pt.\n' +
    'Licença: LGPL-3.0 ou MPL-2.0, como o original. Mais as palavras de\n' +
    'scripts/palavras-extras.txt.\n',
)
const maior = Math.max(...[...pedacos.values()].map((l) => l.length))
console.log(
  `${palavras.size} palavras em ${pedacos.size} pedaços (${(bytes / 1e6).toFixed(1)} MB comprimidos, maior pedaço: ${maior} palavras)`,
)
