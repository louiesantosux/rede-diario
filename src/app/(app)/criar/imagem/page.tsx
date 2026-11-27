import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { ImageStudio } from './ImageStudio';

export const metadata: Metadata = { title: 'Imagens' };

export default async function CriarImagemPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  return (
    <main id="conteudo" className="page page--wide">
      <ImageStudio userId={auth.user!.id} />
    </main>
  );
}
