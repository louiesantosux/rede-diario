'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VISIBILITIES = ['private', 'friends', 'unlisted', 'public'];

export async function updateMoodboard(form: FormData) {
  const id = String(form.get('id') ?? '');
  if (!UUID_RE.test(id)) redirect('/meu-espaco');
  const visibility = String(form.get('visibility') ?? '');
  const layout = form.get('layout') === 'grade' ? 'grade' : 'mosaico';
  const supabase = await createClient();
  await supabase
    .from('moodboards')
    .update({ layout, ...(VISIBILITIES.includes(visibility) ? { visibility } : {}) })
    .eq('id', id);
  redirect(`/moodboard/${id}`);
}

export async function deleteMoodboard(form: FormData) {
  const id = String(form.get('id') ?? '');
  if (!UUID_RE.test(id)) redirect('/meu-espaco');
  const supabase = await createClient();
  await supabase.from('moodboards').delete().eq('id', id);
  redirect('/meu-espaco?aviso=moodboard-excluido');
}
