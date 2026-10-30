// Criar a senha nova. Chega aqui quem digitou o código de recuperação (ou
// abriu o link, se o e-mail ainda for o antigo) e quem já está logado e
// escolheu "Trocar a senha" no painel.
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/contexto'
import { Botao, CampoSenha, useErros } from '../componentes/Formulario'
import { Aguarde, Tela } from '../componentes/Moldura'
import { conferirEmail, esquecerSenha } from '../lib/confirmacao'
import { codigoDoErro, mensagemDoErro } from '../lib/erros'
import { deixarRecado } from '../lib/recado'
import { CODIGO_VALIDADE, SENHA_MINIMA } from '../lib/regras'
import { supabase } from '../lib/supabase'

export function NovaSenha() {
  const { sessao, carregando, recuperandoSenha } = useAuth()
  const navegar = useNavigate()
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const erros = useErros()

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (enviando || !supabase) return
    if (!senha) return erros.mostrar([{ campo: 'new-password', texto: 'Crie uma senha nova' }])
    if (senha.length < SENHA_MINIMA) {
      return erros.mostrar([{ campo: 'new-password', texto: `A senha precisa ter ${SENHA_MINIMA} caracteres ou mais` }])
    }
    erros.limpar()
    setEnviando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) {
      setEnviando(false)
      const qual = codigoDoErro(error)
      const doCampo = qual === 'weak_password' || qual === 'same_password'
      return erros.mostrar([{ campo: doCampo ? 'new-password' : undefined, texto: mensagemDoErro(error) }])
    }
    // Quem chegou pelo código do e-mail e criou a senha agora fica com o
    // e-mail confirmado (a senha nova é dela, e o Supabase desconectou as
    // outras sessões ao trocar a senha)
    esquecerSenha()
    await conferirEmail(senha)
    deixarRecado({ titulo: 'Senha trocada', texto: 'Da próxima vez, entre com a senha nova.' })
    navegar('/', { replace: true })
  }

  if (carregando) return <Aguarde texto="Conferindo sua conta…" />

  // Sem sessão: o código ou o link venceu, já foi usado, ou a página foi
  // aberta direto
  if (!sessao) {
    return (
      <Tela titulo="Este link não vale mais">
        <p>
          Os links e os códigos do e-mail valem por {CODIGO_VALIDADE} e funcionam uma vez só. Peça um código novo para
          criar a senha.
        </p>
        <p>
          <Link className="botao botao-principal" to="/esqueci-a-senha">
            Pedir um código novo
          </Link>
        </p>
        <p>
          <Link to="/entrar">Voltar para entrar</Link>
        </p>
      </Tela>
    )
  }

  const email = sessao.user.email ?? ''

  return (
    <Tela
      titulo="Crie uma senha nova"
      erros={erros}
      voltar={
        // na recuperação, a pessoa ainda precisa criar a senha antes de seguir
        !recuperandoSenha && (
          <Link className="voltar" to="/">
            Voltar para o painel
          </Link>
        )
      }
    >
      <p>
        Para a conta <strong className="quebra">{email}</strong>.
      </p>
      <form className="formulario" noValidate onSubmit={salvar}>
        {/* para o gerenciador de senhas saber de qual conta é a senha nova */}
        <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
        <CampoSenha
          id="new-password"
          rotulo="Senha nova"
          dica={`Use ${SENHA_MINIMA} caracteres ou mais.`}
          autoComplete="new-password"
          erro={erros.doCampo('new-password')}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        <Botao enviando={enviando} textoEnviando="Salvando…">
          Salvar a senha nova
        </Botao>
      </form>
    </Tela>
  )
}
