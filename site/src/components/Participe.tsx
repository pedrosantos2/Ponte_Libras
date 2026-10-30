import { REPO_URL } from '../data/conteudo'
import { Secao } from './Secao'

export function Participe() {
  return (
    <Secao id="participe" titulo="Você sinaliza, ensina ou interpreta Libras?" className="participe">
      <div className="texto">
        <p>
          O projeto precisa de gente para gravar sinais, apontar o vocabulário que faz falta no dia a dia, na escola ou no trabalho, e dizer
          o que está errado. Se você é surdo, intérprete, professor ou estudante de Libras, a sua participação
          é o que mais pode melhorar o sistema.
        </p>
      </div>
      <div className="botoes">
        <a className="botao botao-cheio" href={`${REPO_URL}/issues`}>Deixar uma mensagem no GitHub</a>
      </div>
    </Secao>
  )
}
