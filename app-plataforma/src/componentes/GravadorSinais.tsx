import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/contexto'
import { supabase } from '../lib/supabase'
import { erroNomeSinal, normalizarNomeSinal, PASTA_NOVOS_SINAIS } from '../lib/sinaisContribuicao'

const sinais = [
  ['OI', 'Oi (letras O e I)'], ['OI_ACENO', 'Oi (aceno)'], ['GOSTAR', 'Gostar'],
  ['LARANJA', 'Laranja'], ['ABACAXI', 'Abacaxi'], ['BANANA', 'Banana'], ['MORANGO', 'Morango'],
  ['ACONTECER', 'Acontecer'], ['AMARELO', 'Amarelo'], ['BANHEIRO', 'Banheiro'], ['MEDO', 'Medo'], ['BOM', 'Bom'],
]
type Fase = 'desligado' | 'abrindo' | 'pronto' | 'preparo' | 'gravando' | 'revisao' | 'enviando' | 'enviado'
const META_AMOSTRAS = 10
type Serie = { id: string; enviadas: number }
type Clipe = { blob: Blob; url: string; sinal: string; nome: string; novo: boolean; chave: string; serie: string; amostra: number }

export function GravadorSinais() {
  const { sessao } = useAuth()
  const [fase, setFase] = useState<Fase>('desligado')
  const [sinal, setSinal] = useState('OI')
  const [nomeNovo, setNomeNovo] = useState('')
  const [clipe, setClipe] = useState<Clipe | null>(null)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')
  const [autorizo, setAutorizo] = useState(false)
  const [contagens, setContagens] = useState<Record<string, number>>({})
  const series = useRef<Record<string, Serie>>({})
  const video = useRef<HTMLVideoElement>(null)
  const fluxo = useRef<MediaStream | null>(null)
  const gravador = useRef<MediaRecorder | null>(null)
  const relogio = useRef<number | null>(null)
  const ativo = useRef(true)
  const ocupado = useRef(false)
  const preview = useRef('')
  const envioPendente = useRef<string | null>(null)

  function pararCamera() {
    fluxo.current?.getTracks().forEach(t => t.stop())
    fluxo.current = null
  }
  function limparRelogio() {
    if (relogio.current !== null) window.clearInterval(relogio.current)
    relogio.current = null
  }
  useEffect(() => {
    ativo.current = true
    return () => {
      ativo.current = false
      limparRelogio()
      if (gravador.current?.state === 'recording') gravador.current.stop()
      pararCamera()
      if (preview.current) URL.revokeObjectURL(preview.current)
    }
  }, [])
  useEffect(() => {
    if (video.current && fluxo.current) video.current.srcObject = fluxo.current
  }, [fase])

  async function abrirCamera() {
    if (ocupado.current) return
    if (sinal === PASTA_NOVOS_SINAIS && erroNomeSinal(nomeNovo)) { setErro(erroNomeSinal(nomeNovo)); return }
    ocupado.current = true
    setErro(''); setFase('abrindo')
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Seu navegador não oferece gravação de câmera aqui. Abra em um navegador atualizado, com HTTPS ou localhost.')
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false })
      if (!ativo.current) { stream.getTracks().forEach(t => t.stop()); return }
      fluxo.current = stream
      stream.getVideoTracks()[0].onended = () => {
        if (!ativo.current) return
        limparRelogio()
        if (gravador.current?.state === 'recording') { gravador.current.onstop = null; gravador.current.stop() }
        pararCamera(); ocupado.current = false; setFase('desligado'); setErro('A câmera foi desconectada. Abra a câmera novamente para continuar.')
      }
      setFase('pronto'); setMensagem('Confira se seu rosto, ombros e mãos aparecem na imagem.')
    } catch (e) {
      if (ativo.current) { setFase('desligado'); setErro(e instanceof DOMException && e.name === 'NotAllowedError' ? 'O acesso à câmera não foi permitido. Libere a câmera nas permissões do navegador e tente novamente.' : e instanceof Error ? e.message : 'Não foi possível abrir a câmera.') }
    } finally { ocupado.current = false }
  }

  function gravar() {
    if (ocupado.current || !fluxo.current || !fluxo.current.getVideoTracks().some(t => t.readyState === 'live')) return
    if (sinal === PASTA_NOVOS_SINAIS && erroNomeSinal(nomeNovo)) { setErro(erroNomeSinal(nomeNovo)); return }
    const novo = sinal === PASTA_NOVOS_SINAIS
    const nome = novo ? normalizarNomeSinal(nomeNovo) : sinais.find(([valor]) => valor === sinal)![1]
    const chave = novo ? `${PASTA_NOVOS_SINAIS}:${nome.toLocaleLowerCase('pt-BR')}` : sinal
    const serie = series.current[chave] ??= { id: crypto.randomUUID(), enviadas: 0 }
    const amostra = serie.enviadas + 1
    ocupado.current = true
    setErro(''); setFase('preparo'); setMensagem('Prepare-se… a gravação começa em 3 segundos.')
    const inicio = performance.now()
    let iniciou = false
    const partes: Blob[] = []
    relogio.current = window.setInterval(() => {
      const tempo = (performance.now() - inicio) / 1000
      if (tempo < 3) { setMensagem(`Prepare-se… ${Math.ceil(3 - tempo)}`); return }
      if (!iniciou) {
        try {
          const mimeType = ['video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find(t => MediaRecorder.isTypeSupported(t))
          if (!mimeType) throw new Error('Este navegador não oferece um formato de vídeo compatível. Tente outro navegador atualizado.')
          const recorder = new MediaRecorder(fluxo.current!, { mimeType, videoBitsPerSecond: 1_500_000 })
          gravador.current = recorder
          recorder.ondataavailable = e => { if (e.data.size) partes.push(e.data) }
          recorder.onerror = () => { limparRelogio(); recorder.onstop = null; if (recorder.state === 'recording') recorder.stop(); ocupado.current = false; pararCamera(); setFase('desligado'); setErro('A gravação falhou. Abra a câmera e tente novamente.') }
          recorder.onstop = () => {
            if (!ativo.current) return
            pararCamera(); ocupado.current = false
            const blob = new Blob(partes, { type: recorder.mimeType })
            if (!blob.size || blob.size > 10 * 1024 * 1024) { setFase('desligado'); setErro('O vídeo ficou vazio ou maior que 10 MB. Tente gravar novamente.'); return }
            if (preview.current) URL.revokeObjectURL(preview.current)
            preview.current = URL.createObjectURL(blob)
            setClipe({ blob, url: preview.current, sinal, nome, novo, chave, serie: serie.id, amostra }); envioPendente.current = null
            setAutorizo(false); setFase('revisao'); setMensagem('Assista ao vídeo. Nada foi enviado ainda.')
          }
          recorder.start(); iniciou = true; setFase('gravando')
        } catch (e) { limparRelogio(); ocupado.current = false; pararCamera(); setFase('desligado'); setErro(e instanceof Error ? e.message : 'Não foi possível gravar.'); return }
      }
      const gravado = tempo - 3
      setMensagem(gravado < 1 ? 'Abaixe as mãos' : gravado < 3 ? 'Faça o sinal agora' : 'Abaixe as mãos de novo')
      if (gravado >= 4) { limparRelogio(); if (gravador.current?.state === 'recording') gravador.current.stop() }
    }, 100)
  }
  function cancelar() {
    limparRelogio()
    if (gravador.current?.state === 'recording') { gravador.current.onstop = null; gravador.current.stop() }
    pararCamera(); ocupado.current = false; setFase('desligado'); setMensagem('Gravação cancelada. Nada foi enviado.')
  }
  function descartar() {
    if (preview.current) URL.revokeObjectURL(preview.current)
    preview.current = ''; setClipe(null); envioPendente.current = null
    setAutorizo(false); setFase('desligado'); setErro(''); setMensagem('Você pode gravar outro clipe.')
  }
  async function repetirSinal() {
    descartar()
    await abrirCamera()
  }
  async function enviar() {
    if (ocupado.current || !clipe || !autorizo || !supabase || !sessao) return
    ocupado.current = true; setErro(''); setFase('enviando')
    const extensao = clipe.blob.type.includes('mp4') ? 'mp4' : 'webm'
    // Reutilizar o caminho impede duplicar o clipe após uma resposta de rede perdida.
    const caminho = envioPendente.current ?? `${sessao.user.id}/${clipe.sinal}/${crypto.randomUUID()}.${extensao}`
    envioPendente.current = caminho
    try {
      const { error } = await supabase.storage.from('sinais-contribuidos').upload(caminho, clipe.blob, {
        contentType: clipe.blob.type.split(';')[0], upsert: false,
        metadata: { sinal: clipe.sinal, nome_sugerido: clipe.nome, tipo: clipe.novo ? 'sinal-novo' : 'vocabulario-atual', revisao: 'pendente', serie_id: clipe.serie, amostra: clipe.amostra, meta_amostras: META_AMOSTRAS, autorizacao: 'pesquisa-video-v1', autorizado_em: new Date().toISOString() },
      })
      if (error) {
        // Um objeto existente só conta como sucesso quando é o mesmo caminho desta tentativa.
        const { data: existente, error: erroConsulta } = await supabase.storage.from('sinais-contribuidos').info(caminho)
        if (erroConsulta || !existente) throw error
      }
      if (ativo.current) {
        series.current[clipe.chave].enviadas = clipe.amostra
        setContagens(anteriores => ({ ...anteriores, [clipe.chave]: clipe.amostra }))
        setFase('enviado'); setMensagem(clipe.amostra >= META_AMOSTRAS ? `Você enviou ${clipe.amostra} amostras deste sinal nesta sessão. Obrigado! Os vídeos aguardam revisão.` : `Amostra ${clipe.amostra} recebida! Você pode gravar a próxima repetição do mesmo sinal.`); setAutorizo(false)
      }
    } catch {
      if (ativo.current) { setFase('revisao'); setErro('Não foi possível confirmar o envio. Seu vídeo continua aqui. Confira a conexão e tente novamente. Se persistir, o recebimento pode ainda não estar configurado.') }
    } finally { ocupado.current = false }
  }
  const cameraLigada = ['pronto', 'preparo', 'gravando'].includes(fase)
  const travado = ['abrindo', 'preparo', 'gravando', 'enviando'].includes(fase)
  const chaveAtual = sinal === PASTA_NOVOS_SINAIS ? `${PASTA_NOVOS_SINAIS}:${normalizarNomeSinal(nomeNovo).toLocaleLowerCase('pt-BR')}` : sinal
  const enviadas = contagens[chaveAtual] ?? 0
  return <div className="gravador-sinais">
    <p>Escolha um sinal que você conhece, grave um clipe de quatro segundos e confira antes de enviar. Não gravamos áudio.</p>
    <label htmlFor="sinal-gravar">Qual sinal você vai gravar?</label>
    <select id="sinal-gravar" value={sinal} disabled={travado || !!clipe} onChange={e => { setSinal(e.target.value); setErro('') }}><option value={PASTA_NOVOS_SINAIS}>Sugerir um sinal novo</option>{sinais.map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}</select>
    {sinal === PASTA_NOVOS_SINAIS && <div className="novo-sinal"><label htmlFor="nome-sinal-novo">Qual é o nome do sinal?</label><input id="nome-sinal-novo" type="text" value={nomeNovo} maxLength={80} disabled={travado || !!clipe} aria-describedby="novo-sinal-dica" onChange={e => { setNomeNovo(e.target.value); setErro('') }} /><p id="novo-sinal-dica">Escreva a palavra ou expressão em português, por exemplo “Obrigado” ou “Bom dia”. A sugestão será revisada antes de entrar no vocabulário do projeto.</p></div>}
    <div className="progresso-amostras">
      <strong>{enviadas} de {META_AMOSTRAS} amostras enviadas nesta sessão</strong>
      <progress max={META_AMOSTRAS} value={Math.min(enviadas, META_AMOSTRAS)} aria-label="Meta de amostras enviadas do sinal escolhido" />
      <p>A meta é repetir o mesmo sinal {META_AMOSTRAS} vezes, em gravações separadas. Revise e envie cada amostra. Você pode parar antes ou enviar mais; o contador reinicia ao sair da página.</p>
    </div>
    <p>Use iluminação de frente e mantenha rosto, ombros e mãos dentro da imagem. Grave apenas você e sinais que já sabe fazer.</p>
    {cameraLigada && <video className="webcam-contribuicao" ref={video} autoPlay muted playsInline aria-label="Prévia ao vivo da câmera" />}
    {clipe && <><p><strong>{clipe.novo ? 'Novo sinal sugerido' : 'Sinal gravado'}: {clipe.nome} · Amostra {clipe.amostra}</strong></p><video className="revisao-contribuicao" src={clipe.url} controls playsInline aria-label={`Revisar gravação do sinal ${clipe.nome}`} /></>}
    <p role="status" aria-live="polite" className="gravador-instrucao">{mensagem}</p>
    {erro && <p role="alert" className="gravador-erro">{erro}</p>}
    {fase === 'desligado' && !clipe && <button className="botao botao-principal" onClick={abrirCamera}>Abrir minha câmera</button>}
    {fase === 'abrindo' && <p>Aguardando acesso à câmera…</p>}
    {fase === 'pronto' && <div className="gravador-acoes"><button className="botao botao-principal" onClick={gravar}>Gravar este sinal</button><button className="botao botao-secundario" onClick={cancelar}>Fechar câmera</button></div>}
    {(fase === 'preparo' || fase === 'gravando') && <button className="botao botao-secundario" onClick={cancelar}>Cancelar gravação</button>}
    {(fase === 'revisao' || fase === 'enviando') && <><p><strong>Antes de enviar:</strong> o vídeo inclui sua imagem e será armazenado de forma privada no Supabase do Ponte Libras, associado à sua conta, para revisão e uso na pesquisa e no treino do reconhecimento de sinais. Ele não será publicado automaticamente.</p><label className="gravador-consentimento"><input type="checkbox" checked={autorizo} disabled={fase === 'enviando'} onChange={e => setAutorizo(e.target.checked)} /> Estou de acordo com o envio deste vídeo e seu uso na pesquisa e no treino do Ponte Libras.</label><div className="gravador-acoes"><button className="botao botao-principal" disabled={!autorizo || fase === 'enviando'} onClick={enviar}>{fase === 'enviando' ? 'Enviando…' : 'Enviar contribuição'}</button><button className="botao botao-secundario" disabled={fase === 'enviando'} onClick={descartar}>Descartar e gravar de novo</button></div></>}
    {fase === 'enviado' && <div className="gravador-acoes"><button className="botao botao-principal" onClick={repetirSinal}>{enviadas >= META_AMOSTRAS ? 'Gravar mais uma amostra' : 'Gravar próxima amostra'}</button><button className="botao botao-secundario" onClick={() => { descartar(); document.getElementById('sinal-gravar')?.focus() }}>Escolher outro sinal</button></div>}
    <p className="nota">A câmera só abre quando você pede. O vídeo só é enviado ao clicar em “Enviar contribuição”. Ao sair desta página, gravações não enviadas são descartadas.</p>
  </div>
}
