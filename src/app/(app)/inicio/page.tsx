import type { Metadata } from 'next';
import { Window } from '@/components/Window';
import { Notice } from '@/components/Notice';
import { createClient } from '@/lib/supabase/server';
import { NOTICES, pickMessage } from '@/lib/messages';
import { MissionCard } from './MissionCard';

export const metadata: Metadata = { title: 'Início' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

type FeedPost = {
  id: string;
  body: { text?: string } | null;
  created_at: string;
  author: { username: string; display_name: string } | null;
};

const PAGE_SIZE = 20;
const dateFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });

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
      .select('id, body, created_at, author:profiles!posts_author_id_fkey(username, display_name)')
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
            {posts.map((post) => (
              <li key={post.id} className="card">
                <article>
                  <p className="muted" style={{ margin: 0, fontSize: '0.875rem' }}>
                    {post.author ? post.author.display_name || `@${post.author.username}` : 'Autor indisponível'} ·{' '}
                    <time dateTime={post.created_at}>{dateFmt.format(new Date(post.created_at))}</time>
                  </p>
                  <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{post.body?.text}</p>
                </article>
              </li>
            ))}
          </ol>
        ) : (
          <p>Ainda não há posts por aqui. Adicione amigos ou escreva o seu primeiro.</p>
        )}
        <p className="muted" style={{ textAlign: 'center', marginBottom: 0 }} role="status">
          Você está em dia.
        </p>
      </Window>
    </main>
  );
}
