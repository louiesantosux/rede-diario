'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { docMediaIds, docText, MAX_INLINE_IMAGES, sanitizeDoc } from '@/lib/richtext';
import { parseYouTubeId } from '@/lib/youtube';
import {
  BG_FITS,
  clampOpacity,
  BIO_MAX,
  MOOD_MAX,
  NAME_MAX,
  NOTE_MAX,
  sanitizeModules,
  sanitizeSpaceTheme,
  type SpaceTheme,
} from '@/lib/space';

export type FormState = { error?: string; ok?: string; username?: string } | undefined;

const USERNAME_RE = /^[a-z0-9_.]{3,24}$/;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (form: FormData, key: string, max: number) => String(form.get(key) ?? '').trim().slice(0, max);
const uuidOrNull = (form: FormData, key: string) => {
  const v = String(form.get(key) ?? '');
  return UUID_RE.test(v) ? v : null;
};
const json = (form: FormData, key: string): unknown => {
  try {
    return JSON.parse(String(form.get(key) ?? 'null'));
  } catch {
    return null;
  }
};

async function videoTitle(videoId: string): Promise<{ title: string } | { error: string }> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`,
      { signal: AbortSignal.timeout(5000), cache: 'no-store' },
    );
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      return { error: 'A música de fundo é um vídeo privado, removido ou que não permite ser incorporado.' };
    }
    if (res.ok) {
      const title = ((await res.json()) as { title?: string }).title?.slice(0, 200);
      if (title) return { title };
    }
  } catch {
    /* usa o título padrão */
  }
  return { title: 'Música de fundo' };
}

export async function saveSpace(_prev: FormState, form: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { error: 'Sua sessão expirou. Entre de novo.' };

  // Perfil (o @ é único; a checagem final é do índice do banco)
  const username = str(form, 'username', 40).replace(/^@/, '').toLowerCase();
  if (!USERNAME_RE.test(username)) {
    return { error: 'O @ precisa ter de 3 a 24 caracteres: letras minúsculas sem acento, números, ponto ou sublinhado.' };
  }
  const visibility = form.get('profileVisibility') === 'public' ? 'public' : 'friends';
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      username,
      display_name: str(form, 'displayName', NAME_MAX),
      mood: str(form, 'mood', MOOD_MAX),
      bio: str(form, 'bio', BIO_MAX),
      profile_visibility: visibility,
    })
    .eq('id', userId);
  if (profileError) {
    console.error('[saveSpace/profile]', profileError.code, profileError.message);
    if (profileError.code === '23505') return { error: `O @${username} já está em uso. Escolha outro.` };
    return { error: 'Não foi possível salvar o perfil. Tente novamente.' };
  }

  // Sobre mim
  const about = sanitizeDoc(json(form, 'about'));
  if (about && docText(about).length > 20000) return { error: 'O “Sobre mim” passou do limite de 20 mil caracteres.' };
  const aboutMedia = about ? docMediaIds(about) : [];
  if (aboutMedia.length > MAX_INLINE_IMAGES) {
    return { error: `O “Sobre mim” pode ter no máximo ${MAX_INLINE_IMAGES} imagens.` };
  }

  // Aparência e música
  const { data: current } = await supabase.from('spaces').select('theme').eq('owner_id', userId).maybeSingle();
  const previous = sanitizeSpaceTheme(current?.theme);
  const theme: SpaceTheme = { ...sanitizeSpaceTheme(json(form, 'theme')), bgMusic: previous.bgMusic };

  const musicInput = str(form, 'bgMusic', 500);
  if (!musicInput) {
    theme.bgMusic = null;
  } else {
    const videoId = parseYouTubeId(musicInput);
    if (!videoId) return { error: 'O link da música de fundo não é um link válido do YouTube.' };
    if (previous.bgMusic?.youtubeId !== videoId) {
      const t = await videoTitle(videoId);
      if ('error' in t) return { error: t.error };
      theme.bgMusic = { youtubeId: videoId, title: t.title };
    }
  }

  const { error } = await supabase.from('spaces').upsert({
    owner_id: userId,
    theme,
    modules: sanitizeModules(json(form, 'modules')),
    about,
    about_media_ids: aboutMedia,
    avatar_media_id: uuidOrNull(form, 'avatar'),
    bg_media_id: uuidOrNull(form, 'bg'),
  });
  if (error) {
    console.error('[saveSpace]', error.code, error.message);
    return {
      error: error.message.includes('Imagem')
        ? 'Uma das imagens escolhidas não está mais na sua galeria.'
        : 'Não foi possível salvar o espaço. Tente novamente.',
    };
  }

  revalidatePath('/meu-espaco');
  revalidatePath('/u/[username]', 'page');
  // Volta para Meu espaço (visualização), já mostrando o resultado.
  redirect('/meu-espaco?aviso=espaco-salvo');
}

/* ------------------------------------------------------------------ */
/* Foto e fundo: salvos assim que escolhidos                           */
/* ------------------------------------------------------------------ */

export type SpaceMediaInput = {
  avatar?: string | null;
  bg?: string | null;
  bgFit?: string;
  bgOpacity?: number;
  /** Fundo pronto do site (id) ou null para nenhum. */
  backdrop?: string | null;
};

export async function saveSpaceMedia(input: SpaceMediaInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };

  const idOrNull = (v: unknown) => (typeof v === 'string' && UUID_RE.test(v) ? v : null);
  const patch: Record<string, unknown> = {};
  if ('avatar' in input) patch.avatar_media_id = idOrNull(input.avatar);
  if ('bg' in input) patch.bg_media_id = idOrNull(input.bg);

  if ('bgFit' in input || 'bgOpacity' in input || 'backdrop' in input) {
    const { data: current } = await supabase.from('spaces').select('theme').eq('owner_id', userId).maybeSingle();
    const theme = sanitizeSpaceTheme(current?.theme);
    if ('bgFit' in input && (BG_FITS as readonly string[]).includes(String(input.bgFit))) {
      theme.bgFit = input.bgFit as SpaceTheme['bgFit'];
    }
    if ('bgOpacity' in input) theme.bgOpacity = clampOpacity(input.bgOpacity);
    if ('backdrop' in input) theme.backdrop = sanitizeSpaceTheme({ backdrop: input.backdrop }).backdrop;
    patch.theme = theme;
  }
  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await supabase.from('spaces').update(patch).eq('owner_id', userId);
  if (error) {
    console.error('[saveSpaceMedia]', error.code, error.message);
    return { ok: false, error: 'Não foi possível salvar a imagem. Tente de novo.' };
  }
  revalidatePath('/meu-espaco');
  revalidatePath('/u/[username]', 'page');
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Mural de recados                                                    */
/* ------------------------------------------------------------------ */

export async function sendNote(_prev: FormState, form: FormData): Promise<FormState> {
  const ownerId = uuidOrNull(form, 'ownerId');
  const body = str(form, 'body', NOTE_MAX + 1);
  if (!ownerId) return { error: 'Espaço inválido.' };
  if (!body) return { error: 'Escreva o recado antes de enviar.' };
  if (body.length > NOTE_MAX) return { error: `O recado pode ter até ${NOTE_MAX} caracteres.` };

  const supabase = await createClient();
  const { error } = await supabase.from('space_notes').insert({ owner_id: ownerId, body });
  if (error) {
    console.error('[sendNote]', error.code, error.message);
    if (error.message.includes('Limite')) {
      return { error: 'Você já tem 3 recados aguardando aprovação aqui. Espere a resposta antes de enviar outro.' };
    }
    return { error: 'Não foi possível enviar. O mural pode estar fechado ou só aberto a amigos.' };
  }
  revalidatePath('/u/[username]', 'page');
  return { ok: 'Recado enviado. Ele aparece no mural depois que for aprovado.' };
}

export async function approveNote(form: FormData) {
  const id = uuidOrNull(form, 'noteId');
  if (!id) return;
  const supabase = await createClient();
  const { error } = await supabase.from('space_notes').update({ approved: true }).eq('id', id);
  if (error) console.error('[approveNote]', error.code, error.message);
  revalidatePath('/meu-espaco');
  revalidatePath('/u/[username]', 'page');
}

/** Dono recusa/remove, ou autor apaga o próprio recado. */
export async function deleteNote(form: FormData) {
  const id = uuidOrNull(form, 'noteId');
  if (!id) return;
  const supabase = await createClient();
  const { error } = await supabase.from('space_notes').delete().eq('id', id);
  if (error) console.error('[deleteNote]', error.code, error.message);
  revalidatePath('/meu-espaco');
  revalidatePath('/u/[username]', 'page');
}
