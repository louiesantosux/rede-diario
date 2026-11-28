import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getMediaViews } from '@/lib/media';
import { sanitizeDoc } from '@/lib/richtext';
import { sanitizeModules, sanitizeSpaceTheme } from '@/lib/space';
import Link from 'next/link';
import { Window } from '@/components/Window';
import { SiteAppearance } from '@/components/space/SiteAppearance';
import { SpaceEditor } from './SpaceEditor';
import { ContentPanel } from './ContentPanel';
import { Notice } from '@/components/Notice';
import { NOTICES, pickMessage } from '@/lib/messages';

export const metadata: Metadata = { title: 'Editar meu espaço' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const TABS = [
  { id: 'perfil', label: 'Perfil e aparência' },
  { id: 'conteudos', label: 'Conteúdos' },
  { id: 'site', label: 'Aparência do site' },
] as const;
type TabId = (typeof TABS)[number]['id'];

function EditTabs({ current }: { current: TabId }) {
  return (
    <nav className="edit-tabs" aria-label="Partes do Editar espaço">
      <Link href="/meu-espaco" className="edit-tabs__back">
        ← Ver meu espaço
      </Link>
      <ul>
        {TABS.map((t) => (
          <li key={t.id}>
            <Link href={`/meu-espaco/editar${t.id === 'perfil' ? '' : `?aba=${t.id}`}`} aria-current={t.id === current ? 'page' : undefined}>
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default async function EditarEspacoPage({ searchParams }: Props) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.aba) ? sp.aba[0] : sp.aba;
  const tab: TabId = TABS.some((t) => t.id === raw) ? (raw as TabId) : 'perfil';
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user!.id;

  if (tab === 'conteudos') {
    return (
      <main id="conteudo" className="page">
        <EditTabs current={tab} />
        <Notice ok={pickMessage(NOTICES, sp.aviso)} />
        <ContentPanel userId={userId} />
      </main>
    );
  }

  if (tab === 'site') {
    const { data: prefs } = await supabase.from('profiles').select('theme, a11y_prefs').eq('id', userId).single();
    return (
      <main id="conteudo" className="page">
        <EditTabs current={tab} />
        <Window title="Aparência do site" icon="star" headingLevel={1}>
          <SiteAppearance userId={userId} savedUi={prefs?.theme ?? null} savedA11y={prefs?.a11y_prefs ?? null} />
        </Window>
      </main>
    );
  }

  const [{ data: profile }, { data: space }] = await Promise.all([
    supabase.from('profiles').select('username, display_name, mood, bio, profile_visibility').eq('id', userId).single(),
    supabase
      .from('spaces')
      .select('theme, modules, about, avatar_media_id, bg_media_id')
      .eq('owner_id', userId)
      .maybeSingle(),
  ]);

  const avatarId = (space?.avatar_media_id as string | null) ?? null;
  const bgId = (space?.bg_media_id as string | null) ?? null;
  const media = await getMediaViews(supabase, [avatarId, bgId].filter((v): v is string => Boolean(v)));

  return (
    <main id="conteudo" className="page page--wide">
      <EditTabs current={tab} />
      <SpaceEditor
        username={profile?.username ?? ''}
        profile={{
          displayName: profile?.display_name ?? '',
          mood: profile?.mood ?? '',
          bio: profile?.bio ?? '',
          visibility: profile?.profile_visibility === 'public' ? 'public' : 'friends',
        }}
        about={sanitizeDoc(space?.about)}
        modules={sanitizeModules(space?.modules)}
        theme={sanitizeSpaceTheme(space?.theme)}
        avatar={avatarId && media[avatarId] ? { id: avatarId, url: media[avatarId].url } : null}
        bg={bgId && media[bgId] ? { id: bgId, url: media[bgId].url } : null}
      />
    </main>
  );
}
