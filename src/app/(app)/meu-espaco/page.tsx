import type { Metadata } from 'next';
import Link from 'next/link';
import { Window } from '@/components/Window';
import { Icon } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { createClient } from '@/lib/supabase/server';
import { NOTICES, pickMessage } from '@/lib/messages';
import { sanitizeTheme } from '@/lib/wikiTheme';
import { WikiCardList } from '@/components/wiki/WikiCardList';
import { MediaGallery } from '@/components/MediaGallery';
import { getMediaViews, orderedViews } from '@/lib/media';
import { NotesList, type Note } from '@/components/space/Mural';
import { SiteAppearance } from '@/components/space/SiteAppearance';

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

  const [
    { data: profile },
    { data: wikis },
    { data: boards },
    { data: recent },
    { data: playlists },
    { data: space },
    { data: notes },
  ] = await Promise.all([
    supabase.from('profiles').select('username, display_name, mood, theme, a11y_prefs').eq('id', userId).single(),
    supabase
      .from('wikis')
      .select('id, title, description, visibility, theme')
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('moodboards')
      .select('id, title, media_ids')
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false }),
    supabase.from('media').select('id').eq('owner_id', userId).order('created_at', { ascending: false }).limit(12),
    supabase
      .from('playlists')
      .select('id, title, description, visibility')
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false }),
    supabase.from('spaces').select('avatar_media_id').eq('owner_id', userId).maybeSingle(),
    supabase.rpc('space_notes_of', { p_owner: userId }),
  ]);
  const pending = ((notes ?? []) as Note[]).filter((n) => !n.approved);
  const avatarId = (space?.avatar_media_id as string | null) ?? null;
  const recentIds = (recent ?? []).map((m) => m.id as string);
  const coverIds = (boards ?? []).map((b) => (b.media_ids as string[])[0]).filter(Boolean);
  const media = await getMediaViews(supabase, [...recentIds, ...coverIds, ...(avatarId ? [avatarId] : [])]);
  const avatar = avatarId ? media[avatarId] : undefined;

  return (
    <main id="conteudo" className="page">
      <Notice ok={pickMessage(NOTICES, sp.aviso)} />

      <Window title="Meu espaço" icon="user" headingLevel={1}>
        <div className="profile-head">
          <div className="profile-head__id">
            <span className="space-avatar" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {avatar ? <img src={avatar.url} alt="" /> : <Icon name="user" />}
            </span>
            <div>
              <p className="profile-head__name">{profile?.display_name || `@${profile?.username ?? ''}`}</p>
              <p className="muted" style={{ margin: 0 }}>
                @{profile?.username}
                {profile?.mood ? ` · ${profile.mood}` : ''}
              </p>
            </div>
          </div>
          <div className="row">
            <Link href={`/u/${profile?.username ?? ''}`} className="btn">
              <Icon name="eye" className="btn__icon" />
              Ver meu espaço
            </Link>
            <Link href="/meu-espaco/editar" className="btn btn--primary">
              <Icon name="pen" className="btn__icon" />
              Editar espaço
            </Link>
            <Link href="/configuracoes" className="btn">
              <Icon name="gear" className="btn__icon" />
              Ajustes
            </Link>
          </div>
        </div>
      </Window>

      {pending.length > 0 && (
        <Window title="Recados aguardando aprovação" icon="chat">
          <p style={{ marginTop: 0 }}>Só aparecem no seu mural os recados que você aprovar.</p>
          <NotesList notes={pending} isOwner empty="" />
        </Window>
      )}

      <Window title="Aparência do site" icon="star">
        <SiteAppearance userId={userId} savedUi={profile?.theme ?? null} savedA11y={profile?.a11y_prefs ?? null} />
      </Window>

      <Window title="Minhas wikis" icon="book">
        {wikis && wikis.length > 0 ? (
          <WikiCardList
            wikis={wikis.map((w) => {
              const t = sanitizeTheme(w.theme);
              return {
                id: w.id as string,
                title: w.title as string,
                hint: `${VIS_LABEL[w.visibility as string]}${w.description ? ` · ${w.description}` : ''}`,
                bg: t.bg,
                surface: t.surface,
                accent: t.accent,
              };
            })}
          />
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

      <Window title="Moodboards" icon="image">
        {boards && boards.length > 0 ? (
          <ul className="wiki-cards">
            {boards.map((b) => {
              const cover = media[(b.media_ids as string[])[0]];
              return (
                <li key={b.id}>
                  <Link href={`/moodboard/${b.id}`} className="wiki-card">
                    <span className="wiki-card__cover" aria-hidden="true">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {cover && <img src={cover.url} alt="" />}
                    </span>
                    <span className="wiki-card__text">
                      <span className="wiki-card__title">{b.title}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p style={{ marginTop: 0 }}>Nenhum moodboard ainda.</p>
        )}
      </Window>

      <Window title="Playlists" icon="music">
        {playlists && playlists.length > 0 ? (
          <ul className="wiki-cards">
            {playlists.map((p) => (
              <li key={p.id}>
                <Link href={`/playlist/${p.id}`} className="wiki-card">
                  <span className="wiki-card__cover event-date" aria-hidden="true">
                    <Icon name="music" />
                  </span>
                  <span className="wiki-card__text">
                    <span className="wiki-card__title">{p.title}</span>
                    <span className="wiki-card__hint">
                      {VIS_LABEL[p.visibility]}
                      {p.description ? ` · ${p.description}` : ''}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ marginTop: 0 }}>Nenhuma playlist ainda.</p>
        )}
        <div style={{ marginTop: 16 }}>
          <Link href="/criar/playlist" className="btn">
            <Icon name="plus" className="btn__icon" />
            Nova playlist
          </Link>
        </div>
      </Window>

      <Window title="Galeria" icon="image">
        {recentIds.length > 0 ? (
          <MediaGallery items={orderedViews(recentIds, media)} layout="grade" label="Fotos recentes" />
        ) : (
          <p style={{ marginTop: 0 }}>Suas fotos enviadas aparecem aqui.</p>
        )}
        <div className="row" style={{ marginTop: 16 }}>
          <Link href="/criar/imagem" className="btn">
            <Icon name="image" className="btn__icon" />
            Enviar fotos
          </Link>
          {recentIds.length > 0 && (
            <Link href="/meu-espaco/galeria" className="btn">
              <Icon name="trash" className="btn__icon" />
              Gerenciar e apagar fotos
            </Link>
          )}
        </div>
      </Window>
    </main>
  );
}
