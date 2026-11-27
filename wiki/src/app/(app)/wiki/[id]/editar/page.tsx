import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { sanitizeBlocks } from '@/lib/blocks';
import { PageEditor } from './PageEditor';

export const metadata: Metadata = { title: 'Editar página' };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EditarPaginaPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: wiki } = await supabase.from('wikis').select('id, owner_id, title').eq('id', id).maybeSingle();
  if (!wiki) notFound();
  if (wiki.owner_id !== auth.user?.id) redirect(`/wiki/${id}`);

  const { data: pages } = await supabase
    .from('pages')
    .select('id, title, blocks, visibility')
    .eq('wiki_id', id)
    .order('position', { ascending: true });

  const wanted = Array.isArray(sp.p) ? sp.p[0] : sp.p;
  const page = (pages ?? []).find((p) => p.id === wanted) ?? pages?.[0];
  if (!page) redirect(`/wiki/${id}`);

  const erro = Array.isArray(sp.erro) ? sp.erro[0] : sp.erro;

  return (
    <main id="conteudo" className="page page--wide">
      <PageEditor
        key={page.id}
        wikiId={wiki.id}
        wikiTitle={wiki.title}
        page={{
          id: page.id,
          title: page.title,
          visibility: page.visibility,
          blocks: sanitizeBlocks(page.blocks),
        }}
        canDelete={(pages ?? []).length > 1}
        lastPageError={erro === 'ultima'}
      />
    </main>
  );
}
