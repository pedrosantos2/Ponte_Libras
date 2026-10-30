// Sair da conta. Sem internet, o Supabase não consegue avisar o servidor e
// deixa a sessão salva no navegador; num computador de escola, isso deixaria
// a conta aberta para a próxima pessoa. Nesse caso, a sessão é apagada aqui
// mesmo e a página recarrega.
import { esquecerSenha } from './confirmacao'
import { enderecoDe, supabase } from './supabase'

// Devolve true quando saiu normalmente (quem chama leva para /entrar)
export async function sair(): Promise<boolean> {
  esquecerSenha()
  if (!supabase) return true
  const { error } = await supabase.auth.signOut()
  if (!error) return true
  try {
    for (const chave of Object.keys(localStorage)) {
      if (/^sb-.+-auth-token/.test(chave)) localStorage.removeItem(chave)
    }
  } catch {
    // armazenamento bloqueado: não há sessão salva para apagar
  }
  window.location.assign(enderecoDe('/entrar'))
  return false
}
