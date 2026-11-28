'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { PostBody, RTDoc } from '@/lib/richtext';

export type FinalizeState = { error: string } | undefined;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VISIBILITIES = ['private', 'friends', 'unlisted', 'public'] as const;
const REPLY = ['friends', 'everyone', 'nobody'] as const;

const pick = <T extends string>(v: FormDataEntryValue | null, list: readonly T[], fallback: T): T =>
  list.includes(v as T) ? (v as T) : fallback;

function captionDoc(caption: string): RTDoc {
  const paragraphs = caption
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    type: 'doc',
    content: paragraphs.map((p) => ({
      type: 'paragraph' as const,
      content: p.split('\n').flatMap((line, i) => [
        ...(i > 0 ? [{ type: 'hardBreak' as const }] : []),
        ...(line ? [{ type: 'text' as const, text: line }] : []),
      ]),
    })),
  };
}

export async function finalizeImages(_prev: FinalizeState, form: FormData): Promise<FinalizeState> {
  let ids: string[] = [];
  try {
    const parsed = JSON.parse(String(form.get('mediaIds') ?? '[]'));
    if (Array.isArray(parsed)) ids = parsed.filter((v): v is string => typeof v === 'string' && UUID_RE.test(v));
  } catch {
    /* lista vazia */
  }
  if (ids.length === 0) return { error: 'Nenhuma imagem foi enviada.' };

  const destination = String(form.get('destination') ?? 'galeria');
  const visibility = pick(form.get('visibility'), VISIBILITIES, 'friends');
  const supabase = await createClient();

  if (destination === 'post') {
    if (ids.length > 20) return { error: 'Um post pode ter no máximo 20 imagens.' };
    const caption = String(form.get('caption') ?? '').trim().slice(0, 5000);
    const body: PostBody = { v: 1, doc: captionDoc(caption), text: caption };
    const { error } = await supabase.from('posts').insert({
      body,
      media_ids: ids,
      visibility,
      reply_policy: visibility === 'private' ? 'nobody' : pick(form.get('replyPolicy'), REPLY, 'friends'),
    });
    if (error) {
      console.error('[finalizeImages/post]', error.code, error.message);
      return { error: 'As imagens foram salvas, mas o post não foi publicado. Tente de novo.' };
    }
    redirect(visibility === 'private' ? '/inicio?aviso=post-privado' : '/inicio?aviso=post-publicado');
  }

  if (destination === 'moodboard') {
    const title = String(form.get('title') ?? '').trim().slice(0, 120);
    if (!title) return { error: 'Dê um título ao moodboard.' };
    const { data, error } = await supabase
      .from('moodboards')
      .insert({
        title,
        description: String(form.get('description') ?? '').trim().slice(0, 300),
        layout: form.get('layout') === 'grade' ? 'grade' : 'mosaico',
        media_ids: ids.slice(0, 60),
        visibility,
      })
      .select('id')
      .single();
    if (error || !data) {
      console.error('[finalizeImages/moodboard]', error?.code, error?.message);
      return { error: 'As imagens foram salvas, mas o moodboard não foi criado. Tente de novo.' };
    }
    redirect(`/moodboard/${data.id}`);
  }

  redirect('/meu-espaco/editar?aba=conteudos&aviso=imagens-salvas');
}
