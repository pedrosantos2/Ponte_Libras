// Recuperar a senha: a pessoa diz o e-mail, recebe um código e, com ele,
// cria a senha nova em /nova-senha.
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { TelaCodigo } from '../componentes/Codigo'
import { Botao, Campo, useErros } from '../componentes/Formulario'
import { Tela } from '../componentes/Moldura'
import { FORA_DO_AR, mensagemDoErro } from '../lib/erros'
import { CODIGO_TAMANHO, pareceEmail } from '../lib/regras'
import { enderecoDe, supabase } from '../lib/supabase'

export function EsqueciSenha() {
  const local = useLocation()
  const navegar = useNavigate()
  const [email, setEmail] = useState((local.state as { email?: string } | null)?.email ?? '')
  const [enviando, setEnviando] = useState(false)
  const [enviadoEm, setEnviadoEm] = useState<number | null>(null)
  const erros = useErros()

  // Se o modelo de e-mail do Supabase ainda usar o link em vez do código, o
  // link leva para /nova-senha
  const mandar = async (para: string) =>
    supabase ? (await supabase.auth.resetPasswordForEmail(para, { redirectTo: enderecoDe('/nova-senha') })).error : null

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (enviando) return
    const limpo = email.trim()
    if (!limpo) return erros.mostrar([{ campo: 'email', texto: 'Digite seu e-mail' }])
    if (!pareceEmail(limpo)) return erros.mostrar([{ campo: 'email', texto: 'Digite o e-mail completo, como nome@exemplo.com' }])
    if (!supabase) return erros.mostrar([{ texto: FORA_DO_AR }])
    erros.limpar()
    setEnviando(true)
    const error = await mandar(limpo)
    setEnviando(false)
    // Erro de limite ou de rede aparece; conta inexistente não: a resposta é a
    // mesma para qualquer e-mail, para ninguém descobrir quem tem conta aqui
    if (error) return erros.mostrar([{ texto: mensagemDoErro(error) }])
    setEmail(limpo)
    setEnviadoEm(Date.now())
  }

  if (enviadoEm) {
    return (
      <TelaCodigo
        email={email}
        tipo="recovery"
        erros={erros}
        intro={`Se este e-mail tiver conta no Ponte Libras, mandamos um código de ${CODIGO_TAMANHO} números para ele:`}
        textoBotao="Criar a senha nova"
        textoEnviando="Conferindo…"
        enviadoEm={enviadoEm}
        aoReenviar={setEnviadoEm}
        reenviar={() => mandar(email)}
        // a sessão de recuperação já leva para /nova-senha; aqui só garante
        aoConfirmar={() => navegar('/nova-senha', { replace: true })}
        outroEmail={() => {
          erros.limpar()
          setEnviadoEm(null)
        }}
      />
    )
  }

  return (
    <Tela
      titulo="Qual é o e-mail da sua conta?"
      erros={erros}
      rotuloDe="email"
      voltar={
        <Link className="voltar" to="/entrar" state={{ email }}>
          Voltar
        </Link>
      }
    >
      <form className="formulario formulario-pergunta" noValidate onSubmit={enviar}>
        <Campo
          id="email"
          rotulo={null}
          dica="Vamos mandar um código para você criar uma senha nova."
          type="email"
          autoComplete="email"
          spellCheck={false}
          autoCapitalize="none"
          erro={erros.doCampo('email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Botao enviando={enviando} textoEnviando="Mandando…">
          Mandar o código
        </Botao>
      </form>
    </Tela>
  )
}
