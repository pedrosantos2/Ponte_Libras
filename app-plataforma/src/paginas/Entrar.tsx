import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { BotaoGoogle } from '../componentes/BotaoGoogle'
import { TelaCodigo } from '../componentes/Codigo'
import { Botao, Campo, CampoSenha, useErros, type ErroForm } from '../componentes/Formulario'
import { Tela } from '../componentes/Moldura'
import { esquecerSenha, guardarSenhaConhecida } from '../lib/confirmacao'
import { codigoDoErro, FORA_DO_AR, mensagemDoErro } from '../lib/erros'
import { deixarRecado, apagarRecado } from '../lib/recado'
import { CODIGO_TAMANHO, pareceEmail } from '../lib/regras'
import { supabase } from '../lib/supabase'

// Link de e-mail vencido (ou o Google cancelado) volta com o erro no
// endereço: #error_code=otp_expired&...
function errosDoLink(): ErroForm[] {
  const p = new URLSearchParams(window.location.hash.slice(1))
  if (!p.get('error') && !p.get('error_code')) return []
  return [
    {
      texto:
        p.get('error_code') === 'otp_expired'
          ? 'O link do e-mail não vale mais. Os links valem por 1 hora e funcionam uma vez só. Entre com sua senha ou com um código no e-mail.'
          : 'Não deu para entrar por esse caminho. Entre com sua senha ou com um código no e-mail.',
    },
  ]
}

// Para quem recebe o código: entrar sem senha, ou ativar a conta (quando o
// "Confirm email" do Supabase está ligado e a conta ainda não foi confirmada)
type Codigo = { email: string; enviadoEm: number; motivo: 'entrar' | 'ativar' }

export function Entrar() {
  const local = useLocation()
  const navegar = useNavigate()
  const estado = (local.state ?? {}) as { email?: string }
  const [email, setEmail] = useState(estado.email ?? '')
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState<'' | 'senha' | 'codigo'>('')
  const [codigo, setCodigo] = useState<Codigo | null>(null)
  const erros = useErros(errosDoLink())

  // o erro do link já foi lido: tira do endereço, para não voltar ao recarregar
  useEffect(() => {
    if (local.hash) navegar({ hash: '' }, { replace: true, state: local.state })
  }, [local.hash, local.state, navegar])

  function conferirEmail(): ErroForm | null {
    const limpo = email.trim()
    if (!limpo) return { campo: 'email', texto: 'Digite seu e-mail' }
    if (!pareceEmail(limpo)) return { campo: 'email', texto: 'Digite o e-mail completo, como nome@exemplo.com' }
    return null
  }

  async function entrar(e: FormEvent) {
    e.preventDefault()
    if (enviando) return
    const lista = [conferirEmail(), senha ? null : { campo: 'current-password', texto: 'Digite sua senha' }].filter(
      (x): x is ErroForm => x !== null,
    )
    if (lista.length) return erros.mostrar(lista)
    if (!supabase) return erros.mostrar([{ texto: FORA_DO_AR }])
    erros.limpar()
    setEnviando('senha')
    // guardada antes: assim que a sessão aparece, a rota já leva ao painel,
    // que usa a senha para não pedir de novo ao confirmar o e-mail
    guardarSenhaConhecida(email, senha)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
    setEnviando('')
    if (!error) return
    setSenha('')
    // a senha só vale se estava certa: o Supabase só responde
    // email_not_confirmed depois de conferir a senha
    if (codigoDoErro(error) === 'email_not_confirmed') {
      return erros.mostrar([
        {
          texto: (
            <>
              Sua conta ainda não foi confirmada.{' '}
              <button type="button" className="link" onClick={mandarCodigoDeAtivacao}>
                Mandar um código para confirmar
              </button>
            </>
          ),
        },
      ])
    }
    esquecerSenha()
    erros.mostrar([{ texto: mensagemDoErro(error) }])
  }

  // Entrar sem senha: o código chega por e-mail
  async function mandarCodigoDeEntrada() {
    if (enviando) return
    const problema = conferirEmail()
    if (problema) return erros.mostrar([problema])
    if (!supabase) return erros.mostrar([{ texto: FORA_DO_AR }])
    erros.limpar()
    setEnviando('codigo')
    const limpo = email.trim()
    const { error } = await supabase.auth.signInWithOtp({ email: limpo, options: { shouldCreateUser: false } })
    setEnviando('')
    // Para e-mail sem conta, o Supabase responde com erro (otp_disabled). A
    // tela segue igual, para ninguém descobrir quem tem conta aqui.
    if (error && codigoDoErro(error) !== 'otp_disabled') return erros.mostrar([{ texto: mensagemDoErro(error) }])
    setCodigo({ email: limpo, enviadoEm: Date.now(), motivo: 'entrar' })
  }

  async function mandarCodigoDeAtivacao() {
    if (enviando || !supabase) return
    setEnviando('codigo')
    const limpo = email.trim()
    const { error } = await supabase.auth.resend({ type: 'signup', email: limpo })
    setEnviando('')
    if (error) return erros.mostrar([{ texto: mensagemDoErro(error) }])
    erros.limpar()
    setCodigo({ email: limpo, enviadoEm: Date.now(), motivo: 'ativar' })
  }

  if (codigo) {
    const ativar = codigo.motivo === 'ativar'
    return (
      <TelaCodigo
        email={codigo.email}
        tipo="email"
        erros={erros}
        intro={
          ativar
            ? `Mandamos um código de ${CODIGO_TAMANHO} números para ativar a conta. Ele foi para:`
            : `Se este e-mail tiver conta no Ponte Libras, mandamos um código de ${CODIGO_TAMANHO} números para ele:`
        }
        textoBotao={ativar ? 'Ativar a conta' : 'Entrar'}
        textoEnviando={ativar ? 'Ativando…' : 'Entrando…'}
        enviadoEm={codigo.enviadoEm}
        aoReenviar={(quando) => setCodigo({ ...codigo, enviadoEm: quando })}
        reenviar={async () => {
          if (!supabase) return null
          if (ativar) return (await supabase.auth.resend({ type: 'signup', email: codigo.email })).error
          const { error } = await supabase.auth.signInWithOtp({ email: codigo.email, options: { shouldCreateUser: false } })
          return error && codigoDoErro(error) !== 'otp_disabled' ? error : null
        }}
        // o recado vai antes: assim que a sessão aparece, a rota já leva ao painel
        antesDeConferir={() => ativar && deixarRecado({ titulo: 'Conta ativada', texto: 'Seu e-mail está confirmado.' })}
        aoFalhar={apagarRecado}
        outroEmail={() => {
          erros.limpar()
          setCodigo(null)
        }}
      />
    )
  }

  return (
    <Tela titulo="Entrar no Ponte Libras" erros={erros}>
      <p className="apoio">
        Você só precisa de conta para gravar sinais. Ainda não tem?{' '}
        <Link to="/cadastrar" state={{ ...estado, email }}>
          Criar conta
        </Link>
      </p>
      <form className="formulario" noValidate onSubmit={entrar}>
        <Campo
          id="email"
          rotulo="E-mail"
          type="email"
          autoComplete="username"
          spellCheck={false}
          autoCapitalize="none"
          erro={erros.doCampo('email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <CampoSenha
          id="current-password"
          rotulo="Senha"
          autoComplete="current-password"
          erro={erros.doCampo('current-password')}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        <p className="depois-dos-campos">
          <Link to="/esqueci-a-senha" state={{ email }}>
            Esqueci minha senha
          </Link>
        </p>
        <Botao enviando={enviando === 'senha'} textoEnviando="Entrando…">
          Entrar
        </Botao>
      </form>
      <div className="alternativas">
        <p className="dica">Ou entre sem digitar a senha:</p>
        <Botao
          type="button"
          variante="secundario"
          enviando={enviando === 'codigo'}
          textoEnviando="Mandando o código…"
          onClick={mandarCodigoDeEntrada}
        >
          Receber um código no e-mail
        </Botao>
        <BotaoGoogle erros={erros} />
      </div>
    </Tela>
  )
}
