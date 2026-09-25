import type { ReactNode } from 'react'

type Props = {
  id: string
  titulo: string
  className?: string
  children: ReactNode
}

export function Secao({ id, titulo, className, children }: Props) {
  return (
    <section id={id} className={['secao', className].filter(Boolean).join(' ')} aria-labelledby={`${id}-t`}>
      <div className="caixa">
        <h2 id={`${id}-t`}>{titulo}</h2>
        {children}
      </div>
    </section>
  )
}
