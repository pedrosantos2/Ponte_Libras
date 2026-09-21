import { REPO_URL } from '../data/conteudo'
import { CameraMaos } from './CameraMaos'

export function Capa() {
  return (
    <header className="capa">
      <div className="caixa">
        <div className="capa-barra">
          <a className="nome" href="#">Ponte Libras</a>
          <nav aria-label="Seções">
            <ul>
              <li><a href="#como-funciona">Como funciona</a></li>
              <li><a href="#resultados">Resultados</a></li>
              <li><a href="#participe">Participe</a></li>
            </ul>
          </nav>
        </div>

        <div className="capa-corpo">
          <div>
            <h1><span className="linha">A webcam vê o sinal.</span> <span className="linha">O Ponte Libras escreve a frase.</span></h1>
            <p className="resumo">
              Um sistema de código aberto que reconhece sinais da Língua Brasileira de Sinais e os transforma
              em frases em português, no próprio computador e sem internet.
            </p>
            <p className="credito">
              Trabalho de Conclusão de Curso em Engenharia de Software na Católica de Santa Catarina, em
              Jaraguá do Sul.
            </p>
            <div className="botoes">
              <a className="botao botao-cheio" href="#como-funciona">Ver como funciona</a>
              <a className="botao botao-linha" href={REPO_URL}>Ver o código no GitHub</a>
            </div>
          </div>
          <CameraMaos />
        </div>
      </div>
    </header>
  )
}
