import { proximosPassos } from '../data/conteudo'
import { ListaNumerada } from './ListaNumerada'
import { Secao } from './Secao'

export function ProximosPassos() {
  return (
    <Secao id="proximos" rotulo="04 — Próximos passos" titulo="O caminho passa pela comunidade surda.">
      <ListaNumerada itens={proximosPassos} />
    </Secao>
  )
}
