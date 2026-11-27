'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { deleteWiki } from '@/app/(app)/wiki/actions';

export type WikiCard = { id: string; title: string; hint: string; bg: string; surface: string; accent: string };

/** Lista de wikis do dono, com botão de excluir no canto direito de cada uma. */
export function WikiCardList({ wikis }: { wikis: WikiCard[] }) {
  const [toDelete, setToDelete] = useState<WikiCard | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (toDelete && !d.open) d.showModal();
    if (!toDelete && d.open) d.close();
  }, [toDelete]);

  return (
    <>
      <ul className="wiki-cards">
        {wikis.map((w) => (
          <li key={w.id} className="wiki-cards__row">
            <Link href={`/wiki/${w.id}`} className="wiki-card wiki-card--with-action">
              <span className="wiki-card__text">
                <span className="wiki-card__title">{w.title}</span>
                <span className="wiki-card__hint">{w.hint}</span>
              </span>
            </Link>
            <button
              type="button"
              className="wiki-card__delete"
              aria-label={`Excluir a wiki ${w.title}`}
              title="Excluir wiki"
              onClick={() => setToDelete(w)}
            >
              <Icon name="trash" />
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        className="dialog dialog--small"
        aria-labelledby="delete-wiki-title"
        onClose={() => setToDelete(null)}
      >
        <div className="window">
          <div className="window__titlebar">
            <h2 id="delete-wiki-title">Excluir wiki</h2>
          </div>
          <form action={deleteWiki} className="window__body stack">
            <input type="hidden" name="wikiId" value={toDelete?.id ?? ''} />
            <input type="hidden" name="confirm" value={toDelete?.title ?? ''} />
            <p style={{ margin: 0 }}>
              Excluir <strong>{toDelete?.title}</strong>? Todas as páginas e o histórico de versões serão apagados. Posts
              vinculados continuam existindo, mas saem do blog. Esta ação não pode ser desfeita.
            </p>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn--ghost" onClick={() => setToDelete(null)} autoFocus>
                Cancelar
              </button>
              <button type="submit" className="btn btn--danger">
                <Icon name="trash" className="btn__icon" />
                Excluir wiki
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
