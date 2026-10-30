import { useEffect, useRef, useState } from 'react'
import { CameraMaos } from './components/CameraMaos'
import { Demonstracao } from './components/Demonstracao'
import { Funcionamento } from './components/Funcionamento'
import { Problema } from './components/Problema'
import { ProximosPassos } from './components/ProximosPassos'
import { Resultados } from './components/Resultados'
import { Rodape } from './components/Rodape'
import { PLATAFORMA_URL, REPO_URL } from './data/conteudo'

const paginas = [ ['/', 'Início'], ['/tutoriais', 'Tutoriais'], ['/projeto', 'O projeto'], ['/contribuir', 'Contribuir'] ]
const titulos: Record<string, string> = { '/': 'Início', '/tutoriais': 'Tutoriais', '/tutoriais/gravar': 'Como gravar sinais', '/projeto': 'O projeto', '/contribuir': 'Contribuir' }
const caminho = () => window.location.hash.slice(1).split('#')[0] || '/'

function Cabecalho({ rota }: { rota: string }) {
  return <header className="portal-topo"><div className="caixa portal-barra">
    <a className="portal-marca" href="#/" aria-label="Ponte Libras, início"><span aria-hidden="true" className="marca-simbolo">p<span>l</span></span>Ponte Libras</a>
    <nav aria-label="Principal">{paginas.map(([url, nome]) => <a key={url} href={`#${url}`} aria-current={(url === '/' ? rota === url : rota.startsWith(url)) ? 'page' : undefined}>{nome}</a>)}</nav>
    <a className="portal-conta" href={PLATAFORMA_URL}>Minha conta <span aria-hidden="true">↗</span></a>
  </div></header>
}

function Inicio() {
  return <>
    <section className="portal-hero"><div className="caixa hero-grade"><div>
      <p className="sobretitulo">TECNOLOGIA ABERTA · CONSTRUÇÃO COLETIVA</p>
      <h1>Uma ponte começa<br />com quem <em>sinaliza.</em></h1>
      <p className="hero-texto">Estamos desenvolvendo um sistema que reconhece sinais de Libras pela câmera e escreve frases em português. Mais pessoas participando ajudam o projeto a aprender.</p>
      <div className="botoes"><a href="#/tutoriais/gravar" className="botao botao-cheio">Aprenda a gravar sinais <span aria-hidden="true">↗</span></a><a href="#/projeto" className="hero-link">Conheça o projeto →</a></div>
      <p className="hero-nota">Protótipo de pesquisa · Código aberto · Feito em Santa Catarina</p>
    </div><div className="hero-camera"><span className="etiqueta-camera">DO MOVIMENTO À PALAVRA</span><CameraMaos /></div></div></section>
    <section className="portal-secao caixa"><div className="titulo-linha"><div><p className="sobretitulo">SEU PONTO DE PARTIDA</p><h2>Por onde você quer começar?</h2></div><p>Entenda, participe e acompanhe<br />o que estamos construindo.</p></div>
      <div className="caminhos"><a className="caminho caminho-destaque" href="#/tutoriais/gravar"><span className="numero">01 / PARTICIPAR</span><h3>Seu jeito de sinalizar<br />faz diferença.</h3><p>Da câmera ao envio: aprenda a contribuir com sinais diretamente pelo site.</p><span className="caminho-fim">Abrir o tutorial <span aria-hidden="true">↗</span></span></a>
      <a className="caminho" href="#/projeto"><span className="numero">02 / CONHECER</span><h3>O que acontece entre<br />a câmera e a frase?</h3><p>Veja demonstrações, conheça a tecnologia e entenda os resultados atuais.</p><span className="caminho-fim">Explorar o projeto <span aria-hidden="true">↗</span></span></a>
      <a className="caminho" href="#/contribuir"><span className="numero">03 / CONSTRUIR JUNTO</span><h3>Há mais de um jeito<br />de ajudar.</h3><p>Grave sinais, sugira melhorias ou contribua com o desenvolvimento.</p><span className="caminho-fim">Encontrar meu caminho <span aria-hidden="true">↗</span></span></a></div>
    </section>
    <section className="faixa-pesquisa"><div className="caixa"><p className="sobretitulo">UM PROJETO EM APRENDIZADO</p><h2>Pessoas diferentes.<br />Mais formas de aprender.</h2><div><p>O mesmo sinal aparece com diferenças de ritmo, movimento e de quem sinaliza. Por isso, precisamos de exemplos de várias pessoas.</p><p>O protótipo tem vocabulário limitado e ainda comete erros. Você pode acompanhar os resultados e as próximas etapas.</p><a href="#/projeto">Veja onde o projeto está hoje →</a></div></div></section>
  </>
}

function Titulo({ detalhe, titulo, texto }: { detalhe: string; titulo: string; texto: string }) {
  return <div className="pagina-cabeca caixa"><p className="sobretitulo">{detalhe}</p><h1>{titulo}</h1><p className="pagina-resumo">{texto}</p></div>
}
function Tutoriais() {
  return <><Titulo detalhe="APRENDER PARA PARTICIPAR" titulo="Vamos por partes." texto="Guias práticos para contribuir com as gravações do Ponte Libras, mesmo que você esteja chegando agora." />
    <section className="caixa portal-secao biblioteca" aria-label="Tutoriais disponíveis"><a href="#/tutoriais/gravar" className="tutorial-capa"><span className="sobretitulo">GUIA DE CONTRIBUIÇÃO · PELO NAVEGADOR</span><h2>Sua primeira<br />gravação de sinais.</h2><p>Entre na sua conta, prepare a câmera e envie um clipe de quatro segundos sem instalar programas.</p><span className="botao botao-cheio">Começar o guia →</span></a><aside className="nota-editorial"><h2>Antes de começar</h2><p>Este guia ensina a gravar exemplos para a pesquisa. Ele não é um curso de Libras.</p><p>Grave sinais que você já conhece. Se estiver aprendendo, procure orientação de professores e da comunidade surda.</p><p>A contribuição acontece na área da sua conta. Você confirma o e-mail, grava pela webcam e revisa cada vídeo antes de enviar.</p></aside></section></>
}
const secoesGuia = [['conta', 'Entre na sua conta'], ['preparar', 'Prepare a câmera'], ['gravar', 'Grave o sinal'], ['revisar', 'Assista e confira'], ['enviar', 'Envie sua contribuição']]
function Guia() {
  return <><Titulo detalhe="TUTORIAIS / CONTRIBUIÇÃO PELO SITE" titulo="Seu sinal pode ajudar o projeto." texto="Você não precisa instalar programas. Entre na sua conta, grave pela webcam e escolha o que enviar. Este guia acompanha você em cada etapa." />
    <div className="caixa guia-layout"><aside className="guia-indice"><a href="#/tutoriais">← Todos os tutoriais</a><p className="sobretitulo">NESTE GUIA</p><nav aria-label="Etapas do tutorial">{secoesGuia.map(([id, titulo], i) => <a key={id} href={`#/tutoriais/gravar#${id}`}>{i + 1}. {titulo}</a>)}</nav><a className="botao botao-cheio" href={PLATAFORMA_URL}>Ir para minha conta ↗</a></aside>
    <article className="guia-artigo"><div className="aviso-guia"><strong>Para participar</strong><p>Tenha uma webcam, conexão com a internet e conheça o sinal que vai gravar. A câmera abre somente quando você pede. Não gravamos áudio.</p></div>
    <section id="conta"><span className="passo-numero">01</span><h2>Entre e confirme seu e-mail</h2><p>Abra a área da sua conta. Se ainda não tem cadastro, crie uma conta e confirme o e-mail com o código recebido. Depois, procure “Gravar sinais” no painel.</p><p>A conta associa suas contribuições à mesma pessoa, o que ajuda a avaliar o reconhecimento com participantes diferentes.</p><a className="botao botao-cheio" href={PLATAFORMA_URL}>Acessar a área de contribuição ↗</a></section>
    <section id="preparar"><span className="passo-numero">02</span><h2>Prepare a câmera e o ambiente</h2><p>Escolha na lista um sinal que você já conhece ou selecione “Sugerir um sinal novo” e escreva o nome da palavra ou expressão em português. As sugestões passam por revisão antes de entrar no vocabulário. Clique em “Abrir minha câmera” e permita o acesso quando o navegador perguntar.</p><ul><li>Ilumine seu rosto e suas mãos pela frente.</li><li>Apoie a câmera e mantenha rosto, ombros e mãos visíveis.</li><li>Confira se as mãos continuam na imagem durante todo o movimento.</li><li>Grave apenas você, com um fundo simples.</li></ul><p>Não sabe fazer o sinal escolhido? Escolha outro que conheça. O guia ensina a contribuir; para aprender Libras, procure orientação de professores e da comunidade surda.</p></section>
    <section id="gravar"><span className="passo-numero">03</span><h2>Um sinal, quatro segundos</h2><p>Clique em “Gravar este sinal”. Aguarde a contagem de três segundos e acompanhe as instruções escritas na tela.</p><ol className="linha-tempo"><li><strong>0–1 s</strong><div><h3>Abaixe as mãos</h3><p>Comece em repouso, de frente para a câmera.</p></div></li><li><strong>1–3 s</strong><div><h3>Faça o sinal</h3><p>Execute o sinal escolhido com clareza, no seu ritmo natural.</p></div></li><li><strong>3–4 s</strong><div><h3>Abaixe as mãos de novo</h3><p>Volte ao repouso para marcar o fim do sinal.</p></div></li></ol><p>A gravação termina automaticamente. Se precisar interromper, clique em “Cancelar gravação”. Nada é enviado nessa etapa.</p></section>
    <section id="revisar"><span className="passo-numero">04</span><h2>Assista antes de enviar</h2><p>Use o vídeo de revisão para conferir se fez o sinal escolhido e se rosto e mãos aparecem bem. Sua câmera já estará desligada.</p><p>Se algo saiu errado, clique em “Descartar e gravar de novo”. O vídeo só está no navegador até você decidir enviar. Ao sair da página, o que não foi enviado será descartado.</p><details><summary>A câmera não abre</summary><p>Confira a permissão de câmera do site e feche outros programas que usam a webcam. Use um navegador atualizado. No site publicado, a conexão precisa ser HTTPS.</p></details><details><summary>Posso gravar vários sinais?</summary><p>Sim. Para cada sinal, a meta é enviar dez amostras em gravações separadas. Revise e envie cada vídeo; depois, clique em “Gravar próxima amostra” para repetir o mesmo sinal. Você pode parar antes ou enviar mais. O contador mostra os envios desta sessão e reinicia ao sair da página. Para mudar, clique em “Escolher outro sinal”.</p></details></section>
    <section id="enviar"><span className="passo-numero">05</span><h2>Envie sua contribuição</h2><p>Leia a explicação sobre o uso do vídeo. Se estiver de acordo, marque a autorização e clique em “Enviar contribuição”. Aguarde a mensagem de recebimento antes de sair.</p><p>O vídeo inclui sua imagem e fica em armazenamento privado do projeto, associado à sua conta, para revisão e uso na pesquisa e no treino do reconhecimento. Ele não é publicado automaticamente.</p><p>Um vídeo recebido ainda precisa ser revisado antes de entrar nos dados de treino. Se o envio falhar, mantenha a página aberta e tente novamente; o vídeo continua disponível para revisão.</p><a className="botao botao-cheio" href={PLATAFORMA_URL}>Quero contribuir pelo site ↗</a></section>
    <a className="voltar-guia" href="#/tutoriais">← Voltar aos tutoriais</a></article></div></>
}
function Contribuir() {
  return <><Titulo detalhe="CONSTRUÍDO COM PESSOAS" titulo="Seu conhecimento pode virar contribuição." texto="Pessoas surdas, professores, intérpretes, estudantes e desenvolvedores podem participar de formas diferentes." /><section className="caixa portal-secao contribuir-grade"><div><h2>Grave sinais que você conhece</h2><p>Exemplos de mais pessoas ajudam a avaliar e melhorar o reconhecimento. Veja o guia e contribua pela webcam, direto na sua conta.</p><a className="botao botao-cheio" href="#/tutoriais/gravar">Quero aprender a gravar →</a></div><div><h2>Compartilhe o que faz falta</h2><p>Sugira sinais do cotidiano, aponte problemas ou conte em que situações o projeto poderia ajudar.</p><a href={`${REPO_URL}/issues`}>Conversar no GitHub ↗</a></div><div><h2>Ajude com o código</h2><p>O código é aberto. Conheça o reconhecimento em Python, o site e a plataforma de participação.</p><a href={REPO_URL}>Explorar o repositório ↗</a></div><div className="aviso-guia"><h2>E a minha conta?</h2><p>Entre na plataforma e confirme seu e-mail para gravar, revisar e enviar sinais pela webcam.</p><a href={PLATAFORMA_URL}>Acessar minha conta ↗</a></div></section></>
}

export default function App() {
  const [local, setLocal] = useState(() => window.location.hash)
  const rota = caminho()
  const principal = useRef<HTMLElement>(null)
  const primeira = useRef(true)
  useEffect(() => { const atualizar = () => setLocal(window.location.hash); window.addEventListener('hashchange', atualizar); return () => window.removeEventListener('hashchange', atualizar) }, [])
  useEffect(() => {
    document.title = `${titulos[rota] ?? 'Página não encontrada'} · Ponte Libras`
    const ancora = local.split('#')[2]
    if (ancora) { document.getElementById(ancora)?.scrollIntoView(); return }
    window.scrollTo(0, 0)
    if (!primeira.current) principal.current?.focus({ preventScroll: true })
    primeira.current = false
  }, [local, rota])
  return <><a className="pular" href={`${local.split('#').slice(0, 2).join('#') || '#/'}#conteudo`}>Pular para o conteúdo</a><Cabecalho rota={rota} /><main id="conteudo" ref={principal} tabIndex={-1}>
    {rota === '/' ? <Inicio /> : rota === '/tutoriais' ? <Tutoriais /> : rota === '/tutoriais/gravar' ? <Guia /> : rota === '/contribuir' ? <Contribuir /> : rota === '/projeto' ? <><Titulo detalhe="PESQUISA ABERTA" titulo="Da câmera à frase. E tudo o que vem antes." texto="Um Trabalho de Conclusão de Curso em Engenharia de Software na Católica de Santa Catarina, em Jaraguá do Sul. Conheça o protótipo e acompanhe seu desenvolvimento." /><Demonstracao /><Problema /><Funcionamento /><Resultados /><ProximosPassos /></> : <Titulo detalhe="404" titulo="Este caminho ainda não existe." texto="Use o menu para voltar ao início ou encontrar um tutorial." />}
  </main><Rodape /></>
}
