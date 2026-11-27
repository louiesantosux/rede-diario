import type { Metadata } from 'next';
import Link from 'next/link';
import { Window } from '@/components/Window';
import { createClient } from '@/lib/supabase/server';
import { Composer } from './Composer';

export const metadata: Metadata = { title: 'Compor post' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ComporPostPage({ searchParams }: Props) {
  const sp = await searchParams;
  const missao = Array.isArray(sp.missao) ? sp.missao[0] : sp.missao;

  let mission: { id: string; prompt: string } | null = null;
  if (missao && UUID_RE.test(missao)) {
    const supabase = await createClient();
    const { data } = await supabase.from('missions').select('id, prompt').eq('id', missao).maybeSingle();
    mission = data;
  }

  return (
    <main id="conteudo" className="page">
      <Window title={mission ? 'Responder à missão' : 'Compor post'} icon="pen" headingLevel={1}>
        <div className="stack">
          <Link href="/criar">← Voltar para Criar</Link>
          <Composer missionId={mission?.id ?? null} missionPrompt={mission?.prompt ?? null} />
        </div>
      </Window>
    </main>
  );
}
