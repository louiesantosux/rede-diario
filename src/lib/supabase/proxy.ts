import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/', '/entrar', '/cadastro', '/recuperar-senha', '/auth'];
const GUEST_ONLY = ['/', '/entrar', '/cadastro'];

const isPublic = (path: string) =>
  PUBLIC_PATHS.some((p) => (p === '/' ? path === '/' : path === p || path.startsWith(`${p}/`)));

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Não coloque código entre a criação do cliente e esta chamada: ela renova o token.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const path = request.nextUrl.pathname;

  const redirectTo = (pathname: string, keepNext = false) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = '';
    if (keepNext) url.searchParams.set('next', path);
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!signedIn && !isPublic(path)) return redirectTo('/entrar', true);
  if (signedIn && GUEST_ONLY.includes(path)) return redirectTo('/inicio');

  return response;
}
