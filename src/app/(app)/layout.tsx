import { redirect } from 'next/navigation';
import { Taskbar } from '@/components/Taskbar';
import { PrefsSync } from '@/components/PrefsSync';
import { createClient } from '@/lib/supabase/server';
import type { A11yPrefs } from '@/lib/prefs';

// Toda rota deste grupo exige sessão válida (checagem no servidor, além do proxy).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/entrar');

  const { data: profile } = await supabase.from('profiles').select('a11y_prefs').eq('id', data.user.id).single();

  return (
    <>
      <PrefsSync saved={(profile?.a11y_prefs ?? null) as Partial<A11yPrefs> | null} />
      {children}
      <Taskbar />
    </>
  );
}
