import { Capa } from './components/Capa'
import { Funcionamento } from './components/Funcionamento'
import { Participe } from './components/Participe'
import { Problema } from './components/Problema'
import { ProximosPassos } from './components/ProximosPassos'
import { Resultados } from './components/Resultados'
import { Rodape } from './components/Rodape'
import { Topo } from './components/Topo'

export default function App() {
  return (
    <>
      <a className="pular mono" href="#conteudo">Pular para o conteúdo</a>
      <Topo />
      <main id="conteudo">
        <Capa />
        <hr className="filete" />
        <Problema />
        <hr className="filete" />
        <Funcionamento />
        <hr className="filete" />
        <Resultados />
        <hr className="filete" />
        <ProximosPassos />
        <Participe />
      </main>
      <Rodape />
    </>
  )
}
