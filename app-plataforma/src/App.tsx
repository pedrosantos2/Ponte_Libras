// As rotas da plataforma. As de acesso são públicas; o painel exige login.
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './auth/AuthProvider'
import { LevarParaNovaSenha, RotaProtegida, SoVisitante } from './auth/Rotas'
import { ForaDoAr } from './componentes/Moldura'
import { supabase } from './lib/supabase'
import { Cadastrar } from './paginas/Cadastrar'
import { Entrar } from './paginas/Entrar'
import { EsqueciSenha } from './paginas/EsqueciSenha'
import { NovaSenha } from './paginas/NovaSenha'
import { Painel } from './paginas/Painel'

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        {/* Publicado sem os dados do Supabase: uma página só, que explica.
            Em desenvolvimento, as telas abrem com um aviso do que falta. */}
        {!supabase && !import.meta.env.DEV ? (
          <ForaDoAr />
        ) : (
          <>
            <LevarParaNovaSenha />
            <Routes>
              <Route element={<SoVisitante />}>
                <Route path="/entrar" element={<Entrar />} />
                <Route path="/cadastrar" element={<Cadastrar />} />
              </Route>
              <Route path="/esqueci-a-senha" element={<EsqueciSenha />} />
              <Route path="/nova-senha" element={<NovaSenha />} />
              <Route element={<RotaProtegida />}>
                <Route path="/" element={<Painel />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </>
        )}
      </BrowserRouter>
    </AuthProvider>
  )
}
