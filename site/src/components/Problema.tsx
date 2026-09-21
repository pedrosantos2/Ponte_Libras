import { Secao } from './Secao'

export function Problema() {
  return (
    <Secao id="problema" rotulo="01 — O problema" titulo="A Libras é língua oficial do Brasil. Quase ninguém em volta sabe usá-la.">
      <div className="texto">
        <p>
          Isso deixa pessoas surdas dependentes de um intérprete até para situações simples do dia a dia,
          inclusive dentro da escola. Quando o intérprete não está por perto, a conversa entre um estudante
          surdo e seus colegas ou professores muitas vezes simplesmente não acontece.
        </p>
        <p>
          O Ponte Libras atua em duas frentes: <strong>apoiar conversas simples</strong> entre estudantes
          surdos e ouvintes, reduzindo a barreira inicial, e <strong>ajudar quem está aprendendo Libras</strong> a
          praticar os sinais com retorno imediato.
        </p>
      </div>
      <div className="nota">
        <p>
          <strong>O Ponte Libras não substitui intérpretes.</strong> A Libras é uma língua completa, com
          gramática própria, e a interpretação profissional continua insubstituível. A proposta é ser um
          apoio e despertar nos ouvintes o interesse pela língua.
        </p>
      </div>
    </Secao>
  )
}
