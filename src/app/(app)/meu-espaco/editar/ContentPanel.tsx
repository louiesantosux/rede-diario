import Link from 'next/link';
import { Window } from '@/components/Window';
import { Icon } from '@/components/Icon';
import { createClient } from '@/lib/supabase/server';
import { sanitizeTheme } from '@/lib/wikiTheme';
import { WikiCardList } from '@/components/wiki/WikiCardList';
import { MediaGallery } from '@/components/MediaGallery';
import { getMediaViews, orderedViews } from '@/lib/media';
import { autoCover } from '@/lib/playlistCover';
import { NotesList, type Note } from '@/components/space/Mural';

const VIS_LABEL: Record<string, string> = {
  private: 'Privada',
  friends: 'Amigos',
  unlisted: 'Não listada',
  public: 'Pública',
};

/** Aba "Conteúdos" do Editar espaço: recados pendentes, wikis, moodboards, playlists e galeria. */
export async function ContentPanel({ userId }: { userId: string }) {
  const supabase = await createClient();
  const [
    { data: wikis },
    { data: boards },
    { data: recent },
    { data: playlists },
    { data: notes },
  ] = await Promise.all([
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
      .select('id, title, description, visibility, cover_media_id')
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false }),
    supabase.rpc('space_notes_of', { p_owner: userId }),
  ]);
  const pending = ((notes ?? []) as Note[]).filter((n) => !n.approved);
  const recentIds = (recent ?? []).map((m) => m.id as string);
  const coverIds = (boards ?? []).map((b) => (b.media_ids as string[])[0]).filter(Boolean);
  const playlistCoverIds = (playlists ?? []).map((p) => p.cover_media_id as string | null).filter((v): v is string => Boolean(v));
  const [media, firstTracks] = await Promise.all([
    getMediaViews(supabase, [...recentIds, ...coverIds, ...playlistCoverIds]),
    playlists?.length
      ? supabase
          .rpc('playlist_first_tracks', { ids: playlists.map((p) => p.id) })
          .then((r) => (r.data ?? []) as { playlist_id: string; source: string; youtube_id: string | null; cover_url: string | null }[])
      : Promise.resolve([]),
  ]);
  const playlistCover = (p: { id: string; cover_media_id: string | null }) =>
    (p.cover_media_id && media[p.cover_media_id]?.url) || autoCover(firstTracks.find((t) => t.playlist_id === p.id));

  return (
    <>
      {pending.length > 0 && (
        <Window title="Recados aguardando aprovação" icon="chat">
          <p style={{ marginTop: 0 }}>Só aparecem no seu mural os recados que você aprovar.</p>
          <NotesList notes={pending} isOwner empty="" />
        </Window>
      )}

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
                  <span className="wiki-card__cover playlist-thumb" aria-hidden="true">
                    {playlistCover(p) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={playlistCover(p)!} alt="" loading="lazy" />
                    ) : (
                      <Icon name="music" />
                    )}
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
    </>
  );
}
