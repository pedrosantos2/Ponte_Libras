type Item = { titulo: string; texto: string }

export function ListaNumerada({ itens }: { itens: Item[] }) {
  return (
    <ol className="etapas">
      {itens.map((item, i) => (
        <li key={item.titulo}>
          <span className="num mono">{String(i + 1).padStart(2, '0')}</span>
          <div>
            <h3>{item.titulo}</h3>
            <p>{item.texto}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
