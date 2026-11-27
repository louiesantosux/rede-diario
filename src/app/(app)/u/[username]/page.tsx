import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Window } from '@/components/Window';
import { Icon } from '@/components/Icon';
import { RichText } from '@/components/RichText';
import { MediaGallery } from '@/components/MediaGallery';
import { BackgroundMusic } from '@/components/wiki/BackgroundMusic';
import { NotesList, type Note } from '@/components/space/Mural';
import { NoteForm } from '@/components/space/NoteForm';
import { SpaceOrnaments } from '@/components/space/SpaceOrnaments';
import { createClient } from '@/lib/supabase/server';
import { getMediaViews, orderedViews } from '@/lib/media';
import { docMediaIds, isPostBody, sanitizeDoc } from '@/lib/richtext';
import { sanitizeTheme } from '@/lib/wikiTheme';
import {
  MODULE_INFO,
  sanitizeSpaceTheme,
  spaceClass,
  spaceStyle,
  type ModuleKey,
  type ModuleVis,
} from '@/lib/space';

type Props = { params: Promise<{ username: string }> };

type SpaceData = {
  id: string;
  username: string;
  display_name: string;
  mood: string;
  bio: string;
  is_owner: boolean;
  is_friend: boolean;
  theme: unknown;
  modules: { key: ModuleKey; on: boolean; vis: ModuleVis }[];
  about: unknown;
  avatar_media_id: string | null;
  bg_media_id: string | null;
};

const dateFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'America/Sao_Paulo' });
const HANDLE_RE = /^[a-z0-9_.]{3,24}$/i;

async function loadSpace(username: string) {
  const handle = decodeURIComponent(username);
  if (!HANDLE_RE.test(handle)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc('get_space', { handle });
  return { supabase, space: (data as SpaceData | null) ?? null };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const res = await loadSpace(username);
  const s = res?.space;
  return { title: s ? `Espaço de ${s.display_name || `@${s.username}`}` : 'Espaço' };
}

const excerpt = (body: unknown) => {
  const text = isPostBody(body) ? body.text.trim() : '';
  return text.length > 220 ? `${text.slice(0, 220).trimEnd()}…` : text || 'Post com imagens';
};

export default async function SpacePage({ params }: Props) {
  const { username } = await params;
  const res = await loadSpace(username);

  if (!res?.space) {
    return (
      <main id="conteudo" className="page">
        <Window title="Espaço indisponível" icon="lock" headingLevel={1}>
          <p style={{ marginTop: 0 }}>
            Este espaço não existe ou está aberto só para amigos de quem o criou.
          </p>
          <Link href="/amigos" className="btn">
            <Icon name="friends" className="btn__icon" />
            Ir para Amigos
          </Link>
        </Window>
      </main>
    );
  }

  const { supabase, space: s } = res;
  const theme = sanitizeSpaceTheme(s.theme);
  const keys = new Set(s.modules.map((m) => m.key));
  const name = s.display_name || `@${s.username}`;
  const about = sanitizeDoc(s.about);

  const [posts, missions, wikis, boards, playlists, gallery, friends, notes] = await Promise.all([
    keys.has('posts')
      ? supabase
          .from('posts')
          .select('id, body, created_at, visibility')
          .eq('author_id', s.id)
          .is('mission_id', null)
          .order('created_at', { ascending: false })
          .limit(5)
          .then((r) => r.data ?? [])
      : [],
    keys.has('missoes')
      ? supabase
          .from('posts')
          .select('id, body, created_at, mission:missions(prompt)')
          .eq('author_id', s.id)
          .not('mission_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(5)
          .then((r) => r.data ?? [])
      : [],
    keys.has('wikis')
      ? supabase
          .from('wikis')
          .select('id, title, description, theme')
          .eq('owner_id', s.id)
          .order('updated_at', { ascending: false })
          .then((r) => r.data ?? [])
      : [],
    keys.has('moodboards')
      ? supabase
          .from('moodboards')
          .select('id, title, media_ids')
          .eq('owner_id', s.id)
          .order('updated_at', { ascending: false })
          .then((r) => r.data ?? [])
      : [],
    keys.has('playlists')
      ? supabase
          .from('playlists')
          .select('id, title, description')
          .eq('owner_id', s.id)
          .order('updated_at', { ascending: false })
          .then((r) => r.data ?? [])
      : [],
    keys.has('galeria')
      ? supabase
          .from('media')
          .select('id')
          .eq('owner_id', s.id)
          .order('created_at', { ascending: false })
          .limit(12)
          .then((r) => (r.data ?? []).map((m) => m.id as string))
      : [],
    keys.has('amigos')
      ? supabase.rpc('friends_of_space', { p_owner: s.id }).then((r) => (r.data ?? []) as { username: string; display_name: string }[])
      : [],
    keys.has('mural')
      ? supabase.rpc('space_notes_of', { p_owner: s.id }).then((r) => (r.data ?? []) as Note[])
      : [],
  ]);

  const coverIds = boards.map((b) => (b.media_ids as string[])[0]).filter(Boolean);
  const media = await getMediaViews(supabase, [
    ...[s.avatar_media_id, s.bg_media_id].filter((v): v is string => Boolean(v)),
    ...(about ? docMediaIds(about) : []),
    ...coverIds,
    ...gallery,
  ]);
  const avatar = s.avatar_media_id ? media[s.avatar_media_id] : undefined;
  const bg = s.bg_media_id ? media[s.bg_media_id] : undefined;

  const visibleNotes = s.is_owner ? notes : notes.filter((n) => n.approved || n.is_mine);
  const empty = <p className="space-muted" style={{ margin: 0 }}>Nada por aqui ainda.</p>;

  const render: Record<ModuleKey, () => ReactNode> = {
    sobre: () => (about && about.content.length > 0 ? <RichText doc={about} media={media} /> : empty),
    posts: () =>
      posts.length ? (
        <ul className="space-list">
          {posts.map((p) => (
            <li key={p.id}>
              <Link href={`/post/${p.id}`}>{excerpt(p.body)}</Link>
              <span className="space-muted">
                {dateFmt.format(new Date(p.created_at))}
                {s.is_owner && p.visibility === 'private' ? ' · só você vê' : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        empty
      ),
    missoes: () =>
      missions.length ? (
        <ul className="space-list">
          {missions.map((p) => {
            const m = p.mission as unknown as { prompt: string } | null;
            return (
              <li key={p.id}>
                {m && <span className="space-list__kicker">{m.prompt}</span>}
                <Link href={`/post/${p.id}`}>{excerpt(p.body)}</Link>
              </li>
            );
          })}
        </ul>
      ) : (
        empty
      ),
    wikis: () =>
      wikis.length ? (
        <ul className="space-cards">
          {wikis.map((w) => {
            const t = sanitizeTheme(w.theme);
            return (
              <li key={w.id}>
                <Link href={`/wiki/${w.id}`} className="space-card">
                  <span className="space-card__swatch" aria-hidden="true" style={{ background: t.bg, borderColor: t.accent }} />
                  <span>
                    <span className="space-card__title">{w.title}</span>
                    {w.description && <span className="space-card__hint">{w.description}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        empty
      ),
    moodboards: () =>
      boards.length ? (
        <ul className="space-cards space-cards--grid">
          {boards.map((b) => {
            const cover = media[(b.media_ids as string[])[0]];
            return (
              <li key={b.id}>
                <Link href={`/moodboard/${b.id}`} className="space-card space-card--cover">
                  <span className="space-card__cover" aria-hidden="true">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {cover && <img src={cover.url} alt="" loading="lazy" />}
                  </span>
                  <span className="space-card__title">{b.title}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        empty
      ),
    playlists: () =>
      playlists.length ? (
        <ul className="space-cards">
          {playlists.map((p) => (
            <li key={p.id}>
              <Link href={`/playlist/${p.id}`} className="space-card">
                <span className="space-card__icon" aria-hidden="true">
                  <Icon name="music" />
                </span>
                <span>
                  <span className="space-card__title">{p.title}</span>
                  {p.description && <span className="space-card__hint">{p.description}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        empty
      ),
    galeria: () =>
      gallery.length ? <MediaGallery items={orderedViews(gallery, media)} layout="grade" label={`Fotos de ${name}`} /> : empty,
    amigos: () =>
      friends.length ? (
        <ul className="space-friends">
          {friends.map((f) => (
            <li key={f.username}>
              <Link href={`/u/${f.username}`}>{f.display_name || `@${f.username}`}</Link>
            </li>
          ))}
        </ul>
      ) : (
        empty
      ),
    mural: () => (
      <div className="stack">
        {!s.is_owner && s.is_friend && <NoteForm ownerId={s.id} ownerName={name} />}
        <NotesList notes={visibleNotes} isOwner={s.is_owner} empty="Nenhum recado no mural ainda." />
      </div>
    ),
  };

  return (
    <main id="conteudo" className="page page--wide">
      <div className={spaceClass(theme, Boolean(bg))} style={spaceStyle(theme, bg?.url)}>
        <SpaceOrnaments ornament={theme.ornament} />
        {s.is_owner && (
          <div className="space-owner-bar" role="note">
            <span>
              Você está vendo seu espaço como os outros veem. Módulos marcados “Só eu” aparecem só para você.
            </span>
            <Link href="/meu-espaco/editar" className="btn">
              <Icon name="pen" className="btn__icon" />
              Editar espaço
            </Link>
          </div>
        )}

        <header className="space-box space-header">
          <div className="space-box__body space-header__body">
            <span className="space-avatar space-avatar--lg" aria-hidden={avatar ? undefined : true}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {avatar ? <img src={avatar.url} alt={avatar.alt || `Foto de ${name}`} /> : <Icon name="user" />}
            </span>
            <div className="space-header__text">
              <h1 className="space-header__name">{name}</h1>
              <p className="space-muted" style={{ margin: 0 }}>
                @{s.username}
              </p>
              {s.mood && (
                <p className="space-header__mood">
                  <span className="space-muted">Humor:</span> {s.mood}
                </p>
              )}
              {s.bio && <p className="space-header__bio">{s.bio}</p>}
              {theme.bgMusic && (
                <BackgroundMusic
                  youtubeId={theme.bgMusic.youtubeId}
                  title={theme.bgMusic.title}
                  pageTitle={`espaço de ${name}`}
                />
              )}
            </div>
          </div>
        </header>

        {s.modules.map((m) => {
          const titleId = `mod-${m.key}`;
          return (
            <section key={m.key} className="space-box" aria-labelledby={titleId}>
              <div className="space-box__title">
                <h2 id={titleId}>{MODULE_INFO[m.key].label}</h2>
                {s.is_owner && m.vis === 'private' && <span className="space-box__tag">Só você vê</span>}
              </div>
              <div className="space-box__body">{render[m.key]()}</div>
            </section>
          );
        })}

        {s.modules.length === 0 && (
          <div className="space-box">
            <div className="space-box__body">
              <p className="space-muted" style={{ margin: 0 }}>
                {s.is_owner ? 'Nenhum módulo ligado. Ligue alguns em Editar espaço.' : `${name} ainda não mostrou nada aqui.`}
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
