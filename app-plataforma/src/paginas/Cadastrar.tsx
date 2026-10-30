import { lazy, Suspense, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { BotaoGoogle } from '../componentes/BotaoGoogle'
import { TelaCodigo } from '../componentes/Codigo'
import { Botao, Campo, CampoSenha, useErros, type ErroForm } from '../componentes/Formulario'
import { Tela } from '../componentes/Moldura'
import { esquecerSenha, guardarSenhaConhecida } from '../lib/confirmacao'
import { codigoDoErro, FORA_DO_AR, mensagemDoErro } from '../lib/erros'
import { apagarRecado, deixarRecado, pedirCodigoAoAbrir, pegarCodigoParaMandar } from '../lib/recado'
import { CODIGO_TAMANHO, pareceEmail, SENHA_MINIMA } from '../lib/regras'
import { enderecoDe, googleAtivo, supabase } from '../lib/supabase'

// A animação da mão só carrega depois do formulário
const MaoGravacao = lazy(() => import('../componentes/MaoGravacao'))

export function Cadastrar() {
  const local = useLocation()
  const estado = (local.state ?? {}) as { email?: string }
  const [email, setEmail] = useState(estado.email ?? '')
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  // Só com o "Confirm email" do Supabase ligado: a conta espera o código
  const [codigo, setCodigo] = useState<{ email: string; enviadoEm: number } | null>(null)
  const erros = useErros()

  async function criar(e: FormEvent) {
    e.preventDefault()
    if (enviando) return
    const limpo = email.trim()
    const lista: ErroForm[] = []
    if (!limpo) lista.push({ campo: 'email', texto: 'Digite seu e-mail' })
    else if (!pareceEmail(limpo)) lista.push({ campo: 'email', texto: 'Digite o e-mail completo, como nome@exemplo.com' })
    if (!senha) lista.push({ campo: 'new-password', texto: 'Crie uma senha' })
    else if (senha.length < SENHA_MINIMA) {
      lista.push({ campo: 'new-password', texto: `A senha precisa ter ${SENHA_MINIMA} caracteres ou mais` })
    }
    if (lista.length) return erros.mostrar(lista)
    if (!supabase) return erros.mostrar([{ texto: FORA_DO_AR }])
    erros.limpar()
    setEnviando(true)
    // O recado e o pedido de código vão antes: assim que a sessão aparece, a
    // rota de visitante já leva ao painel, e é ele que manda o código
    deixarRecado({ titulo: 'Conta criada', texto: 'Agora confirme seu e-mail com o código que mandamos.' })
    pedirCodigoAoAbrir(limpo)
    // para não pedir a senha de novo ao confirmar o e-mail (fica só na memória)
    guardarSenhaConhecida(limpo, senha)
    const { data, error } = await supabase.auth.signUp({
      email: limpo,
      password: senha,
      options: { emailRedirectTo: enderecoDe('/') },
    })
    setEnviando(false)
    if (data.session) return
    apagarRecado()
    pegarCodigoParaMandar()
    if (error) {
      esquecerSenha()
      const qual = codigoDoErro(error)
      if (qual === 'user_already_exists' || qual === 'email_exists') {
        return erros.mostrar([
          {
            texto: (
              <>
                Este e-mail já tem conta.{' '}
                <Link to="/entrar" state={{ email: limpo }}>
                  Entrar
                </Link>{' '}
                ou{' '}
                <Link to="/esqueci-a-senha" state={{ email: limpo }}>
                  criar uma senha nova
                </Link>
                .
              </>
            ),
          },
        ])
      }
      if (qual === 'weak_password') return erros.mostrar([{ campo: 'new-password', texto: mensagemDoErro(error) }])
      return erros.mostrar([{ texto: mensagemDoErro(error) }])
    }
    // Sem sessão e sem erro: o "Confirm email" está ligado. O Supabase manda
    // o código se a conta é nova ou ainda não foi confirmada; se o e-mail já
    // foi confirmado antes, não manda nada e responde igual. A tela cobre os
    // dois casos sem dizer qual é.
    setCodigo({ email: limpo, enviadoEm: Date.now() })
  }

  if (codigo) {
    return (
      <TelaCodigo
        email={codigo.email}
        tipo="email"
        erros={erros}
        intro={`Se este e-mail precisa de confirmação, mandamos um código de ${CODIGO_TAMANHO} números para ele:`}
        textoBotao="Ativar a conta"
        textoEnviando="Ativando…"
        enviadoEm={codigo.enviadoEm}
        aoReenviar={(quando) => setCodigo({ ...codigo, enviadoEm: quando })}
        reenviar={async () => (supabase ? (await supabase.auth.resend({ type: 'signup', email: codigo.email })).error : null)}
        antesDeConferir={() => deixarRecado({ titulo: 'Conta ativada', texto: 'Seu e-mail está confirmado. Avisamos por e-mail quando a gravação abrir.' })}
        aoFalhar={apagarRecado}
        outroEmail={() => {
          erros.limpar()
          setCodigo(null)
        }}
        depois={
          <p className="depois-do-codigo">
            Já confirmou este e-mail antes? Então entre com sua senha.{' '}
            <Link to="/entrar" state={{ email: codigo.email }}>
              Entrar
            </Link>{' '}
            ou{' '}
            <Link to="/esqueci-a-senha" state={{ email: codigo.email }}>
              criar uma senha nova
            </Link>
            .
          </p>
        }
      />
    )
  }

  return (
    <Tela titulo="Crie sua conta para gravar sinais" erros={erros}>
      <p className="apoio">
        Com a conta, você grava sinais da Libras pela câmera. As gravações ensinam o Ponte Libras a reconhecer mais
        sinais, com sua autorização antes de cada envio.
      </p>
      <p>
        Já tem conta?{' '}
        <Link to="/entrar" state={{ ...estado, email }}>
          Entrar
        </Link>
      </p>
      <p className="lista-titulo">Para gravar, você vai precisar de:</p>
      <ul className="lista">
        <li>uma câmera, no computador ou no celular;</li>
        <li>um lugar com boa luz, com as duas mãos à vista.</li>
      </ul>
      <p>Depois de confirmar seu e-mail, você pode gravar, revisar e enviar sinais pelo painel.</p>

      <form className="formulario" noValidate onSubmit={criar}>
        <Campo
          id="email"
          rotulo="E-mail"
          dica="Vamos mandar um código para confirmar que o e-mail é seu."
          type="email"
          autoComplete="email"
          spellCheck={false}
          autoCapitalize="none"
          erro={erros.doCampo('email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <CampoSenha
          id="new-password"
          rotulo="Crie uma senha"
          dica={`Use ${SENHA_MINIMA} caracteres ou mais.`}
          autoComplete="new-password"
          erro={erros.doCampo('new-password')}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        <Botao enviando={enviando} textoEnviando="Criando a conta…">
          Criar conta
        </Botao>
      </form>
      {googleAtivo && (
        <div className="alternativas">
          <p className="dica">Ou use sua conta do Google:</p>
          <BotaoGoogle erros={erros} />
        </div>
      )}

      <section className="como-grava" aria-labelledby="como-grava-t">
        <h2 id="como-grava-t">Como fica uma gravação</h2>
        <Suspense fallback={<div className="camera-reserva" />}>
          <MaoGravacao />
        </Suspense>
      </section>
    </Tela>
  )
}
