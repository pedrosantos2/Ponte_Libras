// Mantém a sessão atual à vista de toda a plataforma: confere se há uma sessão
// salva ao abrir e acompanha cada login, logout e renovação de sessão.
import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { esquecerSenha } from '../lib/confirmacao'
import { supabase } from '../lib/supabase'
import { ContextoAuth } from './contexto'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [carregando, setCarregando] = useState(supabase !== null)
  const [recuperandoSenha, setRecuperandoSenha] = useState(false)

  useEffect(() => {
    if (!supabase) return
    let ativo = true
    supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return
      setSessao(data.session)
      setCarregando(false)
    })
    // Só atualiza o estado aqui: chamar o Supabase de dentro deste aviso pode
    // travar a biblioteca
    const { data } = supabase.auth.onAuthStateChange((evento, novaSessao) => {
      setSessao(novaSessao)
      setCarregando(false)
      if (evento === 'PASSWORD_RECOVERY') setRecuperandoSenha(true)
      // a senha foi trocada (updateUser) ou a pessoa saiu: a recuperação acabou
      if (evento === 'USER_UPDATED' || evento === 'SIGNED_OUT') setRecuperandoSenha(false)
      // a sessão acabou (saiu, ou o Supabase encerrou): a senha guardada vai junto
      if (evento === 'SIGNED_OUT') esquecerSenha()
    })
    return () => {
      ativo = false
      data.subscription.unsubscribe()
    }
  }, [])

  return <ContextoAuth.Provider value={{ sessao, carregando, recuperandoSenha }}>{children}</ContextoAuth.Provider>
}
