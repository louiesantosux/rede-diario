import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { sanitizeTheme } from '@/lib/wikiTheme';
import { WikiSettings } from './WikiSettings';

export const metadata: Metadata = { title: 'Aparência da wiki' };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AjustesWikiPage({ params, searchParams }: Props) {
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
  if (wiki.owner_id !== auth.user?.id) redirect(`/wiki/${id}`);

  return (
    <main id="conteudo" className="page page--wide">
      <WikiSettings
        wiki={{
          id: wiki.id,
          title: wiki.title,
          description: wiki.description,
          visibility: wiki.visibility,
          theme: sanitizeTheme(wiki.theme),
        }}
        confirmError={(Array.isArray(sp.erro) ? sp.erro[0] : sp.erro) === 'confirmacao'}
      />
    </main>
  );
}
