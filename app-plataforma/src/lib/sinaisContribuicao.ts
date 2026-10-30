// O nome sugerido é metadado; nunca faz parte do caminho do arquivo.
export const PASTA_NOVOS_SINAIS = '_NOVO'

export function normalizarNomeSinal(nome: string) {
  return nome.normalize('NFC').trim().replace(/\s+/gu, ' ')
}

export function erroNomeSinal(nome: string) {
  const normalizado = normalizarNomeSinal(nome)
  if (normalizado.length < 2 || normalizado.length > 80 || !/\p{L}/u.test(normalizado) || /[\p{Cc}\p{Cf}]/u.test(normalizado)) {
    return 'Escreva o nome do sinal com 2 a 80 caracteres e pelo menos uma letra.'
  }
  return ''
}
