import { secoes } from '../data/conteudo'
import { Marca } from './Marca'

export function Topo() {
  return (
    <header className="topo">
      <div className="caixa">
        <a className="marca" href="#" aria-label="Ponte Libras, início">
          <Marca />
          Ponte Libras
        </a>
        <nav aria-label="Seções">
          <ul className="mono">
            {secoes.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.numero} {s.nome}</a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}
