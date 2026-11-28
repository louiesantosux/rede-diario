import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Encerra uma sessão que o navegador ainda guarda, mas que o Supabase não
 * reconhece mais (usuário removido, sessão revogada). Sem isso, o proxy via o
 * cookie como válido e mandava para /inicio, que mandava de volta para /entrar,
 * em loop (ERR_TOO_MANY_REDIRECTS).
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    /* a sessão já não existe no servidor; os cookies são apagados abaixo */
  }

  const url = new URL('/entrar', request.url);
  url.searchParams.set('aviso', 'sessao-expirada');
  const response = NextResponse.redirect(url);
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith('sb-')) response.cookies.set(cookie.name, '', { path: '/', maxAge: 0 });
  }
  return response;
}
