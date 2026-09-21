import { REPO_LABEL, REPO_URL } from '../data/conteudo'

export function Rodape() {
  return (
    <footer>
      <div className="caixa">
        <div>
          <p className="titulo">Ponte Libras</p>
          <p>Reconhecimento de Libras pela webcam</p>
        </div>
        <div>
          <p>Trabalho de Conclusão de Curso</p>
          <p>Engenharia de Software</p>
          <p>Católica de Santa Catarina · Jaraguá do Sul, SC</p>
        </div>
        <div>
          <p>Desenvolvido por Pedro Santos</p>
          <p><a href={REPO_URL}>{REPO_LABEL}</a></p>
        </div>
      </div>
    </footer>
  )
}
