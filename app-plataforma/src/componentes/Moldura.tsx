// A moldura de todas as páginas: a barra com a marca (e, para quem está
// logado, o e-mail e o botão Sair), o conteúdo numa coluna alinhada à
// esquerda e o rodapé.
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/contexto'
import { sair } from '../lib/sair'
import { LANDING_URL, supabase } from '../lib/supabase'
import { ResumoErros, type Erros } from './Formulario'
import { Marca } from './Marca'

function irParaConteudo() {
  document.getElementById('conteudo')?.focus()
}

export function Moldura({ children, topo }: { children: ReactNode; topo?: ReactNode }) {
  const { sessao } = useAuth()
  const navegar = useNavigate()
  const email = sessao?.user.email ?? ''

  async function sairDaConta() {
    if (await sair()) navegar('/entrar', { replace: true })
  }

  return (
    <>
      <a
        className="pular"
        href="#conteudo"
        onClick={(e) => {
          e.preventDefault()
          irParaConteudo()
        }}
      >
        Pular para o conteúdo
      </a>
      <header className="barra">
        <div className="caixa barra-dentro">
          <Link className="barra-nome" to="/">
            <Marca />
            Ponte Libras
          </Link>
          {sessao && (
            <div className="barra-conta">
              <span className="barra-email" title={email}>
                {email}
              </span>
              <button type="button" className="botao botao-secundario botao-pequeno" onClick={sairDaConta}>
                Sair
              </button>
            </div>
          )}
        </div>
      </header>
      {topo}
      <main id="conteudo" className="caixa pagina" tabIndex={-1}>
        {children}
      </main>
      <footer className="rodape">
        <div className="caixa">
          <p>
            O Ponte Libras é um TCC de Engenharia de Software na Católica de Santa Catarina.{' '}
            <a href={LANDING_URL}>Conheça o projeto</a>
          </p>
        </div>
      </footer>
    </>
  )
}

// Numa página de uma página só, o leitor de tela não percebe a troca de tela.
// Por isso o título da aba muda e o foco vai para o título da tela, que é
// anunciado. Na primeira tela que abre, o foco fica onde o navegador deixou.
let jaAbriuUmaTela = false

export function useTrocaDeTela(titulo: string, temErro: boolean, alvo: RefObject<HTMLElement | null>) {
  const erroAgora = useRef(temErro)
  useEffect(() => {
    erroAgora.current = temErro
    const comNome = titulo.includes('Ponte Libras') ? titulo : `${titulo} — Ponte Libras`
    document.title = `${temErro ? 'Erro: ' : ''}${comNome}`
  }, [titulo, temErro])
  useEffect(() => {
    // com erro na tela, o foco é do resumo de erros
    if (jaAbriuUmaTela && !erroAgora.current) alvo.current?.focus()
    // o StrictMode roda o efeito duas vezes seguidas ao abrir: só marca depois
    const t = window.setTimeout(() => {
      jaAbriuUmaTela = true
    })
    return () => window.clearTimeout(t)
  }, [titulo, alvo])
}

type TelaProps = {
  titulo: string
  erros?: Erros
  voltar?: ReactNode
  rotuloDe?: string // o h1 é o rótulo deste campo (uma pergunta por página)
  children: ReactNode
}

// Tela de acesso: entrar, criar conta, recuperar a senha
export function Tela({ titulo, erros, voltar, rotuloDe, children }: TelaProps) {
  const h1 = useRef<HTMLHeadingElement>(null)
  useTrocaDeTela(titulo, !!erros?.erros.length, h1)
  return (
    <Moldura>
      <div className="coluna">
        {voltar}
        {!supabase && import.meta.env.DEV && <FaltaConfigurar />}
        {erros && <ResumoErros erros={erros} />}
        <h1 ref={h1} tabIndex={-1}>
          {rotuloDe ? <label htmlFor={rotuloDe}>{titulo}</label> : titulo}
        </h1>
        {children}
      </div>
    </Moldura>
  )
}

// Enquanto confere a sessão. O texto só aparece depois de 400 ms, para não
// piscar em conexão rápida; depois de 10 s, explica e oferece tentar de novo.
export function Aguarde({ texto }: { texto: string }) {
  const [fase, setFase] = useState<'nada' | 'texto' | 'demora'>('nada')
  useEffect(() => {
    const a = window.setTimeout(() => setFase('texto'), 400)
    const b = window.setTimeout(() => setFase('demora'), 10_000)
    return () => {
      window.clearTimeout(a)
      window.clearTimeout(b)
    }
  }, [])
  return (
    <Moldura>
      <div className="coluna">
        <p className="aguarde" role="status">
          {fase === 'nada' ? '' : fase === 'texto' ? texto : 'Está demorando mais que o normal. Confira sua internet.'}
        </p>
        {fase === 'demora' && (
          <p>
            <button type="button" className="link" onClick={() => window.location.reload()}>
              Tentar de novo
            </button>
          </p>
        )}
      </div>
    </Moldura>
  )
}

// Só em desenvolvimento: o .env.local ainda não tem os dados do Supabase
function FaltaConfigurar() {
  return (
    <div className="aviso-dev" role="note">
      <p className="aviso-dev-titulo">Falta configurar</p>
      <p>
        A plataforma ainda não está ligada ao Supabase. Copie <code>.env.example</code> para <code>.env.local</code>,
        preencha com os dados do projeto e reinicie o servidor.
      </p>
    </div>
  )
}

// Em produção sem configuração: a pessoa nunca vê "Supabase" nem ".env"
export function ForaDoAr() {
  const h1 = useRef<HTMLHeadingElement>(null)
  useTrocaDeTela('O acesso está fora do ar agora', false, h1)
  return (
    <Moldura>
      <div className="coluna">
        <h1 ref={h1} tabIndex={-1}>
          O acesso está fora do ar agora
        </h1>
        <p>Não dá para entrar nem criar conta neste momento. Tente de novo mais tarde.</p>
        <p>
          <a href={LANDING_URL}>Conheça o Ponte Libras</a>
        </p>
      </div>
    </Moldura>
  )
}
