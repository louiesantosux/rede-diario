'use server';

import { redirect } from 'next/navigation';
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

/** Apaga um post do próprio autor. As respostas vão junto; as imagens continuam na galeria. */
export async function deletePost(form: FormData) {
  const postId = String(form.get('postId') ?? '');
  if (!UUID_RE.test(postId)) redirect('/inicio');
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from('posts').delete().eq('id', postId).eq('author_id', auth.user?.id ?? '');
  if (error) {
    console.error('[deletePost]', error.code, error.message);
    redirect(`/post/${postId}?erro=excluir`);
  }
  redirect('/inicio?aviso=post-excluido');
}
