// Regras dos campos, iguais em todas as telas.

// Mínimo de caracteres da senha, no cadastro e na troca de senha. Deixe igual
// ao mínimo configurado no Supabase (Authentication → Providers → Email).
export const SENHA_MINIMA = 8

// Quantos números tem o código do e-mail. Deixe igual ao "Email OTP Length"
// do Supabase (Authentication → Providers → Email).
export const CODIGO_TAMANHO = 8

// Quanto tempo o código vale, em texto. Deixe igual ao "Email OTP Expiration"
// do Supabase (o padrão é 3600 segundos).
export const CODIGO_VALIDADE = '1 hora'

// O Supabase só deixa pedir outro código depois deste tempo
export const ESPERA_REENVIO_S = 60

// Só confere se parece um e-mail (algo@algo.algo). Quem diz se ele existe é o
// próprio e-mail que chega.
export const pareceEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

// O código pode vir colado com espaço ou hífen ("123 456", "123-456")
export const limparCodigo = (codigo: string) => codigo.replace(/[\s-]/g, '')
