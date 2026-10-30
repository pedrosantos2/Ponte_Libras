// Para onde voltar depois do login: só caminhos internos desta plataforma
// (nada de "//outro-site.com", que o navegador leria como outro endereço)
export function destinoSeguro(estado: unknown): string {
  const de = (estado as { de?: unknown } | null)?.de
  return typeof de === 'string' && de.startsWith('/') && !de.startsWith('//') ? de : '/'
}
