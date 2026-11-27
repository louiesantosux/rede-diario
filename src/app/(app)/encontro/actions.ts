'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type EventState = { error: string } | undefined;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (form: FormData, key: string, max: number) => String(form.get(key) ?? '').trim().slice(0, max);
const coord = (v: FormDataEntryValue | null, limit: number) => {
  const n = Number(v);
  return v !== null && v !== '' && Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
};

export async function createEvent(_prev: EventState, form: FormData): Promise<EventState> {
  const title = str(form, 'title', 120);
  if (!title) return { error: 'Dê um nome ao encontro.' };

  // datetime-local chega sem fuso; o formulário envia o deslocamento do navegador.
  const local = str(form, 'startsAt', 30);
  const offset = str(form, 'tzOffset', 6) || '-03:00';
  const startsAt = new Date(`${local}:00${offset}`);
  if (!local || Number.isNaN(startsAt.getTime())) return { error: 'Informe data e horário válidos.' };
  if (startsAt.getTime() < Date.now() - 60 * 60 * 1000) return { error: 'A data do encontro já passou.' };

  const lat = coord(form.get('lat'), 90);
  const lng = coord(form.get('lng'), 180);
  const placeName = str(form, 'placeName', 160);
  if ((lat === null || lng === null) && !placeName) {
    return { error: 'Marque o local no mapa ou escreva o nome do lugar.' };
  }

  const invitees = Array.from(new Set(form.getAll('invitees').map(String))).filter((v) => UUID_RE.test(v));
  if (invitees.length === 0) return { error: 'Convide pelo menos um amigo.' };
  if (invitees.length > 50) return { error: 'Convide no máximo 50 pessoas.' };

  const supabase = await createClient();
  const { data: event, error } = await supabase
    .from('events')
    .insert({
      title,
      description: str(form, 'description', 1000),
      starts_at: startsAt.toISOString(),
      area_label: str(form, 'areaLabel', 120),
      place_name: placeName,
      lat,
      lng,
    })
    .select('id')
    .single();

  if (error || !event) {
    console.error('[createEvent]', error?.code, error?.message);
    return { error: 'Não foi possível criar o encontro. Tente novamente.' };
  }

  // A política RLS só aceita convites para amigos.
  const { error: invError } = await supabase
    .from('event_invites')
    .insert(invitees.map((invitee_id) => ({ event_id: event.id, invitee_id })));
  if (invError) {
    console.error('[createEvent/invites]', invError.code, invError.message);
    await supabase.from('events').delete().eq('id', event.id);
    return { error: 'Só é possível convidar amigos. Revise a lista e tente de novo.' };
  }

  redirect(`/encontro/${event.id}`);
}

export async function respondInvite(form: FormData) {
  const eventId = String(form.get('eventId') ?? '');
  if (!UUID_RE.test(eventId)) redirect('/amigos');
  const status = form.get('answer') === 'accept' ? 'accepted' : 'declined';
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  await supabase
    .from('event_invites')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('invitee_id', auth.user!.id);
  redirect(status === 'accepted' ? `/encontro/${eventId}` : '/amigos');
}

export async function deleteEvent(form: FormData) {
  const eventId = String(form.get('eventId') ?? '');
  if (!UUID_RE.test(eventId)) redirect('/amigos');
  const supabase = await createClient();
  await supabase.from('events').delete().eq('id', eventId);
  redirect('/amigos');
}
