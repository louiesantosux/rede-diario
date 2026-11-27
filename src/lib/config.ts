// Nome provisório até a validação com usuários (ver PRD, seção "Sugestões de nome").
export const APP_NAME = 'Papel de Carta';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

// Aceita apenas caminhos internos, para evitar redirecionamento aberto.
export function safeNext(value: unknown, fallback = '/inicio'): string {
  if (typeof value !== 'string') return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}
