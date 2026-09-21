import { etapas, principios } from '../data/conteudo'
import { Secao } from './Secao'

export function Funcionamento() {
  return (
    <Secao id="como-funciona" titulo="Da câmera à frase em português" className="secao-gelo">
      <ol className="etapas">
        {etapas.map((e) => (
          <li key={e.titulo}>
            <h3>{e.titulo}</h3>
            <p>{e.texto}</p>
          </li>
        ))}
      </ol>
      <dl className="principios">
        {principios.map((pr) => (
          <div key={pr.titulo}>
            <dt>{pr.titulo}</dt>
            <dd>{pr.texto}</dd>
          </div>
        ))}
      </dl>
    </Secao>
  )
}
