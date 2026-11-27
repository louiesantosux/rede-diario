import type { Metadata } from 'next';
import Link from 'next/link';
import { Window } from '@/components/Window';
import { Notice } from '@/components/Notice';
import { RichText } from '@/components/RichText';
import { createClient } from '@/lib/supabase/server';
import { NOTICES, pickMessage } from '@/lib/messages';
import { isPostBody, sanitizeDoc } from '@/lib/richtext';
import { MissionCard } from './MissionCard';

export const metadata: Metadata = { title: 'Início' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

type FeedPost = {
  id: string;
  author_id: string;
  body: unknown;
  visibility: 'private' | 'friends' | 'unlisted' | 'public';
  created_at: string;
  author: { username: string; display_name: string } | null;
  mission: { prompt: string } | null;
};

const PAGE_SIZE = 20;
const VIS_LABEL: Record<FeedPost['visibility'], string> = {
  private: 'Privado',
  friends: 'Amigos',
  unlisted: 'Não listado',
  public: 'Público',
};
const dateFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });

function PostBodyView({ body }: { body: unknown }) {
  if (isPostBody(body)) {
    const doc = sanitizeDoc(body.doc); // defesa extra na leitura
    if (doc) return <RichText doc={doc} />;
  }
  const text = typeof body === 'object' && body && 'text' in body ? String((body as { text: unknown }).text) : '';
  return <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{text}</p>;
}

export default async function InicioPage({ searchParams }: Props) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user!.id;

  const [{ data: profile }, { data: mission }, { data: postRows }] = await Promise.all([
    supabase.from('profiles').select('display_name, username, wellbeing_prefs').eq('id', userId).single(),
    supabase
      .from('missions')
      .select('id, prompt, mission_date')
      .lte('mission_date', new Date().toISOString().slice(0, 10))
      .order('mission_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Cronológico reverso, sem ranqueamento. RLS já restringe a amigos, públicos e próprios.
    supabase
      .from('posts')
      .select(
        'id, author_id, body, visibility, created_at, author:profiles!posts_author_id_fkey(username, display_name), mission:missions(prompt)',
      )
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE),
  ]);
  const posts = (postRows ?? []) as unknown as FeedPost[];

  const showMission = (profile?.wellbeing_prefs as { missions?: boolean } | null)?.missions !== false;
  const name = profile?.display_name || (profile ? `@${profile.username}` : '');

  return (
    <main id="conteudo" className="page">
      <h1 className="sr-only">Início</h1>
      <Notice ok={pickMessage(NOTICES, sp.aviso)} />

      {showMission && mission && <MissionCard id={mission.id} date={mission.mission_date} prompt={mission.prompt} />}

      <Window title={name ? `Olá, ${name}` : 'Recentes'} icon="home">
        {posts.length > 0 ? (
          <ol className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {posts.map((post) => {
              const mine = post.author_id === userId;
              const author = mine
                ? 'Você'
                : post.author
                  ? post.author.display_name || `@${post.author.username}`
                  : 'Autor indisponível';
              return (
                <li key={post.id} className="card">
                  <article className="post">
                    <header className="post__meta muted">
                      <span>{author}</span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={post.created_at}>{dateFmt.format(new Date(post.created_at))}</time>
                      {mine && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{VIS_LABEL[post.visibility]}</span>
                        </>
                      )}
                    </header>
                    {post.mission && <p className="post__mission">Missão: {post.mission.prompt}</p>}
                    <PostBodyView body={post.body} />
                  </article>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="stack" style={{ justifyItems: 'start' }}>
            <p style={{ margin: 0 }}>Ainda não há posts por aqui. Adicione amigos ou escreva o seu primeiro.</p>
            <Link href="/criar/post" className="btn btn--primary">
              Escrever um post
            </Link>
          </div>
        )}
        <p className="muted" style={{ textAlign: 'center', marginBottom: 0 }} role="status">
          Você está em dia.
        </p>
      </Window>
    </main>
  );
}
