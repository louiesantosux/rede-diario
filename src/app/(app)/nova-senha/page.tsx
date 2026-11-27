import type { Metadata } from 'next';
import { Window } from '@/components/Window';
import { Notice } from '@/components/Notice';
import { ERRORS, pickMessage } from '@/lib/messages';
import { updatePassword } from '../../(auth)/actions';

export const metadata: Metadata = { title: 'Nova senha' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// Fica no grupo (app) porque exige sessão: o link do e-mail autentica antes de chegar aqui.
export default async function NovaSenhaPage({ searchParams }: Props) {
  const sp = await searchParams;

  return (
    <main id="conteudo" className="page page--narrow">
      <Window title="Criar nova senha" icon="lock" headingLevel={1}>
        <form action={updatePassword} className="stack">
          <Notice error={pickMessage(ERRORS, sp.erro)} />
          <div className="field">
            <label htmlFor="password">Nova senha</label>
            <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
          </div>
          <div className="field">
            <label htmlFor="confirm">Confirmar nova senha</label>
            <input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={10} />
          </div>
          <p className="muted">Ao salvar, as sessões nos seus outros dispositivos serão encerradas.</p>
          <button type="submit" className="btn btn--primary btn--block">
            Salvar senha
          </button>
        </form>
      </Window>
    </main>
  );
}
