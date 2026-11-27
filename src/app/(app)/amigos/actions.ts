'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id = (form: FormData, key: string) => {
  const v = String(form.get(key) ?? '');
  return UUID_RE.test(v) ? v : null;
};

export async function sendFriendRequest(form: FormData) {
  const addressee = id(form, 'profileId');
  if (!addressee) redirect('/amigos');
  const supabase = await createClient();
  const { error } = await supabase.from('friendships').insert({
    requester_id: (await supabase.auth.getUser()).data.user!.id,
    addressee_id: addressee,
  });
  if (error) {
    console.error('[sendFriendRequest]', error.code, error.message);
    redirect('/amigos?erro=pedido');
  }
  redirect('/amigos?aviso=pedido-enviado');
}

export async function respondFriendRequest(form: FormData) {
  const friendship = id(form, 'friendshipId');
  if (!friendship) redirect('/amigos');
  const supabase = await createClient();
  if (form.get('answer') === 'accept') {
    await supabase.from('friendships').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', friendship);
  } else {
    await supabase.from('friendships').delete().eq('id', friendship);
  }
  revalidatePath('/amigos');
  redirect('/amigos');
}

export async function removeFriendship(form: FormData) {
  const friendship = id(form, 'friendshipId');
  if (!friendship) redirect('/amigos');
  const supabase = await createClient();
  await supabase.from('friendships').delete().eq('id', friendship);
  revalidatePath('/amigos');
  redirect('/amigos');
}
