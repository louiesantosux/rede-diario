import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Window } from '@/components/Window';
import { RichText } from '@/components/RichText';
import { MediaGallery } from '@/components/MediaGallery';
import { getMediaViews, orderedViews } from '@/lib/media';
import { createClient } from '@/lib/supabase/server';
import { docMediaIds, isPostBody, sanitizeDoc } from '@/lib/richtext';
import { ReplyForm } from './ReplyForm';

export const metadata: Metadata = { title: 'Post' };

type Props = { params: Promise<{ id: string }> };

const dateFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user!.id;

  const { data: post } = await supabase
    .from('posts')
    .select(
      'id, author_id, body, visibility, reply_policy, media_ids, created_at, wiki_id, author:profiles!posts_author_id_fkey(username, display_name), mission:missions(prompt), wiki:wikis(id, title)',
    )
    .eq('id', id)
    .maybeSingle();
  if (!post) notFound();

  const p = post as unknown as {
    id: string;
    author_id: string;
    body: unknown;
    reply_policy: 'friends' | 'everyone' | 'nobody';
    media_ids: string[] | null;
    created_at: string;
    author: { username: string; display_name: string } | null;
    mission: { prompt: string } | null;
    wiki: { id: string; title: string } | null;
  };
  const mine = p.author_id === userId;
  const mediaIds = p.media_ids ?? [];
  const mediaViews = await getMediaViews(supabase, mediaIds);
  const doc = isPostBody(p.body) ? sanitizeDoc(p.body.doc) : null;
  const inline = doc ? docMediaIds(doc) : [];

  let replies: { id: string; body: string; created_at: string; sender: { username: string; display_name: string } | null }[] = [];
  if (mine) {
    const { data } = await supabase
      .from('post_replies')
      .select('id, body, created_at, sender:profiles!post_replies_sender_id_fkey(username, display_name)')
      .eq('post_id', id)
      .order('created_at', { ascending: true });
    replies = (data ?? []) as unknown as typeof replies;
  }

  let canReply = false;
  if (!mine && p.reply_policy !== 'nobody') {
    if (p.reply_policy === 'everyone') canReply = true;
    else {
      const { data } = await supabase.rpc('are_friends', { a: p.author_id, b: userId });
      canReply = data === true;
    }
  }

  const author = mine ? 'Você' : p.author ? p.author.display_name || `@${p.author.username}` : 'Autor indisponível';

  return (
    <main id="conteudo" className="page">
      <Window title="Post" icon="pen" headingLevel={1}>
        <article className="stack">
          <p className="post__meta muted">
            <span>{author}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={p.created_at}>{dateFmt.format(new Date(p.created_at))}</time>
            {p.wiki && (
              <>
                <span aria-hidden="true">·</span>
                <Link href={`/wiki/${p.wiki.id}`}>{p.wiki.title}</Link>
              </>
            )}
          </p>
          {p.mission && <p className="post__mission">Missão: {p.mission.prompt}</p>}
          {doc ? <RichText doc={doc} media={mediaViews} /> : <p>{isPostBody(p.body) ? p.body.text : ''}</p>}
          <MediaGallery items={orderedViews(mediaIds.filter((m) => !inline.includes(m)), mediaViews)} />
        </article>
      </Window>

      {mine ? (
        <Window title="Respostas (só você vê)" icon="chat">
          {replies.length === 0 ? (
            <p style={{ margin: 0 }} className="muted">
              Ninguém respondeu ainda.
            </p>
          ) : (
            <ol className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {replies.map((r) => (
                <li key={r.id} className="card">
                  <p className="post__meta muted">
                    <span>{r.sender ? r.sender.display_name || `@${r.sender.username}` : 'Alguém'}</span>
                    <span aria-hidden="true">·</span>
                    <time dateTime={r.created_at}>{dateFmt.format(new Date(r.created_at))}</time>
                  </p>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{r.body}</p>
                </li>
              ))}
            </ol>
          )}
        </Window>
      ) : (
        canReply && (
          <Window title="Responder" icon="chat">
            <ReplyForm postId={p.id} />
          </Window>
        )
      )}
    </main>
  );
}
