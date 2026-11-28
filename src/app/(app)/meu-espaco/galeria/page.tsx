import type { Metadata } from 'next';
import Link from 'next/link';
import { Window } from '@/components/Window';
import { Icon } from '@/components/Icon';
import { createClient } from '@/lib/supabase/server';
import { getMediaViews } from '@/lib/media';
import { GalleryManager } from './GalleryManager';

export const metadata: Metadata = { title: 'Minha galeria' };

export default async function GaleriaPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: rows } = await supabase
    .from('media')
    .select('id')
    .eq('owner_id', auth.user!.id)
    .order('created_at', { ascending: false })
    .limit(300);
  const ids = (rows ?? []).map((r) => r.id as string);
  const views = await getMediaViews(supabase, ids);
  const items = ids.flatMap((id) => (views[id] ? [{ id, url: views[id].url, alt: views[id].alt }] : []));

  return (
    <main id="conteudo" className="page page--wide">
      <Window title="Minha galeria" icon="image" headingLevel={1}>
        <div className="stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <Link href="/meu-espaco/editar?aba=conteudos">← Voltar para Conteúdos</Link>
            <Link href="/criar/imagem" className="btn">
              <Icon name="plus" className="btn__icon" />
              Enviar fotos
            </Link>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            Toque nas imagens para selecionar. Apagar remove o arquivo do servidor e tira a imagem de todo lugar onde foi
            usada.
          </p>
          <GalleryManager items={items} />
        </div>
      </Window>
    </main>
  );
}
