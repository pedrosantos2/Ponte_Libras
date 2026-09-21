import { REPO_URL } from '../data/conteudo'
import { Secao } from './Secao'

export function Participe() {
  return (
    <Secao id="participe" rotulo="05 — Participe" titulo="Você sinaliza, ensina ou interpreta Libras?" invertida>
      <div className="texto">
        <p>
          O projeto precisa de pessoas para gravar sinais, indicar o vocabulário que faz falta na escola e
          dizer o que está errado. Se você é surdo, intérprete, professor ou estudante de Libras,{' '}
          <strong>sua participação vale mais do que qualquer linha de código</strong>.
        </p>
      </div>
      <a className="acao mono" href={`${REPO_URL}/issues`}>Falar com o projeto →</a>
    </Secao>
  )
}
