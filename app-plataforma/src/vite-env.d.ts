/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  // "true" quando o login com Google estiver configurado no Supabase
  readonly VITE_LOGIN_GOOGLE?: string
  // endereço da landing (o link "Conhecer o Ponte Libras")
  readonly VITE_LANDING_URL?: string
}
