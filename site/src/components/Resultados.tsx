import { resultados } from '../data/conteudo'
import { Secao } from './Secao'

export function Resultados() {
  return (
    <Secao id="resultados" titulo="Onde o protótipo está hoje">
      <div className="texto">
        <p>
          O sistema reconhece 11 sinais. Ele é sempre avaliado com <strong>pessoas que nunca apareceram no
          treino</strong>, que é o teste mais difícil e o único que mostra como ele se sai com alguém novo na
          frente da câmera.
        </p>
      </div>

      <div className="rolagem">
        <table>
          <caption>Acerto por sinal, testando com pessoas que o sistema nunca viu</caption>
          <thead>
            <tr>
              <th scope="col">Sinal</th>
              <th scope="col">Pessoas no treino</th>
              <th scope="col"><span className="sr-only">Gráfico</span></th>
              <th scope="col" className="num">Acerto</th>
            </tr>
          </thead>
          <tbody>
            {resultados.map((r) => (
              <tr key={r.sinal}>
                <th scope="row">{r.sinal}</th>
                <td className="pessoas">{r.pessoas}</td>
                <td className="trilho" aria-hidden="true"><span style={{ width: `${r.acerto}%` }} /></td>
                <td className="num">{r.acerto}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="conclusao">Os sinais que mais acertam são os que mais pessoas diferentes gravaram.</p>

      <p className="fontes">
        Os vídeos de treino vêm de três bases públicas: V-LIBRASIL (UFPE), MINDS-Libras (UFMG) e
        MALTA-LIBRAS, que reúne dicionários de Libras de instituições como UFSC, UFV e USP. Obrigado aos
        grupos de pesquisa que abriram esses dados.
      </p>
    </Secao>
  )
}
