import { resultados } from '../data/conteudo'
import { Secao } from './Secao'

export function Resultados() {
  return (
    <Secao id="resultados" rotulo="03 — Onde estamos" titulo="Um protótipo, medido com honestidade.">
      <div className="texto">
        <p>
          O sistema é sempre avaliado com <strong>pessoas que ele nunca viu durante o treino</strong>. É a
          medida mais dura, e a única que diz como ele se comporta com alguém novo na frente da câmera.
        </p>
      </div>

      <div className="rolagem">
        <table>
          <caption className="mono">Acerto por sinal · pessoas nunca vistas</caption>
          <thead>
            <tr>
              <th scope="col" className="mono">Sinal</th>
              <th scope="col" className="mono">Pessoas no treino</th>
              <th scope="col" className="mono" colSpan={2}>Acerto</th>
            </tr>
          </thead>
          <tbody>
            {resultados.map((r) => (
              <tr key={r.sinal}>
                <th scope="row">{r.sinal}</th>
                <td>{r.pessoas}</td>
                <td className="b" aria-hidden="true">
                  <div><span className="barra" style={{ width: `${Math.max(r.acerto, 2)}%` }} /></div>
                </td>
                <td className="n">{r.acerto}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <blockquote>
        <p>
          O que mais melhora o reconhecimento não é a tecnologia. É a <em>quantidade de pessoas diferentes</em> sinalizando nos dados.
        </p>
      </blockquote>

      <p className="fonte">
        Dados de treino: V-LIBRASIL (UFPE), MINDS-Libras (UFMG) e MALTA-LIBRAS, que reúne dicionários de
        Libras de instituições como UFSC, UFV e USP. Agradecemos aos grupos de pesquisa que tornaram esses
        vídeos públicos.
      </p>
    </Secao>
  )
}
