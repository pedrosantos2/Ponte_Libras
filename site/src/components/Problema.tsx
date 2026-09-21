import { Secao } from './Secao'

export function Problema() {
  return (
    <Secao id="por-que" titulo="Poucos ouvintes sabem Libras, e isso isola quem é surdo.">
      <div className="texto">
        <p>
          A Libras é língua oficial do Brasil, mas pessoas surdas ainda dependem de um intérprete até para
          situações simples do dia a dia: na escola, no trabalho, no atendimento de uma loja ou de um serviço.
          Quando o intérprete não está por perto, a conversa com colegas, professores ou clientes muitas vezes
          não acontece.
        </p>
        <p>
          O Ponte Libras quer ajudar de dois jeitos: <strong>apoiando conversas simples</strong> entre pessoas
          surdas e ouvintes, em escolas e empresas, e <strong>dando retorno imediato</strong> a quem está
          aprendendo Libras, como equipes que querem se comunicar melhor com colegas e clientes surdos.
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
