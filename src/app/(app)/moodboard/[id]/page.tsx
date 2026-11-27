import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Window } from '@/components/Window';
import { MediaGallery } from '@/components/MediaGallery';
import { createClient } from '@/lib/supabase/server';
import { getMediaViews, orderedViews } from '@/lib/media';
import { deleteMoodboard, updateMoodboard } from '../actions';

export const metadata: Metadata = { title: 'Moodboard' };

type Props = { params: Promise<{ id: string }> };

export default async function MoodboardPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: board } = await supabase
    .from('moodboards')
    .select('id, owner_id, title, description, layout, media_ids, visibility')
    .eq('id', id)
    .maybeSingle();
  if (!board) notFound();

  const ids = (board.media_ids ?? []) as string[];
  const items = orderedViews(ids, await getMediaViews(supabase, ids));
  const isOwner = board.owner_id === auth.user?.id;

  return (
    <main id="conteudo" className="page page--wide">
      <Window title={board.title} icon="image" headingLevel={1}>
        <div className="stack">
          {board.description && <p style={{ margin: 0 }}>{board.description}</p>}
          {items.length > 0 ? (
            <MediaGallery items={items} layout={board.layout === 'grade' ? 'grade' : 'mosaico'} label={board.title} />
          ) : (
            <p className="muted">Nenhuma imagem disponível.</p>
          )}
        </div>
      </Window>

      {isOwner && (
        <Window title="Ajustes do moodboard" icon="gear">
          <div className="stack">
            <form action={updateMoodboard} className="row" style={{ alignItems: 'flex-end' }}>
              <input type="hidden" name="id" value={board.id} />
              <div className="field" style={{ flex: '0 1 200px' }}>
                <label htmlFor="layout">Layout</label>
                <select id="layout" name="layout" defaultValue={board.layout}>
                  <option value="mosaico">Mosaico</option>
                  <option value="grade">Grade</option>
                </select>
              </div>
              <div className="field" style={{ flex: '0 1 220px' }}>
                <label htmlFor="visibility">Quem pode ver</label>
                <select id="visibility" name="visibility" defaultValue={board.visibility}>
                  <option value="private">Só eu</option>
                  <option value="friends">Amigos</option>
                  <option value="unlisted">Quem tiver o link</option>
                  <option value="public">Público</option>
                </select>
              </div>
              <button type="submit" className="btn">
                Salvar
              </button>
            </form>
            <form action={deleteMoodboard}>
              <input type="hidden" name="id" value={board.id} />
              <button type="submit" className="btn btn--danger">
                Excluir moodboard
              </button>
              <span className="muted" style={{ marginLeft: 8, fontSize: '0.875rem' }}>
                As fotos continuam na sua galeria.
              </span>
            </form>
          </div>
        </Window>
      )}
    </main>
  );
}
