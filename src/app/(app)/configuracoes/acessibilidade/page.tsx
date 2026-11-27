import type { Metadata } from 'next';
import { Window } from '@/components/Window';
import { createClient } from '@/lib/supabase/server';
import { A11yPanel } from './A11yPanel';

export const metadata: Metadata = { title: 'Acessibilidade' };

export default async function AcessibilidadePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('a11y_prefs')
    .eq('id', auth.user!.id)
    .single();

  return (
    <main id="conteudo" className="page">
      <Window title="Acessibilidade" icon="eye" headingLevel={1}>
        <A11yPanel userId={auth.user!.id} saved={(profile?.a11y_prefs ?? {}) as Record<string, unknown>} />
      </Window>
    </main>
  );
}
