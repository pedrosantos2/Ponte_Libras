// Painel: confirmação de e-mail, contribuição pela webcam e dados da conta.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { GravadorSinais } from '../componentes/GravadorSinais'
import { useAuth } from '../auth/contexto'
import { envioRecente, FormCodigo, lembrarEnvio } from '../componentes/Codigo'
import { Botao, CampoSenha, ResumoErros, useErros } from '../componentes/Formulario'
import { Moldura, useTrocaDeTela } from '../componentes/Moldura'
import { conferirEmail, esquecerSenha, senhaGuardada, type EstadoEmail } from '../lib/confirmacao'
import { FORA_DO_AR, mensagemDoErro } from '../lib/erros'
import { apagarRecado, lerRecado, pegarCodigoParaMandar, type Recado } from '../lib/recado'
import { CODIGO_TAMANHO, CODIGO_VALIDADE } from '../lib/regras'
import { sair } from '../lib/sair'
import { supabase } from '../lib/supabase'

const CONFIRMADO: Recado = { titulo: 'E-mail confirmado', texto: 'Você já pode gravar sinais e contribuir pelo site.' }

export function Painel() {
  const { sessao } = useAuth()
  const navegar = useNavigate()
  const email = sessao?.user.email ?? ''
  const [recado, setRecado] = useState<Recado | null>(lerRecado)
  const [estado, setEstado] = useState<EstadoEmail>('conferindo')
  const [enviadoEm, setEnviadoEm] = useState<number | null>(() => envioRecente(email))
  const [mandando, setMandando] = useState(false)
  const [senha, setSenha] = useState('')
  const [conferindoSenha, setConferindoSenha] = useState(false)
  const erros = useErros()
  const h1 = useRef<HTMLHeadingElement>(null)
  const faixa = useRef<HTMLDivElement>(null)
  const tituloSenha = useRef<HTMLHeadingElement>(null)
  const avisoCodigo = useRef<HTMLParagraphElement>(null)

  // Com recado ("Senha trocada"), o foco vai para ele; sem recado, para o título
  useTrocaDeTela('Seu painel', erros.erros.length > 0, recado ? faixa : h1)

  // O recado aparece uma vez: some ao sair do painel
  useEffect(() => apagarRecado, [])

  // Quando uma ação muda a seção do e-mail, o foco vai para o que apareceu
  // (o aviso de confirmado ou o passo da senha), senão cairia no começo da página
  type Alvo = 'aviso' | 'senha' | 'codigo'
  const [focar, setFocar] = useState<{ alvo: Alvo; vez: number } | null>(null)
  const focarEm = (alvo: Alvo) => setFocar((f) => ({ alvo, vez: (f?.vez ?? 0) + 1 }))
  useEffect(() => {
    if (!focar) return
    const ref = { aviso: faixa, senha: tituloSenha, codigo: avisoCodigo }[focar.alvo]
    ref.current?.focus()
  }, [focar])

  function mudarEstado(novo: EstadoEmail, porAcao: boolean) {
    setEstado(novo)
    if (novo === 'confirmado') esquecerSenha()
    if (!porAcao) return
    if (novo === 'confirmado') {
      setRecado(CONFIRMADO)
      focarEm('aviso')
    } else if (novo === 'falta-senha') {
      focarEm('senha')
    } else {
      // o código estava certo, mas a confirmação não foi salva
      erros.mostrar([{ texto: 'O código está certo, mas não deu para salvar a confirmação. Tente de novo daqui a alguns minutos.' }])
    }
  }

  // Confere se o e-mail já foi confirmado. Roda de novo quando a sessão muda,
  // porque digitar o código abre uma sessão nova, que traz a prova.
  const token = sessao?.access_token
  useEffect(() => {
    let ativo = true
    conferirEmail(senhaGuardada(email)).then((novo) => {
      if (!ativo) return
      setEstado(novo)
      if (novo === 'confirmado') esquecerSenha()
    })
    return () => {
      ativo = false
    }
  }, [token, email])

  // porAcao: a pessoa apertou o botão, e o foco vai para o aviso de que o
  // código foi mandado (o botão some da tela). No envio automático depois do
  // cadastro, o foco fica no aviso de conta criada.
  async function mandarCodigo(para: string, porAcao: boolean) {
    if (!supabase) return erros.mostrar([{ texto: FORA_DO_AR }])
    setMandando(true)
    const { error } = await supabase.auth.signInWithOtp({ email: para, options: { shouldCreateUser: false } })
    setMandando(false)
    if (error) return erros.mostrar([{ texto: mensagemDoErro(error) }])
    const agora = Date.now()
    lembrarEnvio(para, agora)
    setEnviadoEm(agora)
    if (porAcao) focarEm('codigo')
  }

  // Logo depois do cadastro, o código de confirmação vai sozinho
  useEffect(() => {
    const para = pegarCodigoParaMandar()
    if (para) void mandarCodigo(para, false)
    // só ao abrir o painel
  }, [])

  async function conferirSenha(e: FormEvent) {
    e.preventDefault()
    if (conferindoSenha) return
    if (!senha) return erros.mostrar([{ campo: 'current-password', texto: 'Digite a senha desta conta' }])
    erros.limpar()
    setConferindoSenha(true)
    const novo = await conferirEmail(senha)
    setConferindoSenha(false)
    setSenha('')
    if (novo === 'falta-senha') {
      return erros.mostrar([
        { campo: 'current-password', texto: 'Essa não é a senha desta conta. Confira ou crie uma senha nova.' },
      ])
    }
    if (novo === 'erro' || novo === 'sem-banco') {
      return erros.mostrar([{ texto: 'Não deu para conferir agora. Tente de novo daqui a alguns minutos.' }])
    }
    mudarEstado(novo, true)
  }

  async function sairDaConta() {
    if (await sair()) navegar('/entrar', { replace: true })
  }

  const pedirCodigo = estado === 'falta-confirmar' || estado === 'sem-banco' || estado === 'erro'

  return (
    <Moldura
      topo={
        <div className="faixa-fase">
          <p className="caixa">
            <strong>Versão de teste.</strong> O Ponte Libras é um TCC e ainda está em construção.
          </p>
        </div>
      }
    >
      <div className="coluna coluna-painel">
        {recado && (
          <div className="faixa-sucesso" ref={faixa} tabIndex={-1} aria-labelledby="sucesso-t">
            <h2 id="sucesso-t">{recado.titulo}</h2>
            {recado.texto && <p>{recado.texto}</p>}
          </div>
        )}
        <h1 ref={h1} tabIndex={-1}>
          Seu painel
        </h1>

        {pedirCodigo && (
          <section className="secao" aria-labelledby="confirmar-t">
            <h2 id="confirmar-t">Confirme seu e-mail</h2>
            <ResumoErros erros={erros} />
            {estado === 'erro' ? (
              <p>Não deu para conferir agora se seu e-mail já foi confirmado. Tente de novo daqui a alguns minutos.</p>
            ) : (
              <p>Confirme que este e-mail é seu. Isso vai ser pedido para gravar sinais.</p>
            )}
            {estado === 'sem-banco' && import.meta.env.DEV && (
              <div className="aviso-dev" role="note">
                <p className="aviso-dev-titulo">Falta configurar</p>
                <p>
                  Para guardar a confirmação, rode <code>supabase/confirmar-email.sql</code> no SQL Editor do Supabase.
                </p>
              </div>
            )}
            {enviadoEm ? (
              <>
                <p ref={avisoCodigo} tabIndex={-1} className="sem-moldura">
                  Mandamos um código de {CODIGO_TAMANHO} números para <strong className="quebra">{email}</strong>. Ele
                  vale por {CODIGO_VALIDADE}. O e-mail pode levar alguns minutos. Olhe também a caixa de spam.
                </p>
                <FormCodigo
                  email={email}
                  tipo="email"
                  erros={erros}
                  textoBotao="Confirmar o e-mail"
                  textoEnviando="Confirmando…"
                  enviadoEm={enviadoEm}
                  aoReenviar={(quando) => {
                    lembrarEnvio(email, quando)
                    setEnviadoEm(quando)
                  }}
                  reenviar={async () =>
                    supabase
                      ? (await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })).error
                      : null
                  }
                  aoConfirmar={async () => mudarEstado(await conferirEmail(senhaGuardada(email)), true)}
                />
              </>
            ) : (
              <>
                <p>
                  Vamos mandar um código de {CODIGO_TAMANHO} números para <strong className="quebra">{email}</strong>.
                </p>
                <Botao type="button" enviando={mandando} textoEnviando="Mandando…" onClick={() => !mandando && mandarCodigo(email, true)}>
                  Mandar o código
                </Botao>
              </>
            )}
          </section>
        )}

        {/* O código provou que o e-mail é da pessoa. Como a conta pode ter
            sido criada por outra pessoa com este e-mail, falta mostrar que
            ela sabe a senha (ou criar uma nova). */}
        {estado === 'falta-senha' && (
          <section className="secao" aria-labelledby="senha-t">
            <h2 id="senha-t" ref={tituloSenha} tabIndex={-1}>
              Falta um passo: sua senha
            </h2>
            <ResumoErros erros={erros} />
            <p>O código do e-mail está certo. Para terminar, digite a senha desta conta. É para ter certeza de que a conta é sua.</p>
            <form className="formulario" noValidate onSubmit={conferirSenha}>
              <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
              <CampoSenha
                id="current-password"
                rotulo="Senha da conta"
                autoComplete="current-password"
                erro={erros.doCampo('current-password')}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
              <Botao enviando={conferindoSenha} textoEnviando="Conferindo…">
                Confirmar o e-mail
              </Botao>
            </form>
            <p className="depois-do-codigo">
              Não sabe a senha? <Link to="/nova-senha">Crie uma senha nova</Link>
            </p>
          </section>
        )}

        <section className="secao" aria-labelledby="gravar-t">
          <h2 id="gravar-t">Gravar sinais</h2>
          {estado === 'confirmado' ? <GravadorSinais /> : <p>Confirme seu e-mail acima para abrir a câmera, gravar e enviar sinais pelo site.</p>}
        </section>

        <section className="secao" aria-labelledby="conta-t">
          <h2 id="conta-t">Sua conta</h2>
          <p>
            Você entrou com <strong className="quebra">{email}</strong>.
          </p>
          <ul className="lista-acoes">
            <li>
              <Link to="/nova-senha">Trocar a senha</Link>
            </li>
            <li>
              <button type="button" className="link" onClick={sairDaConta}>
                Sair desta conta
              </button>
            </li>
          </ul>
        </section>
      </div>
    </Moldura>
  )
}
