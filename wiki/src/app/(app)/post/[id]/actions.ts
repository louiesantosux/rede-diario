'use server';

import { createClient } from '@/lib/supabase/server';

export type ReplyState = { error?: string; ok?: boolean } | undefined;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function sendReply(_prev: ReplyState, form: FormData): Promise<ReplyState> {
  const postId = String(form.get('postId') ?? '');
  const body = String(form.get('body') ?? '').trim().slice(0, 4000);
  if (!UUID_RE.test(postId)) return { error: 'Post inválido.' };
  if (!body) return { error: 'Escreva uma resposta.' };

  const supabase = await createClient();
  // A política RLS confere se o post aceita respostas desta pessoa.
  const { error } = await supabase.from('post_replies').insert({ post_id: postId, body });
  if (error) {
    console.error('[sendReply]', error.code, error.message);
    return { error: 'Não foi possível enviar. O autor pode ter restringido as respostas.' };
  }
  return { ok: true };
}
