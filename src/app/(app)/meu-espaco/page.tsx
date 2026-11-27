import type { Metadata } from 'next';
import Link from 'next/link';
import { Window } from '@/components/Window';
import { Icon } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { createClient } from '@/lib/supabase/server';
import { NOTICES, pickMessage } from '@/lib/messages';
import { sanitizeTheme } from '@/lib/wikiTheme';

export const metadata: Metadata = { title: 'Meu espaço' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const VIS_LABEL: Record<string, string> = {
  private: 'Privada',
  friends: 'Amigos',
  unlisted: 'Não listada',
  public: 'Pública',
};

export default async function MeuEspacoPage({ searchParams }: Props) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user!.id;

  const [{ data: profile }, { data: wikis }] = await Promise.all([
    supabase.from('profiles').select('username, display_name, mood').eq('id', userId).single(),
    supabase
      .from('wikis')
      .select('id, title, description, visibility, theme')
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false }),
  ]);

  return (
    <main id="conteudo" className="page">
      <Notice ok={pickMessage(NOTICES, sp.aviso)} />

      <Window title="Meu espaço" icon="user" headingLevel={1}>
        <div className="profile-head">
          <div>
            <p className="profile-head__name">{profile?.display_name || `@${profile?.username ?? ''}`}</p>
            <p className="muted" style={{ margin: 0 }}>
              @{profile?.username}
              {profile?.mood ? ` · ${profile.mood}` : ''}
            </p>
          </div>
          <Link href="/configuracoes" className="btn">
            <Icon name="gear" className="btn__icon" />
            Ajustes
          </Link>
        </div>
      </Window>

      <Window title="Minhas wikis" icon="book">
        {wikis && wikis.length > 0 ? (
          <ul className="wiki-cards">
            {wikis.map((w) => {
              const t = sanitizeTheme(w.theme);
              return (
                <li key={w.id}>
                  <Link href={`/wiki/${w.id}`} className="wiki-card">
                    <span className="wiki-card__swatch" style={{ background: t.bg, borderColor: t.accent }} aria-hidden="true">
                      <span style={{ background: t.surface }} />
                    </span>
                    <span className="wiki-card__text">
                      <span className="wiki-card__title">{w.title}</span>
                      <span className="wiki-card__hint">
                        {VIS_LABEL[w.visibility]}
                        {w.description ? ` · ${w.description}` : ''}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p style={{ marginTop: 0 }}>Você ainda não criou nenhuma wiki.</p>
        )}
        <div style={{ marginTop: 16 }}>
          <Link href="/criar/wiki" className="btn btn--primary">
            <Icon name="plus" className="btn__icon" />
            Nova wiki
          </Link>
        </div>
      </Window>
    </main>
  );
}
