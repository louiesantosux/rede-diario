import type { Metadata } from 'next';
import Link from 'next/link';
import { Window } from '@/components/Window';
import { Notice } from '@/components/Notice';
import { ERRORS, NOTICES, pickMessage } from '@/lib/messages';
import { safeNext } from '@/lib/config';
import { signIn, signInWithGoogle } from '../actions';

export const metadata: Metadata = { title: 'Entrar' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function EntrarPage({ searchParams }: Props) {
  const sp = await searchParams;
  const next = safeNext(Array.isArray(sp.next) ? sp.next[0] : sp.next);

  return (
    <main id="conteudo" className="page page--narrow">
      <Window title="Entrar" icon="lock" headingLevel={1}>
        <div className="stack">
          <Notice error={pickMessage(ERRORS, sp.erro)} ok={pickMessage(NOTICES, sp.aviso)} />

          <form action={signIn} className="stack">
            <input type="hidden" name="next" value={next} />
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="field">
              <label htmlFor="password">Senha</label>
              <input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>
            <button type="submit" className="btn btn--primary btn--block">
              Entrar
            </button>
          </form>

          <p className="divider">ou</p>

          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={next} />
            <button type="submit" className="btn btn--block">
              Entrar com o Google
            </button>
          </form>

          <div className="row" style={{ justifyContent: 'space-between' }}>
            <Link href="/recuperar-senha">Esqueci minha senha</Link>
            <Link href="/cadastro">Criar conta</Link>
          </div>
        </div>
      </Window>
    </main>
  );
}
