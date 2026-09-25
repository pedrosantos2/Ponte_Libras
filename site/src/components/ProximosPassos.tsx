import { proximosPassos } from '../data/conteudo'
import { Secao } from './Secao'

export function ProximosPassos() {
  return (
    <Secao id="proximos-passos" titulo="O que vem agora" className="secao-gelo">
      <ul className="passos">
        {proximosPassos.map((p) => (
          <li key={p.titulo}>
            <h3>{p.titulo}</h3>
            <p>{p.texto}</p>
          </li>
        ))}
      </ul>
    </Secao>
  )
}
