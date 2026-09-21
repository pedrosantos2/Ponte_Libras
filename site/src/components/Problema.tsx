import { Secao } from './Secao'

export function Problema() {
  return (
    <Secao id="por-que" titulo="Poucos ouvintes sabem Libras, e isso isola quem é surdo.">
      <div className="texto">
        <p>
          A Libras é língua oficial do Brasil, mas pessoas surdas ainda dependem de um intérprete até para
          situações simples do dia a dia, inclusive dentro da escola. Quando o intérprete não está por perto,
          a conversa entre um estudante surdo e seus colegas ou professores muitas vezes não acontece.
        </p>
        <p>
          O Ponte Libras quer ajudar de dois jeitos: <strong>apoiando conversas simples</strong> entre
          estudantes surdos e ouvintes, e <strong>dando retorno imediato</strong> a quem está aprendendo
          Libras e quer praticar.
        </p>
      </div>
      <div className="ressalva">
        <p>
          <strong>O Ponte Libras não substitui intérpretes.</strong> A Libras é uma língua completa, com
          gramática própria, e a interpretação profissional continua insubstituível. A ideia é ser um apoio e
          despertar nos ouvintes o interesse pela língua.
        </p>
      </div>
    </Secao>
  )
}
