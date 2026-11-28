import type { Metadata } from 'next';
import { Notice } from '@/components/Notice';
import { SpaceView } from '@/components/space/SpaceView';
import { createClient } from '@/lib/supabase/server';
import { NOTICES, pickMessage } from '@/lib/messages';

export const metadata: Metadata = { title: 'Meu espaço' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Meu espaço abre o perfil em modo de visualização. Editar fica em "Editar espaço" e "Ajustes". */
export default async function MeuEspacoPage({ searchParams }: Props) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('username').eq('id', auth.user!.id).single();
  const message = pickMessage(NOTICES, sp.aviso);

  return <SpaceView username={profile?.username ?? ''} notice={message ? <Notice ok={message} /> : undefined} />;
}
