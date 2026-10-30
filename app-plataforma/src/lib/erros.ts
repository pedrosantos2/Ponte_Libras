// As mensagens do Supabase vêm em inglês e técnicas; aqui viram português
// curto, que diz o que aconteceu e o que fazer. Nada de "inválido" nem de
// "algo deu errado".
import { isAuthRetryableFetchError, type AuthError } from '@supabase/supabase-js'
import { SENHA_MINIMA } from './regras'

const POR_CODIGO: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos. Confira os dois e tente de novo.',
  email_not_confirmed: 'Sua conta ainda não foi confirmada.',
  user_already_exists: 'Este e-mail já tem conta.',
  email_exists: 'Este e-mail já tem conta.',
  weak_password: `Essa senha é fácil de adivinhar. Crie outra, com ${SENHA_MINIMA} caracteres ou mais.`,
  same_password: 'Essa senha é igual à antiga. Crie uma diferente.',
  over_email_send_rate_limit: 'Foram muitos e-mails em pouco tempo. Espere alguns minutos e tente de novo.',
  over_request_rate_limit: 'Foram muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
  email_address_invalid: 'Digite o e-mail completo, como nome@exemplo.com',
  email_address_not_authorized: 'Não deu para mandar e-mail para este endereço agora. Tente de novo mais tarde.',
  otp_expired: 'Esse código não está certo ou já venceu. Confira o e-mail ou peça um código novo.',
  signup_disabled: 'O cadastro está fechado agora. Tente de novo mais tarde.',
}

export const SEM_CONEXAO = 'Sem conexão com o servidor. Confira sua internet e tente de novo.'
export const FORA_DO_AR = 'O acesso está fora do ar agora. Tente de novo mais tarde.'

export const codigoDoErro = (erro: AuthError | Error | null | undefined): string =>
  erro && 'code' in erro && typeof erro.code === 'string' ? erro.code : ''

export function mensagemDoErro(erro: AuthError | Error | null | undefined): string {
  if (!erro) return ''
  const texto = POR_CODIGO[codigoDoErro(erro)]
  if (texto) return texto
  // sem conexão: cada navegador escreve diferente ("Failed to fetch", "Load failed"...)
  if (isAuthRetryableFetchError(erro) || erro instanceof TypeError) return SEM_CONEXAO
  return 'Não deu para concluir agora. Tente de novo daqui a alguns minutos.'
}
