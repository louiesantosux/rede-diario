import type { Metadata } from 'next';
import Link from 'next/link';
import { Window } from '@/components/Window';
import { Notice } from '@/components/Notice';
import { ERRORS, pickMessage } from '@/lib/messages';
import { signUp, signInWithGoogle } from '../actions';

export const metadata: Metadata = { title: 'Criar conta' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function CadastroPage({ searchParams }: Props) {
  const sp = await searchParams;

  return (
    <main id="conteudo" className="page page--narrow">
      <Window title="Criar conta" icon="star" headingLevel={1}>
        <div className="stack">
          <p className="muted">Sem curtidas, sem contadores, sem algoritmo. Só o que você escolher criar.</p>
          <Notice error={pickMessage(ERRORS, sp.erro)} />

          <form action={signUp} className="stack">
            <div className="field">
              <label htmlFor="displayName">Nome de exibição</label>
              <input id="displayName" name="displayName" type="text" autoComplete="nickname" maxLength={60} />
            </div>
            <div className="field">
              <label htmlFor="username">@usuário</label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                minLength={3}
                maxLength={24}
                pattern="[a-z0-9_.]{3,24}"
                aria-describedby="username-help"
              />
              <small id="username-help">De 3 a 24 caracteres: letras minúsculas, números, ponto ou sublinhado.</small>
            </div>
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="field">
              <label htmlFor="password">Senha</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                aria-describedby="password-help"
              />
              <small id="password-help">Mínimo de 10 caracteres. Uma frase longa é mais segura que símbolos.</small>
            </div>
            <div className="field">
              <label htmlFor="confirm">Confirmar senha</label>
              <input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={10} />
            </div>
            <button type="submit" className="btn btn--primary btn--block">
              Criar conta
            </button>
          </form>

          <p className="divider">ou</p>

          <form action={signInWithGoogle}>
            <button type="submit" className="btn btn--block">
              Continuar com o Google
            </button>
          </form>

          <p>
            Já tem conta? <Link href="/entrar">Entrar</Link>
          </p>
        </div>
      </Window>
    </main>
  );
}
