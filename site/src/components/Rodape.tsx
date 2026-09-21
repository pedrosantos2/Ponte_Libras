import { REPO_URL } from '../data/conteudo'

export function Rodape() {
  return (
    <footer>
      <div className="caixa">
        <div>
          <p><strong>Ponte Libras</strong></p>
          <p>Desenvolvido por Pedro Santos</p>
        </div>
        <div>
          <p>Engenharia de Software, Católica de Santa Catarina</p>
          <p><a href={REPO_URL}>Código-fonte no GitHub</a></p>
        </div>
      </div>
    </footer>
  )
}
