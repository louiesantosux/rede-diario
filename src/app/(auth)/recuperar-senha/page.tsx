import type { Metadata } from 'next';
import Link from 'next/link';
import { Window } from '@/components/Window';
import { Notice } from '@/components/Notice';
import { NOTICES, pickMessage } from '@/lib/messages';
import { requestPasswordReset } from '../actions';

export const metadata: Metadata = { title: 'Recuperar senha' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function RecuperarSenhaPage({ searchParams }: Props) {
  const sp = await searchParams;

  return (
    <main id="conteudo" className="page page--narrow">
      <Window title="Recuperar senha" icon="lock" headingLevel={1}>
        <div className="stack">
          <Notice ok={pickMessage(NOTICES, sp.aviso)} />
          <p>Informe o e-mail da conta. Enviaremos um link para criar uma nova senha.</p>
          <form action={requestPasswordReset} className="stack">
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <button type="submit" className="btn btn--primary btn--block">
              Enviar link
            </button>
          </form>
          <Link href="/entrar">Voltar para entrar</Link>
        </div>
      </Window>
    </main>
  );
}
