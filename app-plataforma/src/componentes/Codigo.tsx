// O código de 8 números que chega por e-mail. Ele confirma o e-mail, entra
// sem senha e recupera a senha. Funciona mesmo quando a pessoa abre o e-mail
// no celular e o site no computador, o que um link não faz.
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { AuthError, EmailOtpType } from '@supabase/supabase-js'
import { FORA_DO_AR, mensagemDoErro } from '../lib/erros'
import { CODIGO_TAMANHO, CODIGO_VALIDADE, ESPERA_REENVIO_S, limparCodigo } from '../lib/regras'
import { supabase } from '../lib/supabase'
import { Botao, Campo, type Erros } from './Formulario'
import { Tela } from './Moldura'

// Lembra quando o painel mandou o último código para este e-mail, para o campo
// do código continuar na tela depois de recarregar a página (só nesta aba).
// Só o painel grava: nas outras telas, o Supabase responde igual mesmo quando
// não manda nada, e o painel diria "Mandamos um código" sem ter mandado.
const chave = (email: string) => `ponte-libras:codigo:${email.toLowerCase()}`

export function lembrarEnvio(email: string, quando: number) {
  try {
    sessionStorage.setItem(chave(email), String(quando))
  } catch {
    // navegação privada ou armazenamento bloqueado: só não lembra
  }
}

export function envioRecente(email: string): number | null {
  try {
    const quando = Number(sessionStorage.getItem(chave(email)))
    // o código vale por 1 hora
    return quando && Date.now() - quando < 3_600_000 ? quando : null
  } catch {
    return null
  }
}

// Segundos que faltam para poder pedir outro código
const segundosRestantes = (enviadoEm: number | null) =>
  enviadoEm ? Math.max(0, Math.ceil(ESPERA_REENVIO_S - (Date.now() - enviadoEm) / 1000)) : 0

function useEspera(enviadoEm: number | null) {
  const [resta, setResta] = useState(() => segundosRestantes(enviadoEm))
  useEffect(() => {
    const atualizar = () => setResta(segundosRestantes(enviadoEm))
    atualizar()
    const id = window.setInterval(atualizar, 1000)
    return () => window.clearInterval(id)
  }, [enviadoEm])
  return resta
}

type FormCodigoProps = {
  email: string
  tipo: Extract<EmailOtpType, 'email' | 'recovery'>
  erros: Erros
  textoBotao: string
  textoEnviando: string
  enviadoEm: number | null
  reenviar: () => Promise<AuthError | null>
  aoReenviar: (quando: number) => void
  // chamado antes de conferir: o login pode trocar de tela no meio do caminho
  antesDeConferir?: () => void
  aoFalhar?: () => void
  aoConfirmar?: () => void
}

export function FormCodigo(p: FormCodigoProps) {
  const [codigo, setCodigo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [reenviando, setReenviando] = useState(false)
  const [avisoReenvio, setAvisoReenvio] = useState('')
  const resta = useEspera(p.enviadoEm)

  async function conferir(e: FormEvent) {
    e.preventDefault()
    if (enviando) return
    const token = limparCodigo(codigo)
    if (!token) return p.erros.mostrar([{ campo: 'codigo', texto: 'Digite o código que mandamos por e-mail' }])
    if (!/^\d+$/.test(token)) return p.erros.mostrar([{ campo: 'codigo', texto: 'Digite só os números do código' }])
    if (token.length < CODIGO_TAMANHO || token.length > 10) {
      return p.erros.mostrar([{ campo: 'codigo', texto: `O código tem ${CODIGO_TAMANHO} números` }])
    }
    if (!supabase) return p.erros.mostrar([{ texto: FORA_DO_AR }])
    p.erros.limpar()
    setEnviando(true)
    p.antesDeConferir?.()
    const { error } = await supabase.auth.verifyOtp({ email: p.email, token, type: p.tipo })
    setEnviando(false)
    if (error) {
      p.aoFalhar?.()
      return p.erros.mostrar([{ campo: 'codigo', texto: mensagemDoErro(error) }])
    }
    p.aoConfirmar?.()
  }

  async function pedirOutro() {
    if (resta > 0 || reenviando) return
    setReenviando(true)
    setAvisoReenvio('')
    const error = await p.reenviar()
    setReenviando(false)
    if (error) return p.erros.mostrar([{ texto: mensagemDoErro(error) }])
    p.aoReenviar(Date.now())
    setCodigo('')
    setAvisoReenvio('Mandamos outro código. Use o mais novo.')
  }

  return (
    <>
      <form className="formulario" noValidate onSubmit={conferir}>
        <Campo
          id="codigo"
          rotulo="Código do e-mail"
          dica={`São ${CODIGO_TAMANHO} números.`}
          erro={p.erros.doCampo('codigo')}
          inputMode="numeric"
          autoComplete="one-time-code"
          spellCheck={false}
          className="entrada entrada-codigo"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
        />
        <Botao enviando={enviando} textoEnviando={p.textoEnviando}>
          {p.textoBotao}
        </Botao>
      </form>
      <div className="reenvio">
        <Botao
          type="button"
          variante="secundario"
          enviando={reenviando}
          textoEnviando="Mandando…"
          aria-disabled={resta > 0}
          aria-describedby={resta > 0 ? 'reenvio-espera' : undefined}
          onClick={pedirOutro}
        >
          Mandar outro código
        </Botao>
        {resta > 0 && (
          <p id="reenvio-espera" className="dica">
            Você pode pedir outro código daqui a {resta} {resta === 1 ? 'segundo' : 'segundos'}.
          </p>
        )}
        <p className="reenvio-aviso" role="status">
          {avisoReenvio}
        </p>
      </div>
    </>
  )
}

type TelaCodigoProps = Omit<FormCodigoProps, 'textoBotao' | 'textoEnviando'> & {
  textoBotao?: string
  textoEnviando?: string
  intro: ReactNode // a frase antes do e-mail em destaque
  depois?: ReactNode // o que vem depois do formulário
  outroEmail: () => void
}

export function TelaCodigo({ intro, depois, outroEmail, textoBotao, textoEnviando, ...form }: TelaCodigoProps) {
  return (
    <Tela titulo="Digite o código do e-mail" erros={form.erros}>
      <p>{intro}</p>
      <p className="email-destaque">{form.email}</p>
      <p>
        Errou o e-mail?{' '}
        <button type="button" className="link" onClick={outroEmail}>
          Usar outro e-mail
        </button>
      </p>
      <p>
        O código vale por {CODIGO_VALIDADE}. O e-mail pode levar alguns minutos. Olhe também a caixa de spam.
      </p>
      <FormCodigo textoBotao={textoBotao ?? 'Conferir o código'} textoEnviando={textoEnviando ?? 'Conferindo…'} {...form} />
      {depois}
    </Tela>
  )
}
