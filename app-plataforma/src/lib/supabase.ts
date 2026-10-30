// Cliente do Supabase, que cuida de login, cadastro, sessão e recuperação de
// senha. Os dados do projeto vêm do .env.local (veja .env.example).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY

// Sem as variáveis, a plataforma abre e mostra o que falta configurar, em vez
// de quebrar a página inteira
export const supabase: SupabaseClient | null = url && chave ? createClient(url, chave) : null

// O botão do Google só aparece depois que ele for ativado no Supabase: antes
// disso, clicar levaria a uma página de erro do próprio Supabase
export const googleAtivo = import.meta.env.VITE_LOGIN_GOOGLE === 'true'

// Endereço da landing, para o link "Conhecer o Ponte Libras"
export const LANDING_URL = import.meta.env.VITE_LANDING_URL ?? 'http://localhost:5173'

// Endereço completo de uma página daqui, para os links do e-mail e o retorno
// do Google voltarem para a plataforma (funciona também num subcaminho)
export const enderecoDe = (caminho: string) =>
  new URL(caminho.replace(/^\//, ''), window.location.origin + import.meta.env.BASE_URL).toString()
