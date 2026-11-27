'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition, type MutableRefObject } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { reorderPages, createPage, deletePage } from '@/app/(app)/wiki/actions';
import { Icon } from '@/components/Icon';

type Page = { id: string; title: string };

type Props = { wikiId: string; pages: Page[]; currentId: string | null; isOwner: boolean };

/** Abas das páginas. O dono reordena arrastando (mouse, toque ou teclado). */
export function WikiTabs({ wikiId, pages, currentId, isOwner }: Props) {
  const [order, setOrder] = useState(pages);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const justDragged = useRef(false);
  const [toDelete, setToDelete] = useState<Page | null>(null);

  const sensors = useSensors(
    // Só começa a arrastar depois de 6 px: um clique simples continua abrindo a página.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  );

  const titleOf = (id: string | number) => order.find((p) => p.id === id)?.title ?? 'página';

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    justDragged.current = true;
    setTimeout(() => (justDragged.current = false), 0);
    if (!over || active.id === over.id) return;
    const previous = order;
    const next = arrayMove(
      order,
      order.findIndex((p) => p.id === active.id),
      order.findIndex((p) => p.id === over.id),
    );
    setOrder(next);
    setError(null);
    startTransition(async () => {
      const res = await reorderPages(
        wikiId,
        next.map((p) => p.id),
      );
      if (!res.ok) {
        setOrder(previous);
        setError('Não foi possível salvar a nova ordem. Tente de novo.');
      }
    });
  };

  if (!isOwner) {
    if (order.length < 2) return null;
    return (
      <nav className="wiki-tabs" aria-label="Páginas da wiki">
        <ul>
          {order.map((p) => (
            <li key={p.id}>
              <Link href={`/wiki/${wikiId}?p=${p.id}`} aria-current={p.id === currentId ? 'page' : undefined}>
                {p.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <nav className="wiki-tabs" aria-label="Páginas da wiki" aria-describedby="wiki-tabs-help">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              'Para reordenar, pressione Espaço, use as setas para mover e pressione Espaço de novo para soltar. Esc cancela.',
          },
          announcements: {
            onDragStart: ({ active }) => `Movendo a página ${titleOf(active.id)}.`,
            onDragOver: ({ active, over }) =>
              over ? `${titleOf(active.id)} está sobre ${titleOf(over.id)}.` : `${titleOf(active.id)} fora da lista.`,
            onDragEnd: ({ active, over }) =>
              over ? `${titleOf(active.id)} solta na posição de ${titleOf(over.id)}.` : 'Movimento cancelado.',
            onDragCancel: ({ active }) => `Movimento de ${titleOf(active.id)} cancelado.`,
          },
        }}
      >
        <SortableContext items={order.map((p) => p.id)} strategy={horizontalListSortingStrategy}>
          <ul>
            {order.map((p) => (
              <SortableTab
                key={p.id}
                page={p}
                href={`/wiki/${wikiId}?p=${p.id}`}
                current={p.id === currentId}
                justDragged={justDragged}
                onDelete={() => setToDelete(p)}
              />
            ))}
            <li>
              <form action={createPage}>
                <input type="hidden" name="wikiId" value={wikiId} />
                <button type="submit" className="wiki-tabs__add">
                  + Nova página
                </button>
              </form>
            </li>
          </ul>
        </SortableContext>
      </DndContext>
      <p id="wiki-tabs-help" className="wiki-tabs__help">
        Arraste as abas para mudar a ordem.
      </p>
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      <ConfirmDelete wikiId={wikiId} page={toDelete} onCancel={() => setToDelete(null)} />
    </nav>
  );
}

/** Confirmação antes de excluir: a exclusão apaga a página e o histórico de versões. */
function ConfirmDelete({ wikiId, page, onCancel }: { wikiId: string; page: Page | null; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (page && !d.open) d.showModal();
    if (!page && d.open) d.close();
  }, [page]);

  return (
    <dialog ref={dialog} className="dialog dialog--small" aria-labelledby="delete-page-title" onClose={onCancel}>
      <div className="window">
        <div className="window__titlebar">
          <h2 id="delete-page-title">Excluir página</h2>
        </div>
        <form action={deletePage} className="window__body stack">
          <input type="hidden" name="wikiId" value={wikiId} />
          <input type="hidden" name="pageId" value={page?.id ?? ''} />
          <p style={{ margin: 0 }}>
            Excluir <strong>{page?.title}</strong>? O conteúdo e o histórico de versões desta página serão apagados. Esta
            ação não pode ser desfeita.
          </p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn--ghost" onClick={onCancel} autoFocus>
              Cancelar
            </button>
            <button type="submit" className="btn btn--danger">
              <Icon name="trash" className="btn__icon" />
              Excluir
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}

function SortableTab({
  page,
  href,
  current,
  justDragged,
  onDelete,
}: {
  page: Page;
  href: string;
  current: boolean;
  justDragged: MutableRefObject<boolean>;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? 'is-dragging' : undefined}
    >
      <Link
        href={href}
        aria-current={current ? 'page' : undefined}
        {...attributes}
        {...listeners}
        role="link"
        onClick={(e) => {
          if (justDragged.current) e.preventDefault();
        }}
      >
        <span className="wiki-tabs__grip" aria-hidden="true">
          ⠿
        </span>
        {page.title}
      </Link>
      <button
        type="button"
        className="wiki-tabs__delete"
        aria-label={`Excluir a página ${page.title}`}
        title="Excluir página"
        onClick={onDelete}
      >
        <Icon name="trash" />
      </button>
    </li>
  );
}
