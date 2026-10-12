import { REPO_URL } from '../data/conteudo'
import { Secao } from './Secao'

export function Sobre() {
  return (
    <Secao id="sobre" titulo="A webcam vê o sinal. O Ponte Libras escreve a frase.">
      <div className="texto">
        <p>
          Um sistema de código aberto que reconhece sinais da Língua Brasileira de Sinais pela câmera e os
          transforma em português. O reconhecimento roda aqui mesmo, no seu navegador: a imagem da câmera não
          sai do seu computador.
        </p>
        <p>
          Trabalho de Conclusão de Curso em Engenharia de Software na Católica de Santa Catarina, em Jaraguá do
          Sul.
        </p>
      </div>
      <div className="botoes">
        <a className="botao botao-linha" href={REPO_URL}>Ver o código no GitHub</a>
      </div>
    </Secao>
  )
}
