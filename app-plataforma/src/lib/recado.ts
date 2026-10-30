// Recado de uma tela para a próxima ("Senha trocada", "Conta criada").
// Fica aqui, e não no estado do roteador, porque quem leva a pessoa para o
// painel muitas vezes é o próprio login: assim que a sessão aparece, a rota
// de visitante redireciona antes de a tela que deixou o recado navegar.
export type Recado = { titulo: string; texto?: string }

let recado: Recado | null = null

export const deixarRecado = (r: Recado) => {
  recado = r
}
export const lerRecado = () => recado
export const apagarRecado = () => {
  recado = null
}

// Depois do cadastro, o painel manda o código de confirmação para este
// e-mail ao abrir (o cadastro não espera, para a pessoa entrar logo)
let codigoParaMandar: string | null = null

export const pedirCodigoAoAbrir = (email: string) => {
  codigoParaMandar = email
}
// Devolve o e-mail uma vez só, para o código não ir duas vezes
export const pegarCodigoParaMandar = () => {
  const email = codigoParaMandar
  codigoParaMandar = null
  return email
}
