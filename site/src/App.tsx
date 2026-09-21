import { Capa } from './components/Capa'
import { Funcionamento } from './components/Funcionamento'
import { Participe } from './components/Participe'
import { Problema } from './components/Problema'
import { ProximosPassos } from './components/ProximosPassos'
import { Resultados } from './components/Resultados'
import { Rodape } from './components/Rodape'

export default function App() {
  return (
    <>
      <a className="pular" href="#conteudo">Pular para o conteúdo</a>
      <Capa />
      <main id="conteudo">
        <Problema />
        <Funcionamento />
        <Resultados />
        <ProximosPassos />
        <Participe />
      </main>
      <Rodape />
    </>
  )
}
