// Casos do filtro de nomes de sinais novos (src/app/moderacao.ts): o que
// precisa passar (vocabulário legítimo, inclusive o que contém um termo
// ofensivo sem sê-lo) e o que precisa ser barrado (inclusive disfarçado).
// Rodar: npm run testar
import { verificarNome } from '../src/app/moderacao.ts'
const casos: [string, boolean][] = [
  ['casa', true], ['Maçã verde', true], ['computador', true], ['viaduto', true], ['pica-pau', true],
  ['cuidado', true], ['transação', true], ['macaco', true], ['judeu', true], ['sexo', true],
  ['estupro', true], ['escola', true], ['obrigado', true], ['banheiro feminino', true],
  ['porra', false], ['PORRAAA', false], ['p0rr4', false], ['caralho', false], ['filho da puta', false],
  ['puta', false], ['surdo-mudo', false], ['mudinho', false], ['idiota', false], ['c u', false],
  ['a', false], ['casa123', false], ['um dois tres quatro', false],
  // achados da revisão: legítimas que eram barradas, e disfarces
  ['notário', true], ['ponta porã', true], ['cor nova', true], ['rotário', true],
  ['otários', false], ['caralhoo', false], ['pooorra', false], ['filho-da-puta', false],
  ['pica--pau', false], ['casa-', false], ['-casa', false],
  // segunda revisão: vocabulário legítimo e o disfarce com espaço
  ['pornografia', true], ['casa arrombada', true], ['rio negrinho', true], ['cavalo crioulo', true],
  ['aleijadinho', true], ['corno inglês', true], ['retardador', true], ['oi tu', true],
  ['po rra', false], ['pornô', false], ['arrombado', false],
]
let erros = 0
for (const [nome, esperado] of casos) {
  const r = verificarNome(nome)
  if (r.ok !== esperado) { erros++; console.log('ERRO', nome, r) }
}
console.log(`moderação: ${casos.length - erros}/${casos.length} casos corretos`)
if (erros) process.exit(1)
