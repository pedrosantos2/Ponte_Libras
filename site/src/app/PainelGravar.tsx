// A gravação de sinais, ao lado da câmera: um campo só (um sinal que ele já
// conhece ou um novo), o botão de gravar (tecla Espaço), atalhos para os
// sinais que mais precisam de gente e o arquivo com as gravações.
import { useEffect, useRef, useState } from 'react'
import type { Palco } from './Aplicativo'
import { conferirNoDicionario, type Conferencia } from './dicionario'
import { normalizarNome, verificarNome } from './moderacao'
import { avaliar, reamostrar, DURACAO_S, FASES, PREPARO_S, type Resultado } from './qualidade'
import { LISTA, META_POR_SINAL, OUTRO, POUCAS_PESSOAS } from './sinais'
import { digitando } from './teclado'
import type { Ouvinte } from './useCamera'

type Estado = 'pronta' | 'preparo' | 'gravando' | 'revisao'
type Gravacao = {
  sinal: string
  novo: boolean
  criadaEm: string
  tempos: number[]
  quadros: Float32Array[]
  avaliacao: Resultado
}

type Props = {
  ouvir: (o: Ouvinte) => () => void
  mostrar: (p: Partial<Palco>) => void
  cameraLigada: boolean
  aoMudarOcupado: (ocupado: boolean) => void
}

function idDaPessoa(): string {
  try {
    const salvo = localStorage.getItem('ponte-libras:pessoa')
    if (salvo) return salvo
    const novo = crypto.randomUUID()
    localStorage.setItem('ponte-libras:pessoa', novo)
    return novo
  } catch {
    return crypto.randomUUID()
  }
}

function base64(quadros: Float32Array[]): string {
  const tudo = new Float32Array(quadros.length * (quadros[0]?.length ?? 0))
  quadros.forEach((q, i) => tudo.set(q, i * q.length))
  const bytes = new Uint8Array(tudo.buffer)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

const rolagem = (): ScrollBehavior =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'

// "oi", "Banana", "sem sinal": o nome digitado de um sinal que ele já conhece
const conhecidoPeloNome = (nome: string) => LISTA.find((s) => normalizarNome(s.nome) === nome || s.classe === nome)

// atalhos: os sinais que têm menos gente gravando
const ATALHOS = LISTA.filter((s) => s.pessoas <= POUCAS_PESSOAS && s !== OUTRO)

export function PainelGravar({ ouvir, mostrar, cameraLigada, aoMudarOcupado }: Props) {
  const pessoa = useRef(idDaPessoa())
  const captura = useRef({ fase: 'livre', t0: 0, tempos: [] as number[], quadros: [] as Float32Array[] })
  const botaoGravar = useRef<HTMLButtonElement>(null)
  const botaoGuardar = useRef<HTMLButtonElement>(null)
  const botaoDeNovo = useRef<HTMLButtonElement>(null)
  const campo = useRef<HTMLInputElement>(null)

  const [estado, setEstado] = useState<Estado>('pronta')
  const [nome, setNome] = useState('')
  const [revisao, setRevisao] = useState<Gravacao | null>(null)
  const [gravacoes, setGravacoes] = useState<Gravacao[]>([])
  const [baixadas, setBaixadas] = useState(0)
  const [tentativa, setTentativa] = useState(0)
  const [dicionario, setDicionario] = useState<{ glossa: string; resultado: Conferencia | 'conferindo' | 'falhou' }>({
    glossa: '',
    resultado: 'conferindo',
  })

  // O que foi digitado: um sinal que ele já conhece, ou um sinal novo, que
  // passa pelo filtro de ofensas e pelo dicionário antes de poder ser gravado
  const conhecido = nome.trim() ? conhecidoPeloNome(normalizarNome(nome)) : undefined
  const verificacao = verificarNome(nome)
  const paraConferir = !conhecido && verificacao.ok ? verificacao.glossa : ''
  const conferido = dicionario.glossa === paraConferir ? dicionario.resultado : 'conferindo'
  const alvo = conhecido
    ? { chave: conhecido.classe, novo: false }
    : paraConferir && typeof conferido === 'object' && conferido.ok
      ? { chave: paraConferir, novo: true }
      : null
  const alvoAtual = useRef(alvo)
  useEffect(() => {
    alvoAtual.current = alvo
  })

  // Confere no dicionário quando a pessoa para de digitar (e de novo quando
  // ela pede, ou quando a internet volta)
  useEffect(() => {
    if (!paraConferir) return
    let valido = true
    const espera = setTimeout(() => {
      conferirNoDicionario(paraConferir)
        .then((resultado) => valido && setDicionario({ glossa: paraConferir, resultado }))
        .catch(() => valido && setDicionario({ glossa: paraConferir, resultado: 'falhou' }))
    }, 300)
    return () => {
      valido = false
      clearTimeout(espera)
    }
  }, [paraConferir, tentativa])
  useEffect(() => {
    const voltou = () => setTentativa((t) => t + 1)
    window.addEventListener('online', voltou)
    return () => window.removeEventListener('online', voltou)
  }, [])

  function conferirDeNovo() {
    setDicionario({ glossa: paraConferir, resultado: 'conferindo' })
    setTentativa((t) => t + 1)
  }

  function trocarPalavra(errada: string, certa: string) {
    setNome(paraConferir.split(' ').map((t) => (t === errada ? certa : t)).join(' '))
  }

  const ocupado = estado === 'preparo' || estado === 'gravando'
  useEffect(() => aoMudarOcupado(ocupado), [ocupado, aoMudarOcupado])

  // Recebe cada quadro da câmera; só guarda durante a gravação
  useEffect(() => {
    if (!cameraLigada) return
    const c = captura.current
    let faseAnunciada = ''
    const anunciar = (texto: string) => {
      if (texto !== faseAnunciada) mostrar({ anuncio: (faseAnunciada = texto) })
    }
    const sair = ouvir(({ coords, tSeg }) => {
      if (c.fase === 'livre') return
      const dt = tSeg - c.t0
      if (c.fase === 'preparo') {
        if (dt < PREPARO_S) {
          mostrar({ fala: `Prepare-se… ${(PREPARO_S - dt).toFixed(1)}`, roteiro: 0 })
          anunciar('Prepare-se')
          return
        }
        Object.assign(c, { fase: 'gravando', t0: tSeg, tempos: [], quadros: [] })
        setEstado('gravando')
        return
      }
      // o coletor guarda o quadro e só depois confere se passou dos 4 s
      c.tempos.push(dt)
      c.quadros.push(coords)
      const fase = FASES.find((f) => dt < f.ate) ?? FASES[FASES.length - 1]
      mostrar({ fala: fase.texto, roteiro: Math.min(dt, DURACAO_S) })
      anunciar(fase.texto)
      if (dt >= DURACAO_S) {
        c.fase = 'livre'
        const escolhido = alvoAtual.current!
        const avaliacao = avaliar(reamostrar(c.tempos, c.quadros), escolhido.chave === OUTRO.classe)
        setRevisao({
          sinal: escolhido.chave,
          novo: escolhido.novo,
          criadaEm: new Date().toISOString(),
          tempos: c.tempos,
          quadros: c.quadros,
          avaliacao,
        })
        mostrar({ fala: '', anuncio: '', roteiro: null })
        setEstado('revisao')
      }
    })
    return () => {
      sair()
      const cancelada = c.fase !== 'livre'
      c.fase = 'livre'
      // câmera caiu no meio: solta a gravação (e a pausa da tradução) e avisa
      mostrar({ fala: '', anuncio: cancelada ? 'A câmera desligou. A gravação foi cancelada.' : '', roteiro: null })
      setEstado((e) => (e === 'preparo' || e === 'gravando' ? 'pronta' : e))
    }
  }, [cameraLigada, ouvir, mostrar])

  // Fim da gravação: o foco vai para a próxima ação (Guardar, ou Gravar de novo)
  useEffect(() => {
    if (estado !== 'revisao') return
    const alvoFoco = (revisao?.avaliacao.erro ? botaoDeNovo : botaoGuardar).current
    alvoFoco?.focus({ preventScroll: true })
    alvoFoco?.scrollIntoView({ block: 'nearest', behavior: rolagem() })
  }, [estado, revisao])

  // Fechar a página com gravações que ainda não foram baixadas perde tudo
  const pendentes = gravacoes.length - baixadas
  useEffect(() => {
    if (!pendentes) return
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [pendentes])

  const podeGravar = estado === 'pronta' && !!alvo && cameraLigada
  function gravar(): boolean {
    if (!podeGravar) return false
    Object.assign(captura.current, { fase: 'preparo', t0: performance.now() / 1000 })
    setRevisao(null)
    setEstado('preparo')
    // no celular a câmera pode estar fora da tela: traz a câmera inteira para a vista
    const camera = document.getElementById('camera')
    const r = camera?.getBoundingClientRect()
    if (r && (r.top < 0 || r.bottom > window.innerHeight)) camera!.scrollIntoView({ block: 'start', behavior: rolagem() })
    return true
  }
  const gravarAtual = useRef(gravar)
  const semSinalAtual = useRef(false)
  useEffect(() => {
    gravarAtual.current = gravar
    semSinalAtual.current = estado === 'pronta' && cameraLigada && !alvo
  })

  // Espaço grava, como no coletor em Python. Só com a câmera à vista e fora de
  // campo de texto ou controle (botão, link, vídeo): lá o Espaço tem função
  // própria, e lendo a parte de baixo da página ele continua rolando a página.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== ' ' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || digitando(e.target)) return
      const alvoTecla = e.target instanceof Element ? e.target : null
      if (alvoTecla && alvoTecla !== document.body && alvoTecla.closest('button, a, summary, video, audio, [role=button], [tabindex]')) return
      // com a câmera bem à vista, o Espaço é do aplicativo e não rola a página
      const camera = document.getElementById('camera')?.getBoundingClientRect()
      if (!camera || camera.bottom < 160) return
      e.preventDefault()
      if (e.repeat) return
      // sem sinal escolhido: leva ao campo, em vez de não fazer nada
      if (!gravarAtual.current() && semSinalAtual.current) campo.current?.focus()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [])

  function voltarAoBotao() {
    setRevisao(null)
    setEstado('pronta')
    mostrar({ anuncio: '' })
    setTimeout(() => botaoGravar.current?.focus({ preventScroll: true }))
  }

  function guardar() {
    if (revisao && !revisao.avaliacao.erro) setGravacoes((g) => [...g, revisao])
    voltarAoBotao()
  }

  function baixar() {
    const arquivo = {
      formato: 'ponte-libras/gravacoes@1',
      pessoa: pessoa.current,
      extrator: { mediapipe: '1.1.0', modo: 'video', conf_mao: 0.7, pose_cada: 2, largura: 640 },
      gravacoes: gravacoes.map((g) => ({
        sinal: g.sinal,
        novo: g.novo,
        criada_em: g.criadaEm,
        tempos: g.tempos,
        quadros: base64(g.quadros),
        checagem: g.avaliacao,
      })),
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(arquivo)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `ponte-libras-gravacoes-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setBaixadas(gravacoes.length)
  }

  const contagem = (chave: string) => gravacoes.filter((g) => g.sinal === chave).length
  const travado = ocupado || estado === 'revisao'

  return (
    <section className="app-gravacao" id="gravar" aria-labelledby="gravar-t">
      <h2 id="gravar-t">Gravar um sinal</h2>
      <p className="app-intro">
        Ensine o Ponte Libras. São 4 segundos: mãos abaixadas, o sinal, mãos abaixadas de novo.
      </p>

      <label className="app-campo">
        <span>Qual sinal você vai gravar?</span>
        <input
          ref={campo}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') gravar()
          }}
          placeholder="Por exemplo: ÁGUA"
          maxLength={30}
          disabled={travado}
          autoComplete="off"
          aria-describedby="nome-ajuda"
        />
      </label>

      <div id="nome-ajuda" className="app-ajuda" aria-live="polite">
        {!nome.trim() ? (
          <p>Digite a palavra em português, ou escolha um dos sinais abaixo.</p>
        ) : conhecido === OUTRO ? (
          <p>{OUTRO.dica}</p>
        ) : conhecido ? (
          <>
            <p>
              Ele já conhece <strong>{conhecido.nome}</strong>. Sua gravação ajuda a reconhecer mais pessoas.
            </p>
            {conhecido.dica && <p>{conhecido.dica}</p>}
            {conhecido.pessoas <= POUCAS_PESSOAS && (
              <p className="app-carente">
                Só {conhecido.pessoas} {conhecido.pessoas === 1 ? 'pessoa gravou' : 'pessoas gravaram'} esse sinal até agora.
              </p>
            )}
          </>
        ) : !verificacao.ok ? (
          <p className="app-erro">{verificacao.motivo}</p>
        ) : conferido === 'conferindo' ? (
          <p>Conferindo no dicionário…</p>
        ) : conferido === 'falhou' ? (
          <p>
            <span className="app-erro">Não consegui conferir no dicionário agora.</span>{' '}
            <button className="app-link" onClick={conferirDeNovo}>
              Tentar de novo
            </button>
          </p>
        ) : !conferido.ok ? (
          <p>
            <span className="app-erro">Não encontrei {conferido.palavra} no dicionário de português.</span>{' '}
            {conferido.sugestoes.length ? (
              <>
                Você quis dizer{' '}
                {conferido.sugestoes.map((s, i) => (
                  <span key={s}>
                    {i > 0 && ' ou '}
                    <button className="app-link" onClick={() => trocarPalavra(conferido.palavra, s)}>
                      {s}
                    </button>
                  </span>
                ))}
                ?
              </>
            ) : (
              'Confira a grafia. Se for nome próprio, marca ou palavra estrangeira, fale com a gente.'
            )}
          </p>
        ) : (
          <p>
            Sinal novo: <strong>{verificacao.glossa}</strong>. Ele só entra no Ponte Libras depois que várias pessoas
            diferentes gravarem e alguém que sabe Libras revisar.
          </p>
        )}
      </div>

      {alvo && (
        <p className="app-meta">
          {contagem(alvo.chave)} de {META_POR_SINAL} gravações suas
        </p>
      )}

      {estado === 'revisao' && revisao ? (
        <div className="app-revisao" role="group" aria-labelledby="revisao-resultado">
          {revisao.avaliacao.erro ? (
            <p id="revisao-resultado" className="app-erro">{revisao.avaliacao.erro}</p>
          ) : (
            <p id="revisao-resultado">Gravação boa. {revisao.avaliacao.aviso}</p>
          )}
          <div className="app-revisao-botoes">
            {!revisao.avaliacao.erro && (
              <button ref={botaoGuardar} className="botao botao-cheio" onClick={guardar}>
                Guardar gravação
              </button>
            )}
            <button ref={botaoDeNovo} className="botao botao-linha" onClick={voltarAoBotao}>
              Gravar de novo
            </button>
          </div>
        </div>
      ) : (
        <button ref={botaoGravar} className="botao botao-cheio app-gravar" onClick={gravar} disabled={!podeGravar}>
          {ocupado ? (
            'Gravando…'
          ) : !cameraLigada ? (
            'Ligue a câmera para gravar'
          ) : (
            <>
              Gravar 4 segundos <kbd>Espaço</kbd>
            </>
          )}
        </button>
      )}

      <p className="app-rotulo">Precisam de mais gente</p>
      <ul className="app-atalhos">
        {ATALHOS.map((s) => (
          <li key={s.classe}>
            <button
              aria-pressed={conhecido?.classe === s.classe}
              disabled={travado}
              onClick={(e) => {
                setNome(s.nome)
                // solta o foco do atalho: senão o Espaço apertaria o atalho em vez de gravar
                e.currentTarget.blur()
              }}
              title={s.dica}
            >
              {s.nome}
              {contagem(s.classe) > 0 && <span className="app-conta">{contagem(s.classe)}</span>}
            </button>
          </li>
        ))}
      </ul>
      <p className="app-ajuda">
        Também ajuda gravar{' '}
        <button
          className="app-link"
          disabled={travado}
          onClick={(e) => {
            setNome(OUTRO.nome)
            e.currentTarget.blur()
          }}
        >
          sem sinal
        </button>
        : mexer as mãos à vontade, sem fazer nenhum sinal.
      </p>

      <div className="app-salvar">
        <p>
          {gravacoes.length
            ? `${gravacoes.length} ${gravacoes.length === 1 ? 'gravação guardada' : 'gravações guardadas'}.`
            : 'Nenhuma gravação guardada ainda.'}{' '}
          Por enquanto elas ficam só neste navegador: baixe o arquivo antes de fechar a página.
        </p>
        <button className="botao botao-linha" onClick={baixar} disabled={!gravacoes.length}>
          Baixar gravações (.json)
        </button>
      </div>
    </section>
  )
}
