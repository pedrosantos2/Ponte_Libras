import { etapas, principios } from '../data/conteudo'
import { ListaNumerada } from './ListaNumerada'
import { Secao } from './Secao'

export function Funcionamento() {
  return (
    <Secao id="funciona" rotulo="02 — Como funciona" titulo="Da câmera à frase em português, em quatro etapas.">
      <ListaNumerada itens={etapas} />
      <dl className="principios">
        {principios.map((p) => (
          <div key={p.titulo}>
            <dt>{p.titulo}</dt>
            <dd>{p.texto}</dd>
          </div>
        ))}
      </dl>
    </Secao>
  )
}
