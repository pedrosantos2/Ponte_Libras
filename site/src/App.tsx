import { Aplicativo } from './app/Aplicativo'
import { Demonstracao } from './components/Demonstracao'
import { Funcionamento } from './components/Funcionamento'
import { Participe } from './components/Participe'
import { Problema } from './components/Problema'
import { ProximosPassos } from './components/ProximosPassos'
import { Resultados } from './components/Resultados'
import { Rodape } from './components/Rodape'
import { Sobre } from './components/Sobre'

// Uma página só: o aplicativo ocupa a primeira tela, e a explicação do
// projeto vem logo abaixo, para quem quiser rolar.
export default function App() {
  return (
    <>
      <Aplicativo />
      <div className="sobre-projeto">
        <Sobre />
        <Demonstracao />
        <Problema />
        <Funcionamento />
        <Resultados />
        <ProximosPassos />
        <Participe />
      </div>
      <Rodape />
    </>
  )
}
