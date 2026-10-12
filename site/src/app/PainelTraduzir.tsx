// A tradução, numa faixa logo abaixo da câmera: os sinais reconhecidos em
// destaque, o sinal que está sendo confirmado e o Limpar (tecla C).
import { useCallback, useEffect, useRef, useState } from 'react'
import { Modelo } from './modelo'
import { Reconhecedor } from './reconhecedor'
import { digitando } from './teclado'
import type { Ouvinte } from './useCamera'

// O modelo é baixado uma vez só
let carregando: Promise<Modelo> | null = null
const carregarModelo = () => (carregando ??= Modelo.carregar())

type Props = {
  ouvir: (o: Ouvinte) => () => void
  cameraLigada: boolean
  pausada: boolean // durante a gravação: o sinal gravado não vira tradução
}

export function PainelTraduzir({ ouvir, cameraLigada, pausada }: Props) {
  const [modelo, setModelo] = useState<Modelo | null>(null)
  const [erro, setErro] = useState('')
  const reconhecedor = useRef<Reconhecedor | null>(null)
  const [glossas, setGlossas] = useState<string[]>([])
  const [candidata, setCandidata] = useState({ glossa: '', votos: 0, de: 1 })
  const emPausa = useRef(pausada)
  useEffect(() => {
    emPausa.current = pausada
  }, [pausada])

  useEffect(() => {
    carregarModelo()
      .then(setModelo)
      .catch(() => setErro('Não consegui carregar o modelo de reconhecimento. Recarregue a página.'))
  }, [])

  useEffect(() => {
    if (!modelo || !cameraLigada) return
    const rec = (reconhecedor.current ??= new Reconhecedor(modelo))
    // câmera (re)ligada: quadros de antes não podem completar um sinal agora
    rec.reiniciarJanela()
    let anterior = { glossa: '', votos: 0, de: rec.estabilidade }
    let estavaPausado = emPausa.current
    const sair = ouvir(({ coords, tSeg }) => {
      const pausado = emPausa.current
      // ao voltar da gravação, recomeça a janela (as glossas continuam)
      if (estavaPausado && !pausado) rec.reiniciarJanela()
      estavaPausado = pausado
      if (!pausado && rec.processar(coords, tSeg)) setGlossas([...rec.glossas])
      const glossa = pausado ? '' : rec.candidata
      const votos = pausado ? 0 : rec.votos
      if (glossa !== anterior.glossa || votos !== anterior.votos) {
        anterior = { glossa, votos, de: rec.estabilidade }
        setCandidata(anterior)
      }
    })
    return () => {
      sair()
      setCandidata({ glossa: '', votos: 0, de: rec.estabilidade })
    }
  }, [modelo, cameraLigada, ouvir])

  const limpar = useCallback(() => {
    reconhecedor.current?.limpar()
    setGlossas([])
  }, [])

  // C limpa a tradução, como no programa em Python
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey && !e.altKey && !digitando(e.target)) limpar()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [limpar])

  const vocabulario = modelo
    ? [...new Set(Object.values(modelo.descricao.glossas))].filter((g) => g !== modelo.descricao.classe_negativa)
    : []

  return (
    <section className="app-traducao" aria-labelledby="traducao-t">
      <div className="app-traducao-topo">
        <h2 id="traducao-t">Tradução</h2>
        <div className="app-candidata" aria-hidden="true">
          {pausada ? (
            'Pausada durante a gravação'
          ) : candidata.glossa ? (
            <>
              <span>
                Reconhecendo <strong>{candidata.glossa}</strong>
              </span>
              <span className="app-barra">
                <span style={{ transform: `scaleX(${candidata.votos / candidata.de})` }} />
              </span>
            </>
          ) : null}
        </div>
        <button className="app-botao-pequeno" onClick={limpar} disabled={!glossas.length}>
          Limpar <kbd>C</kbd>
        </button>
      </div>

      {/* sempre montada: assim o primeiro sinal reconhecido também é anunciado */}
      <div className="app-traducao-corpo" aria-live="polite">
        {erro ? (
          <p className="app-erro">{erro}</p>
        ) : glossas.length ? (
          <ol className="app-glossas">
            {glossas.map((g, i) => (
              <li className="glossa" key={`${i}-${g}`}>{g}</li>
            ))}
          </ol>
        ) : (
          <p className="app-vazio">
            {!modelo
              ? 'Carregando o modelo…'
              : cameraLigada
                ? 'Faça um sinal de frente para a câmera, com os ombros aparecendo.'
                : 'A tradução aparece aqui quando a câmera ligar.'}
          </p>
        )}
      </div>

      {vocabulario.length > 0 && (
        <p className="app-traducao-pe">
          Ele reconhece hoje: {vocabulario.join(', ')}. A frase completa em português é a próxima etapa.
        </p>
      )}
    </section>
  )
}
