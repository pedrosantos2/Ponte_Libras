import { videos } from '../data/conteudo'
import { Secao } from './Secao'

export function Demonstracao() {
  return (
    <Secao id="demonstracao" titulo="Veja funcionando" className="secao-gelo">
      <div className="texto">
        <p>
          Gravações feitas com o próprio sistema, num notebook comum, com a pessoa sentada em frente à
          webcam. Os vídeos não têm som: tudo o que acontece está escrito nas legendas.
        </p>
      </div>
      <div className="videos">
        {videos.map((v) => (
          <figure className="video" key={v.arquivo}>
            <video controls playsInline muted preload="none" poster={v.capa}
                   aria-describedby={`desc-${v.glossas.join('-')}`}>
              <source src={v.arquivo} type="video/mp4" />
            </video>
            <figcaption>
              <span className="video-glossas">
                {v.glossas.map((g) => <span className="glossa-texto" key={g}>{g}</span>)}
              </span>
              <span className="video-frase">{v.frase}</span>
            </figcaption>
            <details className="video-descricao">
              <summary>O que acontece no vídeo</summary>
              <p id={`desc-${v.glossas.join('-')}`}>{v.descricao}</p>
            </details>
          </figure>
        ))}
      </div>
    </Secao>
  )
}
