'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MAX_TEXT, docText, sanitizeDoc, type PostBody } from '@/lib/richtext';

export type ComposeState = { error: string } | undefined;

const VISIBILITIES = ['private', 'friends', 'unlisted', 'public'] as const;
const REPLY_POLICIES = ['friends', 'everyone', 'nobody'] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pick<T extends string>(value: FormDataEntryValue | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export async function createPost(_prev: ComposeState, form: FormData): Promise<ComposeState> {
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get('body') ?? ''));
  } catch {
    return { error: 'Não foi possível ler o texto. Tente novamente.' };
  }

  const doc = sanitizeDoc(raw);
  if (!doc) return { error: 'Não foi possível ler o texto. Tente novamente.' };

  const text = docText(doc);
  if (!text) return { error: 'Escreva algo antes de publicar.' };
  if (text.length > MAX_TEXT) {
    return { error: `O texto passou do limite de ${MAX_TEXT.toLocaleString('pt-BR')} caracteres. Divida em mais de um post.` };
  }

  const visibility = pick(form.get('visibility'), VISIBILITIES, 'friends');
  const replyPolicy = visibility === 'private' ? 'nobody' : pick(form.get('replyPolicy'), REPLY_POLICIES, 'friends');
  const missionRaw = String(form.get('missionId') ?? '');
  const missionId = UUID_RE.test(missionRaw) ? missionRaw : null;

  const body: PostBody = { v: 1, doc, text };
  const supabase = await createClient();
  const { error } = await supabase.from('posts').insert({
    body,
    visibility,
    reply_policy: replyPolicy,
    mission_id: missionId,
  });

  if (error) {
    console.error('[createPost]', error.code, error.message);
    return { error: 'Não foi possível publicar agora. Seu rascunho continua salvo.' };
  }

  redirect(visibility === 'private' ? '/inicio?aviso=post-privado' : '/inicio?aviso=post-publicado');
}
