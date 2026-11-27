import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Window } from '@/components/Window';
import { EventMap } from '@/components/EventMap';
import { createClient } from '@/lib/supabase/server';
import { deleteEvent, respondInvite } from '../actions';

export const metadata: Metadata = { title: 'Encontro' };

type Props = { params: Promise<{ id: string }> };

type EventRow = {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  area_label: string;
  place_name: string;
  lat: number | null;
  lng: number | null;
  approx_lat: number | null;
  approx_lng: number | null;
  is_creator: boolean;
  my_status: 'pending' | 'accepted' | 'declined' | null;
  exact_visible: boolean;
  creator_username: string;
  creator_display_name: string;
};

const dateFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
const STATUS: Record<string, string> = { pending: 'Aguardando', accepted: 'Vai', declined: 'Não vai' };

export default async function EncontroPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc('my_events');
  const event = ((data ?? []) as EventRow[]).find((e) => e.id === id);
  if (!event) notFound();

  const { data: people } = await supabase.rpc('event_attendees', { eid: id });
  const attendees = (people ?? []) as { invitee_id: string; username: string; display_name: string; status: string }[];

  const exact = event.exact_visible && event.lat !== null && event.lng !== null ? { lat: event.lat, lng: event.lng } : null;
  const approx = event.approx_lat !== null && event.approx_lng !== null ? { lat: event.approx_lat, lng: event.approx_lng } : null;
  const organizer = event.is_creator ? 'Você' : event.creator_display_name || `@${event.creator_username}`;

  return (
    <main id="conteudo" className="page page--wide">
      <Window title={event.title} icon="pin" headingLevel={1}>
        <div className="stack">
          <Link href="/amigos">← Voltar para Amigos</Link>
          <dl className="event-facts">
            <div>
              <dt>Quando</dt>
              <dd>{dateFmt.format(new Date(event.starts_at))}</dd>
            </div>
            <div>
              <dt>Organização</dt>
              <dd>{organizer}</dd>
            </div>
            {event.area_label && (
              <div>
                <dt>Região</dt>
                <dd>{event.area_label}</dd>
              </div>
            )}
            <div>
              <dt>Lugar exato</dt>
              <dd>
                {event.exact_visible
                  ? event.place_name || 'Marcado no mapa'
                  : 'Aparece quando você aceitar o convite.'}
              </dd>
            </div>
          </dl>
          {event.description && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{event.description}</p>}

          {(exact || approx) && (
            <EventMap
              mode="view"
              exact={exact}
              approx={approx}
              label={exact ? 'Mapa com o local do encontro' : 'Mapa com a região aproximada do encontro'}
            />
          )}

          {!event.is_creator && event.my_status !== 'accepted' && (
            <form action={respondInvite} className="row">
              <input type="hidden" name="eventId" value={event.id} />
              <button type="submit" name="answer" value="accept" className="btn btn--primary">
                Aceitar convite
              </button>
              <button type="submit" name="answer" value="decline" className="btn btn--ghost">
                Não vou
              </button>
            </form>
          )}
          {!event.is_creator && event.my_status === 'accepted' && (
            <form action={respondInvite} className="row">
              <input type="hidden" name="eventId" value={event.id} />
              <span className="notice notice--ok">Você confirmou presença.</span>
              <button type="submit" name="answer" value="decline" className="btn btn--ghost">
                Desistir
              </button>
            </form>
          )}

          <aside className="safety" aria-label="Dicas de segurança">
            <p className="safety__title">Lembrete</p>
            <ul>
              <li>Avise alguém de confiança sobre o encontro.</li>
              <li>Se algo parecer errado, você pode desistir a qualquer momento, sem aviso ao grupo.</li>
            </ul>
          </aside>
        </div>
      </Window>

      {attendees.length > 0 && (
        <Window title={event.is_creator ? 'Convidados' : 'Quem vai'} icon="friends">
          <ul className="person-list">
            {attendees.map((a) => (
              <li key={a.invitee_id} className="person">
                <span>
                  <strong>{a.display_name || `@${a.username}`}</strong> <span className="muted">@{a.username}</span>
                </span>
                {event.is_creator && <span className="muted">{STATUS[a.status]}</span>}
              </li>
            ))}
          </ul>
        </Window>
      )}

      {event.is_creator && (
        <Window title="Cancelar encontro" icon="window">
          <form action={deleteEvent} className="row" style={{ justifyContent: 'space-between' }}>
            <input type="hidden" name="eventId" value={event.id} />
            <p style={{ margin: 0 }}>O encontro e os convites serão apagados, inclusive o local.</p>
            <button type="submit" className="btn btn--danger">
              Cancelar encontro
            </button>
          </form>
        </Window>
      )}
    </main>
  );
}
