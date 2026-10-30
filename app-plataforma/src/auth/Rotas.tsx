// Quem pode ver cada página: as protegidas exigem login; as de entrar e
// cadastrar só fazem sentido para quem ainda não está logado.
import { useEffect } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import { Aguarde } from '../componentes/Moldura'
import { destinoSeguro } from '../lib/destino'
import { useAuth } from './contexto'

// Sem login: vai para /entrar, lembrando de onde veio para voltar depois
export function RotaProtegida() {
  const { sessao, carregando } = useAuth()
  const local = useLocation()
  if (carregando) return <Aguarde texto="Conferindo se você já entrou…" />
  // o link do e-mail vencido (ou o Google cancelado) volta com o erro no
  // endereço (#error_code=...): ele vai junto, para /entrar poder explicar
  const erroNoLink = local.hash.includes('error') ? local.hash : ''
  if (!sessao) return <Navigate to={{ pathname: '/entrar', hash: erroNoLink }} replace state={{ de: local.pathname + local.search }} />
  return <Outlet />
}

// Já logado: entrar e cadastrar de novo não fazem sentido. Quem acabou de
// entrar volta para a página que tentou abrir (ou para o painel).
export function SoVisitante() {
  const { sessao, carregando } = useAuth()
  const local = useLocation()
  if (carregando) return <Aguarde texto="Conferindo se você já entrou…" />
  if (sessao) return <Navigate to={destinoSeguro(local.state)} replace />
  return <Outlet />
}

// Chegou pelo link de recuperação (ou digitou o código de recuperação):
// leva para a troca de senha, mesmo que o Supabase tenha devolvido a pessoa
// para outra página
export function LevarParaNovaSenha() {
  const { recuperandoSenha } = useAuth()
  const local = useLocation()
  const navegar = useNavigate()
  useEffect(() => {
    if (recuperandoSenha && local.pathname !== '/nova-senha') navegar('/nova-senha', { replace: true })
  }, [recuperandoSenha, local.pathname, navegar])
  return null
}
