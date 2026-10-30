# Ponte Libras — Plataforma

A área do usuário do Ponte Libras, com login. É um site **separado** da landing
(`../site`): tem `package.json`, rotas e build próprios e roda na porta **5174**.
Nada é importado da landing; cores, fonte e os pontos da mão foram copiados.

Stack: Vite + React + TypeScript, React Router para as rotas e
[Supabase Auth](https://supabase.com/docs/guides/auth) para login, cadastro e
recuperação de senha.

A conta serve para **gravar e enviar sinais pelo navegador**.
Traduzir pela câmera não vai precisar de conta.

## Rodar

```bash
npm install
cp .env.example .env.local   # e preencha (veja abaixo)
npm run dev                  # http://localhost:5174
```

Sem o `.env.local`, a plataforma abre em modo de desenvolvimento com um aviso
do que falta configurar. Publicada sem as variáveis, ela mostra só a página
"O acesso está fora do ar agora".

## Rotas

| Endereço | O que é | Quem vê |
|---|---|---|
| `/entrar` | senha, ou código no e-mail, ou Google | só quem não está logado |
| `/cadastrar` | criar conta (e-mail e uma senha só) | só quem não está logado |
| `/esqueci-a-senha` | pede o e-mail, manda o código, confere | qualquer pessoa |
| `/nova-senha` | cria a senha nova | quem digitou o código de recuperação ou está logado |
| `/` (painel) | confirmar o e-mail, dados da conta | só quem está logado; sem login, vai para `/entrar` e volta depois |

## Como a conta funciona

- **Código de 8 números, não link.** Confirmar o e-mail, entrar sem senha e
  recuperar a senha usam um código que chega por e-mail e é digitado na própria
  tela. Funciona mesmo quando a pessoa abre o e-mail no celular e o site no
  computador, o que um link não faz.
- **O cadastro não trava.** A pessoa cria a conta e já entra no painel. O
  código de confirmação vai sozinho, e só a gravação de sinais vai esperar o
  e-mail ser confirmado.
- **Onde fica a confirmação.** Com "Confirm email" desligado, o Supabase marca
  todo e-mail como confirmado, então esse campo não prova nada. A confirmação
  de verdade fica na tabela `emails_confirmados`, gravada pela função
  `conferir_email()` (`supabase/confirmar-email.sql`) quando:
  1. a sessão foi aberta com um código mandado para o e-mail atual da conta
     (ou pelo Google, com o mesmo e-mail); e
  2. quem abriu a sessão sabe a senha da conta. Como o cadastro não confirma o
     e-mail na hora, outra pessoa pode ter criado a conta com o seu e-mail e
     escolhido a senha. Por isso, quem entra com o código e não sabe a senha
     vê o passo "Falta um passo: sua senha", com a opção de criar uma senha
     nova (o Supabase desconecta as outras sessões quando a senha muda).
  No cadastro normal, a senha que a pessoa acabou de criar fica guardada só
  na memória da aba por 30 minutos, e o código confirma direto.
- **Trocar de e-mail.** A plataforma não oferece troca de e-mail, mas a API do
  Supabase permite. Um gatilho em `auth.users` apaga a confirmação quando o
  e-mail muda, e só um código mandado depois da troca vale.
- **Quem tem conta.** Entrar com senha responde igual para qualquer e-mail.
  Entrar com código e recuperar a senha abrem a mesma tela para qualquer
  e-mail; só um segundo pedido em menos de 60 segundos dá erro de limite, e
  isso acontece só para e-mail que tem conta. O cadastro revela de vez: com
  "Confirm email" desligado, o Supabase avisa que o e-mail já tem conta, e a
  tela diz isso (com os links para entrar ou criar uma senha nova). É o preço
  de não travar o cadastro.

## Configurar o Supabase (uma vez)

1. Crie um projeto em [supabase.com](https://supabase.com) (o plano gratuito basta).
2. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public**
   para o `.env.local`. A chave `service_role` nunca vai no front.
3. Em **SQL Editor → New query**, cole e rode `supabase/confirmar-email.sql`
   (pode rodar de novo quando o arquivo mudar; ele não apaga as confirmações).
   Ele foi testado num Postgres de verdade com um esqueleto das tabelas
   `auth`, incluindo os dois ataques descritos acima.
4. Em **Authentication → Providers → Email** (ou **Sign In / Providers**):
   - **Confirm email**: ligado no projeto atual (o cadastro pede o código antes de entrar; o painel também registra a confirmação para liberar os envios).
   - **Minimum password length**: **8**, igual a `SENHA_MINIMA` (`src/lib/regras.ts`).
   - **Email OTP Length**: **8** e **Email OTP Expiration**: **3600** segundos,
     iguais a `CODIGO_TAMANHO` e `CODIGO_VALIDADE` (`src/lib/regras.ts`).
5. Em **Authentication → URL Configuration**:
   - **Site URL**: o endereço de produção da plataforma (em desenvolvimento,
     `http://localhost:5174`).
   - **Redirect URLs**: a origem e a página de nova senha, de produção e de
     desenvolvimento — por exemplo `http://localhost:5174/` e
     `http://localhost:5174/nova-senha`. Não use curingas abertos
     (`https://*.vercel.app/**`): eles deixariam outro site receber o login.
6. **SMTP próprio** (obrigatório para gente de verdade): o envio de e-mail
   padrão do Supabase só entrega para os membros da sua organização no
   Supabase e manda pouquíssimos e-mails por hora. Crie uma conta num serviço
   como [Resend](https://resend.com) ou [Brevo](https://www.brevo.com) e
   preencha em **Authentication → Emails → SMTP Settings**. O remetente pode
   ser "Ponte Libras". Depois, em **Authentication → Rate Limits**, ajuste o
   limite de e-mails por hora.
7. Em **Authentication → Emails → Templates**, troque o link pelo código
   (`{{ .Token }}`) nos modelos abaixo.

### Modelos de e-mail

**Magic Link** (confirmar o e-mail e entrar sem senha)

- Assunto: `Seu código do Ponte Libras`
- Corpo:

```html
<h2>Seu código do Ponte Libras</h2>
<p>Digite este código na página do Ponte Libras:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:4px">{{ .Token }}</p>
<p>O código vale por 1 hora e funciona uma vez só.</p>
<p>Se você não pediu este código, pode ignorar este e-mail.</p>
```

**Reset Password** (criar uma senha nova)

- Assunto: `Código para criar uma senha nova no Ponte Libras`
- Corpo:

```html
<h2>Criar uma senha nova</h2>
<p>Digite este código na página do Ponte Libras para criar uma senha nova:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:4px">{{ .Token }}</p>
<p>O código vale por 1 hora e funciona uma vez só.</p>
<p>Se você não pediu uma senha nova, pode ignorar este e-mail. Sua senha continua a mesma.</p>
```

**Confirm signup** (só se você deixar o "Confirm email" ligado)

- Assunto: `Ative sua conta no Ponte Libras`
- Corpo: igual ao do Magic Link, com o título "Ative sua conta".

Com o "Confirm email" ligado, a plataforma também funciona: depois do
cadastro, ela pede o código na hora, e a pessoa só entra depois de digitá-lo.

### Login com Google (opcional)

1. No [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   crie uma credencial **OAuth 2.0 Client ID** do tipo *Web application*.
2. Em **Authorized redirect URIs**, use
   `https://SEU-PROJETO.supabase.co/auth/v1/callback`.
3. No Supabase, em **Authentication → Providers → Google**, ative e cole o
   *Client ID* e o *Client secret*.
4. No `.env.local`, mude `VITE_LOGIN_GOOGLE=true` e reinicie o `npm run dev`.

Quem entra pelo Google já conta como e-mail confirmado.

## Publicar

- `npm run build` gera `dist/`. É um site de página única com rotas no
  navegador: a hospedagem precisa devolver o `index.html` para qualquer
  endereço (no Netlify/Vercel é uma regra de *rewrite*; no GitHub Pages, um
  `404.html` igual ao `index.html`). Sem isso, abrir `/nova-senha` direto dá 404.
- Defina `VITE_LANDING_URL` com o endereço da landing (link do rodapé).
- Na **landing**, defina `VITE_PLATAFORMA_URL` com o endereço da plataforma no
  build de produção. Sem ela, o botão "Entrar" aponta para
  `http://localhost:5174`.

## Design

As telas seguem padrões de serviço público (GOV.UK Design System) e as regras
do web.dev para formulários de login: uma coluna alinhada à esquerda, sem
cartão; uma senha só, com o botão "Mostrar"; erros num resumo no topo e junto
de cada campo; nenhum botão desativado. O turquesa só aparece onde está a
Libras: a marca (um quadro do sinal OI) e a animação da mão em Criar conta. O
turquesa-forte, mais escuro, é só a borda dos avisos de sucesso. As regras de
cor, tipo e espaço estão comentadas no topo de `src/styles.css`.


## Contribuições pela webcam

O painel libera `GravadorSinais` após a confirmação de e-mail. Ele usa MediaRecorder,
sem áudio: três segundos de preparo, um segundo de repouso, dois para o sinal e
um de repouso final. A prévia ao vivo é espelhada; o arquivo mantém a orientação
original da câmera. A pessoa revisa, autoriza o uso e envia manualmente.

Depois de configurar o login, rode **`supabase/gravar-sinais.sql`** no SQL Editor.
Isso cria o bucket privado `sinais-contribuidos`, com limite de 10 MB por vídeo
e políticas que exigem login, e-mail confirmado, pasta do próprio usuário e um
sinal válido. A chave service_role não é usada no front-end.

Os vídeos são salvos em `<user-id>/<SINAL>/<uuid>.webm` ou `.mp4`. Os metadados
incluem o sinal e a autorização `pesquisa-video-v1`. A equipe revisa os vídeos
no painel administrativo do Supabase; não há publicação nem treino automáticos.
Esses vídeos ainda precisam de extração de coordenadas antes de entrar no treino.
O coletor Python continua disponível como alternativa local.

Estado da configuração local (28/10/2026): projeto `ponte libras` conectado,
`confirmar-email.sql` e `gravar-sinais.sql` aplicados e conferidos no banco.
Bucket privado, limite de 10 MB e duas políticas de acesso. A confirmação
nativa de e-mail permanece ligada; códigos têm 8 dígitos, validade de 1 hora
e senha mínima de 8 caracteres. URLs locais autorizadas na porta 5174.
As variáveis públicas ficam em `.env.local`, ignorado pelo Git.

Pendente: configurar SMTP próprio e os templates com `{{ .Token }}`. O plano
atual não permite editar templates usando o serviço de e-mail padrão. Até
isso ser resolvido, o fluxo por código não está pronto para participantes.

Validação realizada: compilação, API de autenticação, bloqueio da função de
confirmação e do upload para sessões anônimas. Ainda é necessário testar
câmera, revisão, confirmação por e-mail e envio com contas reais, incluindo
isolamento entre dois participantes.


### Sugestões de novos sinais

No seletor, a opção “Sugerir um sinal novo” permite informar o nome em português
(2 a 80 caracteres). O nome fica preso ao clipe durante a revisão e o envio.
Os vídeos são guardados em `<user-id>/_NOVO/<uuid>.<ext>`; o nome digitado nunca
entra no caminho. Os metadados `nome_sugerido`, `tipo=sinal-novo` e
`revisao=pendente` identificam a sugestão para a equipe. Nenhuma sugestão é
adicionada automaticamente ao vocabulário ou ao treino.

Para atualizar um banco que já recebeu o SQL inicial, execute
`supabase/novos-sinais.sql`. Instalações novas podem usar `gravar-sinais.sql`,
que já inclui a opção. A privacidade e as restrições anteriores são mantidas.


### Repetições por sinal

A coleta propõe dez amostras por sinal, com revisão e autorização em cada envio.
O botão “Gravar próxima amostra” mantém o sinal e o nome sugerido; cada amostra
é uma nova captura, não uma cópia do vídeo anterior. A meta é opcional.
O contador só avança após o recebimento confirmado, preserva o progresso ao
trocar de sinal dentro da mesma sessão e reinicia ao sair da página.
Metadados `serie_id`, `amostra` e `meta_amostras` agrupam os envios para revisão.
Nenhuma migração de banco é necessária: esses campos usam os metadados do arquivo.
