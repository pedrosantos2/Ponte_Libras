import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type EstadoAuth = {
  sessao: Session | null
  carregando: boolean      // ainda conferindo se há uma sessão salva
  recuperandoSenha: boolean // a pessoa chegou pelo link de "esqueci a senha"
}

export const ContextoAuth = createContext<EstadoAuth>({ sessao: null, carregando: true, recuperandoSenha: false })

export const useAuth = () => useContext(ContextoAuth)
