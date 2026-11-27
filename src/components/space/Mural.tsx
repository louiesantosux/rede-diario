import Link from 'next/link';
import { approveNote, deleteNote } from '@/app/(app)/meu-espaco/actions';
import { Icon } from '@/components/Icon';

export type Note = {
  id: string;
  body: string;
  approved: boolean;
  created_at: string;
  author_username: string;
  author_display_name: string;
  is_mine: boolean;
};

const dateFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'America/Sao_Paulo' });

/** Lista de recados. O dono aprova ou recusa; o autor pode apagar o próprio recado. */
export function NotesList({ notes, isOwner, empty }: { notes: Note[]; isOwner: boolean; empty: string }) {
  if (notes.length === 0) return <p className="space-muted" style={{ margin: 0 }}>{empty}</p>;
  return (
    <ul className="notes">
      {notes.map((n) => {
        const name = n.author_display_name || `@${n.author_username}`;
        return (
          <li key={n.id} className={n.approved ? 'note' : 'note note--pending'}>
            <p className="note__meta">
              <Link href={`/u/${n.author_username}`}>{name}</Link> · <time dateTime={n.created_at}>{dateFmt.format(new Date(n.created_at))}</time>
              {!n.approved && <span className="note__tag">Aguardando aprovação</span>}
            </p>
            <p className="note__body">{n.body}</p>
            {(isOwner || n.is_mine) && (
              <div className="row note__actions">
                {isOwner && !n.approved && (
                  <form action={approveNote}>
                    <input type="hidden" name="noteId" value={n.id} />
                    <button type="submit" className="btn">
                      Aprovar
                    </button>
                  </form>
                )}
                <form action={deleteNote}>
                  <input type="hidden" name="noteId" value={n.id} />
                  <button type="submit" className="btn btn--ghost" aria-label={`${isOwner ? (n.approved ? 'Remover' : 'Recusar') : 'Apagar'} recado de ${name}`}>
                    <Icon name="trash" className="btn__icon" />
                    {isOwner ? (n.approved ? 'Remover' : 'Recusar') : 'Apagar'}
                  </button>
                </form>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
