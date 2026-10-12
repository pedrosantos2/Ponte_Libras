// O Ponte Libras no navegador, numa tela só — como a janela do programa em
// Python: a câmera com a tradução logo abaixo, e a gravação ao lado, tudo à
// vista ao mesmo tempo, sem modos para alternar. A câmera é pedida assim que
// a página abre. Comandos de teclado: Espaço grava um sinal, C limpa a tradução.
import { useCallback, useEffect, useState } from 'react'
import { PainelGravar } from './PainelGravar'
import { PainelTraduzir } from './PainelTraduzir'
import { FASES } from './qualidade'
import { useCamera } from './useCamera'

// O que a gravação mostra sobre e abaixo da câmera
export type Palco = {
  fala: string            // texto grande no meio da imagem (com a contagem)
  anuncio: string         // o mesmo, sem a contagem: é o que o leitor de tela lê
  roteiro: number | null  // segundos decorridos da gravação, ou null
}
const PALCO_VAZIO: Palco = { fala: '', anuncio: '', roteiro: null }

export function Aplicativo() {
  const { video, tela, estado, erro, proporcao, maosNaTela, corpoNaTela, ligar, ouvir } = useCamera({ automatica: true })
  const [gravando, setGravando] = useState(false)
  const [palco, setPalco] = useState<Palco>(PALCO_VAZIO)
  const mostrar = useCallback((p: Partial<Palco>) => setPalco((atual) => ({ ...atual, ...p })), [])

  // Se o aviso de permissão ficar sem resposta, oferece o botão de novo
  const [demorou, setDemorou] = useState(false)
  useEffect(() => {
    if (estado !== 'pedindo') return
    const espera = setTimeout(() => setDemorou(true), 8000)
    return () => {
      clearTimeout(espera)
      setDemorou(false)
    }
  }, [estado])

  const ligada = estado === 'ligada'

  return (
    <>
      <header className="app-topo">
        <div className="caixa app-topo-barra">
          <h1 className="nome">Ponte Libras</h1>
          <p className="app-comandos">
            <kbd>Espaço</kbd> grava um sinal <span aria-hidden="true">·</span> <kbd>C</kbd> limpa a tradução
          </p>
        </div>
      </header>

      <main className="caixa app">
        <div className="app-principal">
          <section className="app-camera" aria-label="Câmera" id="camera">
            <div className="app-tela" style={{ aspectRatio: String(proporcao) }}>
              {/* o vídeo fica sempre na página: o Chrome pausa vídeo sem som que não está à vista */}
              <video ref={video} className="espelho" playsInline muted />
              <canvas ref={tela} className="espelho" hidden={!ligada} />

              {!ligada && (
                <div className="app-convite">
                  {estado === 'pedindo' ? (
                    <>
                      <p>Permita o acesso à câmera no aviso do navegador.</p>
                      {demorou && (
                        <>
                          <p className="app-convite-dica">
                            Não apareceu? Clique no ícone da câmera na barra de endereço, ou peça de novo:
                          </p>
                          <button className="botao botao-claro" onClick={ligar}>
                            Ligar a câmera
                          </button>
                        </>
                      )}
                    </>
                  ) : estado === 'carregando' || estado === 'desligada' ? (
                    <p>Carregando o reconhecimento das mãos…</p>
                  ) : (
                    <>
                      {erro && (
                        <p className="app-erro" role="alert">
                          {erro}
                        </p>
                      )}
                      <button className="botao botao-claro" onClick={ligar}>
                        {erro ? 'Tentar de novo' : 'Ligar a câmera'}
                      </button>
                    </>
                  )}
                </div>
              )}

              {ligada && (
                <>
                  <ul className="app-indicadores">
                    <li data-ok={corpoNaTela}>{corpoNaTela ? 'Ombros visíveis' : 'Mostre os ombros'}</li>
                    <li data-ok={maosNaTela > 0}>
                      {maosNaTela === 0 ? 'Nenhuma mão' : maosNaTela === 1 ? '1 mão' : '2 mãos'}
                    </li>
                  </ul>
                  <p className="app-fala" aria-hidden="true">{palco.fala}</p>
                </>
              )}
            </div>

            {palco.roteiro !== null && (
              <ol className="app-roteiro" aria-hidden="true">
                {FASES.map((f, i) => {
                  const inicio = i ? FASES[i - 1].ate : 0
                  const cheio = Math.min(1, Math.max(0, (palco.roteiro! - inicio) / (f.ate - inicio)))
                  return (
                    <li key={f.texto} style={{ flexGrow: f.ate - inicio }} data-sinal={i === 1}>
                      <b>{i === 1 ? 'sinal · 2 s' : 'mãos abaixadas · 1 s'}</b>
                      <span style={{ transform: `scaleX(${cheio})` }} />
                    </li>
                  )
                })}
              </ol>
            )}
          </section>

          <PainelTraduzir ouvir={ouvir} cameraLigada={ligada} pausada={gravando} />

          <p className="app-privacidade">
            A imagem da câmera não sai do seu computador: o reconhecimento roda aqui, no seu navegador.
          </p>
        </div>

        <PainelGravar ouvir={ouvir} mostrar={mostrar} cameraLigada={ligada} aoMudarOcupado={setGravando} />

        {/* fases da gravação para o leitor de tela: uma vez cada, sem a contagem */}
        <p className="sr-only" aria-live="assertive">
          {palco.anuncio}
        </p>
      </main>
    </>
  )
}
