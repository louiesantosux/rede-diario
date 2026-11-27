import type { Metadata } from 'next';
import Link from 'next/link';
import { Window } from '@/components/Window';
import { Icon } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { createClient } from '@/lib/supabase/server';
import { removeFriendship, respondFriendRequest, sendFriendRequest } from './actions';

export const metadata: Metadata = { title: 'Amigos' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

type Friendship = {
  friendship_id: string;
  status: 'pending' | 'accepted';
  incoming: boolean;
  other_id: string;
  username: string;
  display_name: string;
};

type EventRow = {
  id: string;
  title: string;
  starts_at: string;
  area_label: string;
  is_creator: boolean;
  my_status: string | null;
  creator_display_name: string;
  creator_username: string;
};

const NOTICES: Record<string, string> = { 'pedido-enviado': 'Pedido de amizade enviado.' };
const ERRORS: Record<string, string> = {
  pedido: 'Não foi possível enviar o pedido. Talvez ele já exista ou a pessoa não aceite pedidos.',
};
const dateFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
const name = (f: { display_name: string; username: string }) => f.display_name || `@${f.username}`;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AmigosPage({ searchParams }: Props) {
  const sp = await searchParams;
  const busca = (first(sp.busca) ?? '').trim().replace(/^@/, '').toLowerCase();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const [{ data: rel }, { data: evs }, search] = await Promise.all([
    supabase.rpc('my_friendships'),
    supabase.rpc('my_events'),
    busca ? supabase.rpc('find_profile', { handle: busca }) : Promise.resolve({ data: null }),
  ]);
  const all = (rel ?? []) as Friendship[];
  const friends = all.filter((f) => f.status === 'accepted');
  const incoming = all.filter((f) => f.status === 'pending' && f.incoming);
  const outgoing = all.filter((f) => f.status === 'pending' && !f.incoming);
  const events = ((evs ?? []) as EventRow[]).filter((e) => e.my_status !== 'declined');
  const found = ((search.data ?? []) as { id: string; username: string; display_name: string }[])[0];
  const foundRelation = found ? all.find((f) => f.other_id === found.id) : undefined;

  return (
    <main id="conteudo" className="page">
      <h1 className="sr-only">Amigos</h1>
      <Notice ok={NOTICES[first(sp.aviso) ?? '']} error={ERRORS[first(sp.erro) ?? '']} />

      <Window title="Encontros" icon="pin">
        {events.length === 0 ? (
          <p style={{ marginTop: 0 }}>Nenhum encontro marcado.</p>
        ) : (
          <ul className="wiki-cards">
            {events.map((e) => (
              <li key={e.id}>
                <Link href={`/encontro/${e.id}`} className="wiki-card">
                  <span className="wiki-card__cover event-date" aria-hidden="true">
                    <Icon name="pin" />
                  </span>
                  <span className="wiki-card__text">
                    <span className="wiki-card__title">{e.title}</span>
                    <span className="wiki-card__hint">
                      {dateFmt.format(new Date(e.starts_at))}
                      {e.area_label ? ` · ${e.area_label}` : ''} ·{' '}
                      {e.is_creator
                        ? 'Você organizou'
                        : e.my_status === 'accepted'
                          ? 'Você vai'
                          : `Convite de ${e.creator_display_name || `@${e.creator_username}`}`}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div style={{ marginTop: 16 }}>
          <Link href="/criar/encontro" className="btn">
            <Icon name="plus" className="btn__icon" />
            Marcar encontro
          </Link>
        </div>
      </Window>

      {incoming.length > 0 && (
        <Window title="Pedidos recebidos" icon="friends">
          <ul className="person-list">
            {incoming.map((f) => (
              <li key={f.friendship_id} className="person">
                <span>
                  <strong>{name(f)}</strong> <span className="muted">@{f.username}</span>
                </span>
                <form action={respondFriendRequest} className="row">
                  <input type="hidden" name="friendshipId" value={f.friendship_id} />
                  <button type="submit" name="answer" value="accept" className="btn btn--primary">
                    Aceitar
                  </button>
                  <button type="submit" name="answer" value="decline" className="btn btn--ghost">
                    Recusar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Window>
      )}

      <Window title="Amigos" icon="friends">
        {friends.length === 0 ? (
          <p style={{ marginTop: 0 }}>Você ainda não adicionou ninguém.</p>
        ) : (
          <ul className="person-list">
            {friends.map((f) => (
              <li key={f.friendship_id} className="person">
                <span>
                  <Link href={`/u/${f.username}`}><strong>{name(f)}</strong></Link> <span className="muted">@{f.username}</span>
                </span>
                <form action={removeFriendship}>
                  <input type="hidden" name="friendshipId" value={f.friendship_id} />
                  <button type="submit" className="btn btn--ghost">
                    Desfazer amizade
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <p className="muted" style={{ marginBottom: 0, fontSize: '0.875rem' }}>
          Sua lista de amigos só aparece no seu espaço se o módulo Amigos estiver ligado, sempre em ordem alfabética. Desfazer uma amizade não envia aviso.
        </p>
      </Window>

      <Window title="Adicionar amigo" icon="plus">
        <div className="stack">
          <form className="row" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: '1 1 240px' }}>
              <label htmlFor="busca">@usuário exato</label>
              <input id="busca" name="busca" type="text" defaultValue={busca} autoComplete="off" />
            </div>
            <button type="submit" className="btn">
              Buscar
            </button>
          </form>
          {busca && !found && <p style={{ margin: 0 }}>Ninguém encontrado com esse @, ou a pessoa não aceita pedidos.</p>}
          {found && (
            <div className="person card">
              <span>
                <strong>{name(found)}</strong> <span className="muted">@{found.username}</span>
              </span>
              {found.id === auth.user?.id ? (
                <span className="muted">É você</span>
              ) : foundRelation ? (
                <span className="muted">{foundRelation.status === 'accepted' ? 'Já são amigos' : 'Pedido pendente'}</span>
              ) : (
                <form action={sendFriendRequest}>
                  <input type="hidden" name="profileId" value={found.id} />
                  <button type="submit" className="btn btn--primary">
                    Enviar pedido
                  </button>
                </form>
              )}
            </div>
          )}
          {outgoing.length > 0 && (
            <p className="muted" style={{ margin: 0 }}>
              Pedidos enviados aguardando resposta: {outgoing.map((f) => `@${f.username}`).join(', ')}.
            </p>
          )}
        </div>
      </Window>
    </main>
  );
}
