import type { Metadata } from 'next';
import Link from 'next/link';
import { Window } from '@/components/Window';
import { Icon } from '@/components/Icon';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Meu espaço' };

export default async function MeuEspacoPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, mood')
    .eq('id', auth.user!.id)
    .single();

  return (
    <main id="conteudo" className="page">
      <Window title="Meu espaço" icon="user" headingLevel={1}>
        <div className="profile-head">
          <div>
            <p className="profile-head__name">{profile?.display_name || `@${profile?.username ?? ''}`}</p>
            <p className="muted" style={{ margin: 0 }}>
              @{profile?.username}
              {profile?.mood ? ` · ${profile.mood}` : ''}
            </p>
          </div>
          <Link href="/configuracoes" className="btn">
            <Icon name="gear" className="btn__icon" />
            Ajustes
          </Link>
        </div>
      </Window>

      <Window title="Em construção" icon="star">
        <p style={{ marginTop: 0 }}>
          Chega na <strong>Etapa 2</strong>:
        </p>
        <ul style={{ marginBottom: 0 }}>
          <li>Perfil customizável</li>
          <li>Wikis e páginas com editor de blocos</li>
          <li>Coleções (tenho, quero, já tive)</li>
        </ul>
      </Window>
    </main>
  );
}
