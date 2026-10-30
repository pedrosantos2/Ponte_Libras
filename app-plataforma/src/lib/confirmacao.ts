// A confirmação do e-mail, que vai liberar a gravação de sinais.
//
// "Confirm email" fica desligado no Supabase para a pessoa entrar no painel
// logo depois do cadastro. Com isso, o Supabase marca todo e-mail como
// confirmado e o campo dele não diz quem confirmou de verdade. Quem guarda
// isso é a função conferir_email (supabase/confirmar-email.sql). Ela registra
// a confirmação quando a sessão veio de um código do e-mail e quem a abriu
// também sabe a senha da conta (outra pessoa pode ter criado a conta com este
// e-mail e escolhido a senha).
import { supabase } from './supabase'

export type EstadoEmail = 'conferindo' | 'confirmado' | 'falta-confirmar' | 'falta-senha' | 'sem-banco' | 'erro'

export async function conferirEmail(senha?: string | null): Promise<EstadoEmail> {
  if (!supabase) return 'erro'
  const { data, error } = await supabase.rpc('conferir_email', senha ? { p_senha: senha } : {})
  // PGRST202: a função (nesta versão) ainda não foi criada no banco
  if (error) return error.code === 'PGRST202' ? 'sem-banco' : 'erro'
  return data === 'confirmado' || data === 'falta-confirmar' || data === 'falta-senha' ? data : 'erro'
}

// A senha que a pessoa acabou de digitar (no cadastro ou ao entrar), para não
// pedir de novo quando ela confirmar o e-mail com o código. Fica só na memória
// desta aba, presa ao e-mail digitado, vale por 30 minutos e some quando a
// sessão acaba (AuthProvider), para nunca ir junto com a conta de outra pessoa.
let senhaConhecida: { email: string; senha: string; ate: number } | null = null

export const guardarSenhaConhecida = (email: string, senha: string) => {
  senhaConhecida = { email: email.trim().toLowerCase(), senha, ate: Date.now() + 30 * 60_000 }
}
export const senhaGuardada = (email: string) =>
  senhaConhecida && senhaConhecida.email === email.trim().toLowerCase() && Date.now() < senhaConhecida.ate
    ? senhaConhecida.senha
    : null
export const esquecerSenha = () => {
  senhaConhecida = null
}
