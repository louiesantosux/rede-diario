'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SITE_URL, safeNext } from '@/lib/config';

const USERNAME_RE = /^[a-z0-9_.]{3,24}$/;
const MIN_PASSWORD = 10;

const str = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

async function origin() {
  const h = await headers();
  return h.get('origin') ?? SITE_URL;
}

export async function signIn(form: FormData) {
  const next = safeNext(form.get('next'));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: str(form, 'email'),
    password: String(form.get('password') ?? ''),
  });

  if (error) {
    console.error('[signIn]', error.status, error.code, error.message);
    const code =
      error.code === 'email_not_confirmed'
        ? 'email-nao-confirmado'
        : error.status === 429
          ? 'muitas'
          : 'credenciais';
    redirect(`/entrar?erro=${code}&next=${encodeURIComponent(next)}`);
  }
  redirect(next);
}

export async function signUp(form: FormData) {
  const username = str(form, 'username').toLowerCase();
  const password = String(form.get('password') ?? '');
  const confirm = String(form.get('confirm') ?? '');

  if (!USERNAME_RE.test(username)) redirect('/cadastro?erro=usuario-invalido');
  if (password.length < MIN_PASSWORD) redirect('/cadastro?erro=senha-curta');
  if (password !== confirm) redirect('/cadastro?erro=senhas-diferentes');

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: str(form, 'email'),
    password,
    options: {
      data: { username, display_name: str(form, 'displayName') },
      emailRedirectTo: `${await origin()}/auth/confirm?next=/inicio`,
    },
  });

  if (error) {
    // Aparece em Vercel → Logs; nunca registra e-mail nem senha.
    console.error('[signUp]', error.status, error.code, error.message);
    const map: Record<string, string> = {
      user_already_exists: 'email-em-uso',
      email_exists: 'email-em-uso',
      email_address_not_authorized: 'email-nao-autorizado',
      over_email_send_rate_limit: 'limite-email',
      over_request_rate_limit: 'muitas',
      weak_password: 'senha-fraca',
      email_address_invalid: 'email-invalido',
      validation_failed: 'email-invalido',
      signup_disabled: 'cadastro-desativado',
      unexpected_failure: 'erro-banco',
    };
    redirect(`/cadastro?erro=${map[error.code ?? ''] ?? (error.status === 429 ? 'muitas' : 'cadastro-falhou')}`);
  }
  redirect('/entrar?aviso=confirme-email');
}

export async function signInWithGoogle(form: FormData) {
  const next = safeNext(form.get('next'));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });

  if (error || !data.url) redirect('/entrar?erro=google-falhou');
  redirect(data.url);
}

export async function requestPasswordReset(form: FormData) {
  const supabase = await createClient();
  // A resposta é sempre a mesma, para não revelar quais e-mails têm conta.
  await supabase.auth.resetPasswordForEmail(str(form, 'email'), {
    redirectTo: `${await origin()}/auth/confirm?next=/nova-senha`,
  });
  redirect('/recuperar-senha?aviso=link-enviado');
}

export async function updatePassword(form: FormData) {
  const password = String(form.get('password') ?? '');
  const confirm = String(form.get('confirm') ?? '');
  if (password.length < MIN_PASSWORD) redirect('/nova-senha?erro=senha-curta');
  if (password !== confirm) redirect('/nova-senha?erro=senhas-diferentes');

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect('/nova-senha?erro=senha-falhou');

  // PRD: a troca de senha encerra as sessões em outros dispositivos.
  await supabase.auth.signOut({ scope: 'others' });
  redirect('/inicio?aviso=senha-alterada');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/entrar?aviso=saiu');
}
