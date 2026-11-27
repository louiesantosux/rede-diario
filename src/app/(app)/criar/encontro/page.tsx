import type { Metadata } from 'next';
import Link from 'next/link';
import { Window } from '@/components/Window';
import { createClient } from '@/lib/supabase/server';
import { EventForm } from './EventForm';

export const metadata: Metadata = { title: 'Marcar encontro' };

type Friend = { other_id: string; username: string; display_name: string; status: string };

export default async function CriarEncontroPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc('my_friendships');
  const friends = ((data ?? []) as Friend[])
    .filter((f) => f.status === 'accepted')
    .map((f) => ({ id: f.other_id, name: f.display_name || `@${f.username}`, username: f.username }));

  return (
    <main id="conteudo" className="page page--wide">
      <Window title="Marcar encontro" icon="pin" headingLevel={1}>
        <div className="stack">
          <Link href="/criar">← Voltar para Criar</Link>
          {friends.length === 0 ? (
            <p style={{ margin: 0 }}>
              Encontros são só entre amigos. <Link href="/amigos">Adicione um amigo</Link> para marcar o primeiro.
            </p>
          ) : (
            <EventForm friends={friends} />
          )}
        </div>
      </Window>
    </main>
  );
}
