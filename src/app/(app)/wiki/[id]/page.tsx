import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Window } from '@/components/Window';
import { Icon } from '@/components/Icon';
import { WikiBlocks, type BlockPlaylist, type BlogPost } from '@/components/wiki/WikiBlocks';
import { WikiTabs } from '@/components/wiki/WikiTabs';
import { BackgroundMusic } from '@/components/wiki/BackgroundMusic';
import { Notice } from '@/components/Notice';
import { sanitizePageSettings } from '@/lib/pageSettings';
import { createClient } from '@/lib/supabase/server';
import { blockMediaIds, blockPlaylistIds, sanitizeBlocks } from '@/lib/blocks';
import { getMediaViews } from '@/lib/media';
import { sanitizeTheme, themeStyle } from '@/lib/wikiTheme';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const VIS_LABEL: Record<string, string> = {
  private: 'Privada',
  friends: 'Amigos',
  unlisted: 'Não listada',
  public: 'Pública',
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('wikis').select('title').eq('id', id).maybeSingle();
  return { title: data?.title ?? 'Wiki' };
}

export default async function WikiPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: wiki } = await supabase
    .from('wikis')
    .select('id, owner_id, title, description, visibility, theme')
    .eq('id', id)
    .maybeSingle();
  if (!wiki) notFound();

  const { data: pages } = await supabase
    .from('pages')
    .select('id, title, blocks, position, theme')
    .eq('wiki_id', id)
    .order('position', { ascending: true });

  const list = pages ?? [];
  const wanted = Array.isArray(sp.p) ? sp.p[0] : sp.p;
  const current = list.find((p) => p.id === wanted) ?? list[0];
  const blocks = current ? sanitizeBlocks(current.blocks) : [];
  const pageSettings = sanitizePageSettings(current?.theme);
  const isOwner = wiki.owner_id === auth.user?.id;
  const theme = sanitizeTheme(wiki.theme);

  let posts: BlogPost[] = [];
  if (blocks.some((b) => b.type === 'blog')) {
    const { data } = await supabase
      .from('posts')
      .select('id, body, created_at')
      .eq('wiki_id', id)
      .order('created_at', { ascending: false })
      .limit(30);
    posts = data ?? [];
  }

  const media = await getMediaViews(supabase, blockMediaIds(blocks));

  const playlists: Record<string, BlockPlaylist> = {};
  const playlistIds = blockPlaylistIds(blocks);
  if (playlistIds.length) {
    const [{ data: pls }, { data: tracks }] = await Promise.all([
      supabase.from('playlists').select('id, title').in('id', playlistIds),
      supabase
        .from('playlist_tracks')
        .select('id, playlist_id, youtube_id, title, author')
        .in('playlist_id', playlistIds)
        .order('position', { ascending: true }),
    ]);
    for (const pl of pls ?? []) {
      playlists[pl.id] = {
        id: pl.id,
        title: pl.title,
        tracks: (tracks ?? []).filter((t) => t.playlist_id === pl.id),
      };
    }
  }

  return (
    <main id="conteudo" className="page page--wide">
      <Window
        title={wiki.title}
        icon="book"
        headingLevel={1}
        bodyClassName={`wiki-surface wiki-pattern--${theme.pattern} wiki-font--${theme.font}`}
        bodyStyle={themeStyle(theme)}
      >
        <div className="wiki-paper">
          {(Array.isArray(sp.aviso) ? sp.aviso[0] : sp.aviso) === 'pagina-excluida' && (
            <div style={{ marginBottom: 16 }}>
              <Notice ok="Página excluída." />
            </div>
          )}
          <header className="wiki-header">
            <div>
              {wiki.description && <p className="wiki-description">{wiki.description}</p>}
              {isOwner && <p className="wiki-meta">Visibilidade: {VIS_LABEL[wiki.visibility]}</p>}
            </div>
            {isOwner && (
              <div className="row">
                {current && (
                  <Link href={`/wiki/${id}/editar?p=${current.id}`} className="btn">
                    <Icon name="pen" className="btn__icon" />
                    Editar página
                  </Link>
                )}
                {blocks.some((b) => b.type === 'blog') && (
                  <Link href={`/criar/post?wiki=${id}`} className="btn">
                    <Icon name="plus" className="btn__icon" />
                    Novo post no blog
                  </Link>
                )}
                <Link href={`/wiki/${id}/ajustes`} className="btn">
                  <Icon name="gear" className="btn__icon" />
                  Aparência
                </Link>
              </div>
            )}
          </header>

          <WikiTabs
            wikiId={id}
            pages={list.map((p) => ({ id: p.id as string, title: p.title as string }))}
            currentId={current?.id ?? null}
            isOwner={isOwner}
          />

          {current ? (
            <article className="wiki-page">
              <h2 className="wiki-page__title">{current.title}</h2>
              {pageSettings.bgMusic && (
                <BackgroundMusic
                  youtubeId={pageSettings.bgMusic.youtubeId}
                  title={pageSettings.bgMusic.title}
                  pageTitle={current.title}
                />
              )}
              <WikiBlocks blocks={blocks} posts={posts} media={media} playlists={playlists} />
            </article>
          ) : (
            <p className="wiki-empty">
              {isOwner ? 'Esta wiki não tem páginas. Use “+ Nova página” para criar uma.' : 'Nenhuma página visível nesta wiki.'}
            </p>
          )}
        </div>
      </Window>
    </main>
  );
}
