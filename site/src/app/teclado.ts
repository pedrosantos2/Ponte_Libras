// Atalhos de teclado (Espaço grava, C limpa) só valem fora de campo de texto:
// quem está digitando o nome de um sinal não pode disparar comando sem querer.
export const digitando = (alvo: EventTarget | null) =>
  alvo instanceof HTMLElement && (alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName))
