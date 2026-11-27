import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getMediaViews } from '@/lib/media';
import { sanitizeDoc } from '@/lib/richtext';
import { sanitizeModules, sanitizeSpaceTheme } from '@/lib/space';
import { SpaceEditor } from './SpaceEditor';

export const metadata: Metadata = { title: 'Editar meu espaço' };

export default async function EditarEspacoPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user!.id;

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
