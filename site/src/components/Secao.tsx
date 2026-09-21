import type { ReactNode } from 'react'

type Props = {
  id: string
  rotulo: string
  titulo: string
  invertida?: boolean
  children: ReactNode
}

/** Seção numerada: rótulo fixo na coluna da esquerda, conteúdo à direita. */
export function Secao({ id, rotulo, titulo, invertida, children }: Props) {
  return (
    <section id={id} className={invertida ? 'invertido' : undefined} aria-labelledby={`${id}-t`}>
      <div className="caixa secao">
        <p className="rotulo mono">{rotulo}</p>
        <div>
          <h2 id={`${id}-t`}>{titulo}</h2>
          {children}
        </div>
      </div>
    </section>
  )
}
