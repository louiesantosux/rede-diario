'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Icon } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { deleteMedia } from './actions';

type Item = { id: string; url: string; alt: string };

/** Galeria própria com seleção múltipla e exclusão definitiva. */
export function GalleryManager({ items }: { items: Item[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ ok?: string; error?: string }>({});
  const [pending, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (confirming && !d.open) d.showModal();
    if (!confirming && d.open) d.close();
  }, [confirming]);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allSelected = items.length > 0 && selected.length === items.length;

  const confirmDelete = () => {
    const ids = selected;
    startTransition(async () => {
      const res = await deleteMedia(ids);
      setConfirming(false);
      if (res.ok) {
        setSelected([]);
        setMessage({ ok: res.deleted === 1 ? 'Imagem apagada.' : `${res.deleted} imagens apagadas.` });
        router.refresh();
      } else setMessage({ error: res.error });
    });
  };

  if (items.length === 0) return <p style={{ margin: 0 }}>Sua galeria está vazia.</p>;

  return (
    <div className="stack">
      <Notice ok={message.ok} error={message.error} />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="btn btn--ghost" onClick={() => setSelected(allSelected ? [] : items.map((i) => i.id))}>
          {allSelected ? 'Desmarcar todas' : 'Selecionar todas'}
        </button>
        <button
          type="button"
          className="btn btn--danger"
          disabled={selected.length === 0 || pending}
          onClick={() => setConfirming(true)}
        >
          <Icon name="trash" className="btn__icon" />
          Apagar {selected.length > 0 ? `(${selected.length})` : 'selecionadas'}
        </button>
      </div>

      <ul className="picker picker--manage" aria-label="Minhas imagens">
        {items.map((m, i) => {
          const on = selected.includes(m.id);
          return (
            <li key={m.id}>
              <button
                type="button"
                className="picker__item"
                aria-pressed={on}
                aria-label={`${m.alt || `Imagem ${i + 1} sem descrição`}${on ? ', selecionada' : ''}`}
                onClick={() => toggle(m.id)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt="" loading="lazy" />
                {on && (
                  <span className="picker__badge" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <dialog ref={dialog} className="dialog dialog--small" aria-labelledby="del-media-title" onClose={() => setConfirming(false)}>
        <div className="window">
          <div className="window__titlebar">
            <h2 id="del-media-title">Apagar imagens</h2>
          </div>
          <div className="window__body stack">
            <p style={{ margin: 0 }}>
              Apagar {selected.length === 1 ? 'esta imagem' : `estas ${selected.length} imagens`} para sempre? Elas somem da
              galeria e também dos posts, moodboards, wikis e do seu espaço onde estiverem. Não dá para desfazer.
            </p>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn--ghost" onClick={() => setConfirming(false)} autoFocus>
                Cancelar
              </button>
              <button type="button" className="btn btn--danger" onClick={confirmDelete} disabled={pending}>
                <Icon name="trash" className="btn__icon" />
                {pending ? 'Apagando…' : 'Apagar'}
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
}
