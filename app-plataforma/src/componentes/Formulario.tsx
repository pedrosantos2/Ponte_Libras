// Peças dos formulários, no padrão do GOV.UK Design System: o erro aparece
// num resumo no topo (que recebe o foco e leva até o campo) e junto do campo,
// acima dele. A validação é feita no envio, sem os balões do navegador.
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'

export type ErroForm = { campo?: string; texto: ReactNode }

export function useErros(iniciais: ErroForm[] = []) {
  const [erros, setErros] = useState(iniciais)
  // muda a cada envio com erro, para o resumo receber o foco de novo
  const [vez, setVez] = useState(iniciais.length ? 1 : 0)
  return {
    erros,
    vez,
    mostrar: (lista: ErroForm[]) => {
      setErros(lista)
      setVez((v) => v + 1)
    },
    limpar: () => setErros([]),
    doCampo: (campo: string) => erros.find((e) => e.campo === campo)?.texto,
  }
}
export type Erros = ReturnType<typeof useErros>

function irParaCampo(id: string) {
  const campo = document.getElementById(id)
  if (!campo) return
  campo.focus()
  // deixa o rótulo à vista, e não só o campo
  campo.closest('.campo')?.scrollIntoView({ block: 'center' })
}

export function ResumoErros({ erros }: { erros: Erros }) {
  const caixa = useRef<HTMLDivElement>(null)
  const temErro = erros.erros.length > 0
  useEffect(() => {
    if (erros.vez > 0) caixa.current?.focus()
  }, [erros.vez])
  if (!temErro) return null
  return (
    <div className="resumo-erros" ref={caixa} tabIndex={-1} aria-labelledby="resumo-erros-t">
      <h2 id="resumo-erros-t">Corrija para continuar:</h2>
      <ul>
        {erros.erros.map((e, i) => (
          <li key={i}>
            {e.campo ? (
              <a
                href={`#${e.campo}`}
                onClick={(ev) => {
                  ev.preventDefault()
                  irParaCampo(e.campo!)
                }}
              >
                {e.texto}
              </a>
            ) : (
              e.texto
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

type CampoProps = {
  id: string
  rotulo: ReactNode | null // null quando o rótulo é o próprio h1
  dica?: ReactNode
  erro?: ReactNode
} & InputHTMLAttributes<HTMLInputElement>

const descritoPor = (id: string, dica: unknown, erro: unknown) =>
  [dica ? `${id}-dica` : '', erro ? `${id}-erro` : ''].filter(Boolean).join(' ') || undefined

function DicaEErro({ id, dica, erro }: { id: string; dica?: ReactNode; erro?: ReactNode }) {
  return (
    <>
      {dica && (
        <p id={`${id}-dica`} className="dica">
          {dica}
        </p>
      )}
      {erro && (
        <p id={`${id}-erro`} className="erro-campo">
          <span className="sr-only">Erro: </span>
          {erro}
        </p>
      )}
    </>
  )
}

export function Campo({ id, rotulo, dica, erro, ...entrada }: CampoProps) {
  return (
    <div className={erro ? 'campo campo-com-erro' : 'campo'}>
      {rotulo !== null && (
        <label className="rotulo" htmlFor={id}>
          {rotulo}
        </label>
      )}
      <DicaEErro id={id} dica={dica} erro={erro} />
      <input
        id={id}
        name={id}
        className="entrada"
        aria-invalid={erro ? true : undefined}
        aria-describedby={descritoPor(id, dica, erro)}
        {...entrada}
      />
    </div>
  )
}

// Senha pedida uma vez só, com o botão Mostrar (GOV.UK Password input). Ela
// volta a ficar oculta ao enviar o formulário e ao sair da tela, porque o
// computador pode ser de uso compartilhado (escola, biblioteca).
export function CampoSenha({ id, rotulo, dica, erro, ...entrada }: CampoProps) {
  const [visivel, setVisivel] = useState(false)
  const [anuncio, setAnuncio] = useState('')
  const campo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const form = campo.current?.form
    if (!form) return
    const ocultar = () => {
      // muda já, antes do envio, para o gerenciador de senhas ver um campo de senha
      if (campo.current) campo.current.type = 'password'
      setVisivel(false)
      setAnuncio('')
    }
    form.addEventListener('submit', ocultar)
    return () => form.removeEventListener('submit', ocultar)
  }, [])

  function alternar() {
    const agora = !visivel
    setVisivel(agora)
    setAnuncio(agora ? 'Sua senha está visível.' : 'Sua senha está oculta.')
  }

  return (
    <div className={erro ? 'campo campo-com-erro' : 'campo'}>
      <label className="rotulo" htmlFor={id}>
        {rotulo}
      </label>
      <DicaEErro id={id} dica={dica} erro={erro} />
      <div className="senha-linha">
        <input
          ref={campo}
          id={id}
          name={id}
          type={visivel ? 'text' : 'password'}
          className="entrada"
          spellCheck={false}
          autoCapitalize="none"
          aria-invalid={erro ? true : undefined}
          aria-describedby={descritoPor(id, dica, erro)}
          {...entrada}
        />
        <button
          type="button"
          className="botao botao-secundario botao-mostrar"
          aria-controls={id}
          aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          onClick={alternar}
        >
          {visivel ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {anuncio}
      </p>
    </div>
  )
}

type BotaoProps = {
  variante?: 'principal' | 'secundario'
  enviando?: boolean
  textoEnviando?: string
} & ButtonHTMLAttributes<HTMLButtonElement>

// O botão nunca fica desativado: enquanto envia, o texto muda e o segundo
// clique é ignorado por quem chama (aria-disabled avisa o leitor de tela)
export function Botao({
  variante = 'principal',
  enviando,
  textoEnviando,
  children,
  className,
  'aria-disabled': esperando,
  ...resto
}: BotaoProps) {
  return (
    <button
      className={`botao botao-${variante}${className ? ` ${className}` : ''}`}
      aria-disabled={enviando || esperando ? true : undefined}
      {...resto}
    >
      {enviando && textoEnviando ? textoEnviando : children}
    </button>
  )
}
