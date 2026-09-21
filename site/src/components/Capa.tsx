import { ficha, REPO_LABEL, REPO_URL } from '../data/conteudo'

export function Capa() {
  return (
    <section className="capa" aria-labelledby="titulo">
      <div className="caixa">
        <h1 id="titulo">
          Uma ponte entre quem <span className="grifo">sinaliza</span> e quem <span className="grifo">ouve</span>.
        </h1>
        <p className="resumo">
          Um sistema de código aberto que reconhece sinais da Língua Brasileira de Sinais pela webcam de
          um computador comum e os transforma em frases em português.
        </p>
        <a className="rolar mono" href="#problema">↓ Role para ler</a>

        <dl className="ficha">
          {ficha.map((item) => (
            <div key={item.rotulo}>
              <dt className="mono">{item.rotulo}</dt>
              <dd>{item.valor}</dd>
            </div>
          ))}
          <div>
            <dt className="mono">Código</dt>
            <dd><a href={REPO_URL}>{REPO_LABEL}</a></dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
