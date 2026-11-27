'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { Window } from '@/components/Window';
import { Icon } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { RichEditor } from '@/components/editor/RichEditor';
import { ImagePicker } from '@/components/wiki/ImagePicker';
import { PlaylistPicker } from '@/components/wiki/PlaylistPicker';
import { MAX_BLOCK_IMAGES, newBlock, newId, type Block, type CollectionItem } from '@/lib/blocks';
import { createClient } from '@/lib/supabase/client';
import { signedUrls } from '@/lib/mediaClient';
import { deletePage, savePage, type FormState } from '../../actions';

type Visibility = 'private' | 'friends' | 'unlisted' | 'public';

type Props = {
  wikiId: string;
  wikiTitle: string;
  page: { id: string; title: string; visibility: Visibility; blocks: Block[] };
  bgMusic: { youtubeId: string; title: string } | null;
};

const BLOCK_LABEL: Record<Block['type'], string> = {
  text: 'Texto',
  collection: 'Coleção',
  divider: 'Divisor',
  blog: 'Blog',
  images: 'Imagens',
  playlist: 'Playlist',
};

const ADDABLE: { type: Block['type']; label: string }[] = [
  { type: 'text', label: 'Texto' },
  { type: 'collection', label: 'Coleção' },
  { type: 'images', label: 'Imagens' },
  { type: 'playlist', label: 'Playlist' },
  { type: 'divider', label: 'Divisor' },
  { type: 'blog', label: 'Blog' },
];

export function PageEditor({ wikiId, wikiTitle, page, bgMusic }: Props) {
  const [title, setTitle] = useState(page.title);
  const [visibility, setVisibility] = useState<Visibility>(page.visibility);
  const [blocks, setBlocks] = useState<Block[]>(page.blocks);
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [music, setMusic] = useState(bgMusic ? `https://www.youtube.com/watch?v=${bgMusic.youtubeId}` : '');
  const [state, formAction, pending] = useActionState<FormState, FormData>(savePage, undefined);

  useEffect(() => {
    if (state?.ok) setDirty(false);
  }, [state]);

  // Avisa antes de sair com alterações não salvas.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const update = (fn: (prev: Block[]) => Block[]) => {
    setBlocks(fn);
    setDirty(true);
  };
  const patch = (id: string, changes: Partial<Block>) =>
    update((prev) => prev.map((b) => (b.id === id ? ({ ...b, ...changes } as Block) : b)));
  const move = (index: number, dir: -1 | 1) =>
    update((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  const remove = (id: string) => update((prev) => prev.filter((b) => b.id !== id));
  const add = (type: Block['type']) => update((prev) => [...prev, newBlock(type)]);

  const submit = (form: FormData) => {
    form.set('blocks', JSON.stringify(blocks));
    formAction(form);
  };

  return (
    <>
      <Window title={`Editar página · ${wikiTitle}`} icon="pen" headingLevel={1}>
        <form action={submit} className="stack">
          <input type="hidden" name="pageId" value={page.id} />
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <Link href={`/wiki/${wikiId}?p=${page.id}`}>← Ver página</Link>
            <span className="muted" role="status" aria-live="polite">
              {dirty ? 'Alterações não salvas' : ''}
            </span>
          </div>

          <Notice
            error={state?.error}
            ok={state?.ok}
          />

          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: '1 1 260px' }}>
              <label htmlFor="title">Título da página</label>
              <input
                id="title"
                name="title"
                type="text"
                required
                maxLength={120}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setDirty(true);
                }}
              />
            </div>
            <div className="field" style={{ flex: '0 1 200px' }}>
              <label htmlFor="visibility">Quem pode ver esta página</label>
              <select
                id="visibility"
                name="visibility"
                value={visibility}
                onChange={(e) => {
                  setVisibility(e.target.value as Visibility);
                  setDirty(true);
                }}
              >
                <option value="private">Só eu</option>
                <option value="friends">Amigos</option>
                <option value="unlisted">Quem tiver o link</option>
                <option value="public">Público</option>
              </select>
            </div>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: '0.875rem' }}>
            A página nunca fica mais aberta que a wiki: se a wiki for privada, a página também será.
          </p>

          <fieldset className="choice-group">
            <legend>Música de fundo da página</legend>
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div className="field" style={{ flex: '1 1 320px' }}>
                <label htmlFor="bgMusic">Link do YouTube (deixe vazio para não ter música)</label>
                <input
                  id="bgMusic"
                  name="bgMusic"
                  type="text"
                  inputMode="url"
                  value={music}
                  onChange={(e) => {
                    setMusic(e.target.value);
                    setDirty(true);
                  }}
                  placeholder="https://www.youtube.com/watch?v=…"
                  aria-describedby="bgMusic-help"
                />
              </div>
              {music && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    setMusic('');
                    setDirty(true);
                  }}
                >
                  Remover música
                </button>
              )}
            </div>
            <small id="bgMusic-help" className="muted">
              {bgMusic ? `Atual: ${bgMusic.title}. ` : ''}Visitantes escolhem se querem tocar; o volume fica limitado a 20%
              do volume do dispositivo.
            </small>
          </fieldset>

          <ol className="block-list">
            {blocks.map((block, i) => (
              <li key={block.id} className="block-card">
                <div className="block-card__bar">
                  <span className="block-card__type">{BLOCK_LABEL[block.type]}</span>
                  <div className="row" style={{ gap: 2 }}>
                    <button type="button" className="toolbar__btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Mover bloco ${i + 1} para cima`}>
                      ↑
                    </button>
                    <button type="button" className="toolbar__btn" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} aria-label={`Mover bloco ${i + 1} para baixo`}>
                      ↓
                    </button>
                    <button type="button" className="toolbar__btn" onClick={() => remove(block.id)} aria-label={`Remover bloco ${i + 1}`}>
                      ✕
                    </button>
                  </div>
                </div>
                <div className="block-card__body">
                  <BlockEditor block={block} index={i} onPatch={(c) => patch(block.id, c)} />
                </div>
              </li>
            ))}
          </ol>

          <div className="add-block">
            <span className="muted">Adicionar bloco:</span>
            {ADDABLE.map((a) => (
              <button key={a.type} type="button" className="btn" onClick={() => add(a.type)}>
                + {a.label}
              </button>
            ))}
          </div>

          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn--primary" disabled={pending}>
              {pending ? 'Salvando…' : 'Salvar página'}
            </button>
          </div>
        </form>
      </Window>

      {(
        <Window title="Excluir página" icon="trash">
          <form action={deletePage} className="row" style={{ justifyContent: 'space-between' }}>
            <input type="hidden" name="wikiId" value={wikiId} />
            <input type="hidden" name="pageId" value={page.id} />
            <p style={{ margin: 0 }}>A página e o histórico de versões serão apagados. Esta ação não pode ser desfeita.</p>
            {confirmDelete ? (
              <div className="row">
                <button type="button" className="btn btn--ghost" onClick={() => setConfirmDelete(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn--danger">
                  Confirmar exclusão
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn--danger" onClick={() => setConfirmDelete(true)}>
                <Icon name="trash" className="btn__icon" />
                Excluir página
              </button>
            )}
          </form>
        </Window>
      )}
    </>
  );
}

function BlockEditor({ block, index, onPatch }: { block: Block; index: number; onPatch: (c: Partial<Block>) => void }) {
  switch (block.type) {
    case 'text':
      return (
        <RichEditor
          initial={block.doc}
          label={`Texto do bloco ${index + 1}`}
          onChange={(doc) => onPatch({ doc } as Partial<Block>)}
        />
      );

    case 'divider':
      return (
        <div className="field">
          <label htmlFor={`div-${block.id}`}>Estilo</label>
          <select
            id={`div-${block.id}`}
            value={block.style}
            onChange={(e) => onPatch({ style: e.target.value } as Partial<Block>)}
          >
            <option value="estrelas">Estrelas</option>
            <option value="pontos">Pontos</option>
            <option value="linha">Linha</option>
          </select>
        </div>
      );

    case 'blog':
      return (
        <p className="muted" style={{ margin: 0 }}>
          Mostra, em ordem cronológica, os posts que você vincular a esta wiki ao compor um post.
        </p>
      );

    case 'collection':
      return <CollectionEditor block={block} onPatch={onPatch} />;

    case 'playlist':
      return (
        <PlaylistPicker
          id={`pl-${block.id}`}
          value={block.playlistId}
          onChange={(playlistId) => onPatch({ playlistId } as Partial<Block>)}
        />
      );

    case 'images':
      return (
        <div className="stack">
          <div className="field" style={{ maxWidth: 220 }}>
            <label htmlFor={`il-${block.id}`}>Layout</label>
            <select
              id={`il-${block.id}`}
              value={block.layout}
              onChange={(e) => onPatch({ layout: e.target.value } as Partial<Block>)}
            >
              <option value="mosaico">Mosaico (moodboard)</option>
              <option value="grade">Grade</option>
            </select>
          </div>
          <ImagePicker
            selected={block.mediaIds}
            max={MAX_BLOCK_IMAGES}
            onChange={(mediaIds) => onPatch({ mediaIds } as Partial<Block>)}
          />
        </div>
      );
  }
}

function CollectionEditor({
  block,
  onPatch,
}: {
  block: Extract<Block, { type: 'collection' }>;
  onPatch: (c: Partial<Block>) => void;
}) {
  const [statusText, setStatusText] = useState(block.statuses.join(', '));
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [picking, setPicking] = useState<string | null>(null);
  const vitrine = block.layout === 'vitrine';

  const setItems = (items: CollectionItem[]) => onPatch({ items } as Partial<Block>);
  const updateItem = (id: string, changes: Partial<CollectionItem>) =>
    setItems(block.items.map((it) => (it.id === id ? { ...it, ...changes } : it)));

  // Miniaturas das imagens já escolhidas (URLs temporárias).
  const imageKey = block.items.map((it) => it.mediaId ?? '').join(',');
  useEffect(() => {
    const ids = imageKey.split(',').filter((id) => id && !urls[id]);
    if (!vitrine || ids.length === 0) return;
    let alive = true;
    void signedUrls(createClient(), ids).then((found) => {
      if (alive) setUrls((u) => ({ ...u, ...found }));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageKey, vitrine]);

  const addItem = () =>
    setItems([...block.items, { id: newId(), name: '', status: block.statuses[0], note: '', mediaId: null, link: '' }]);
  const removeItem = (id: string) => setItems(block.items.filter((x) => x.id !== id));

  return (
    <div className="stack">
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label htmlFor={`ct-${block.id}`}>Nome da coleção</label>
          <input
            id={`ct-${block.id}`}
            type="text"
            maxLength={80}
            value={block.title}
            onChange={(e) => onPatch({ title: e.target.value } as Partial<Block>)}
          />
        </div>
        <div className="field" style={{ flex: '1 1 240px' }}>
          <label htmlFor={`cs-${block.id}`}>Status (separados por vírgula)</label>
          <input
            id={`cs-${block.id}`}
            type="text"
            value={statusText}
            onChange={(e) => setStatusText(e.target.value)}
            onBlur={() => {
              const statuses = statusText
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(0, 8);
              if (statuses.length) onPatch({ statuses } as Partial<Block>);
              else setStatusText(block.statuses.join(', '));
            }}
          />
        </div>
      </div>

      <fieldset className="format-cards">
        <legend>Formato da coleção</legend>
        {(
          [
            { id: 'vitrine', title: 'Vitrine', hint: 'Cartões com imagem, nome, texto curto e link. Ideal para wishlist.' },
            { id: 'lista', title: 'Lista simples', hint: 'Só nome, status e uma nota, sem imagem.' },
          ] as const
        ).map((f) => (
          <label key={f.id} className="format-card">
            <input
              type="radio"
              name={`layout-${block.id}`}
              value={f.id}
              checked={block.layout === f.id}
              onChange={() => onPatch({ layout: f.id } as Partial<Block>)}
            />
            <span>
              <strong>{f.title}</strong>
              <span className="muted">{f.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {vitrine && block.items.length > 0 && (
        <ul className="wish-edit">
          {block.items.map((it, i) => (
            <li key={it.id} className="wish-edit__item">
              <div className="wish-edit__media">
                <span className="wish-card__img" aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {it.mediaId && urls[it.mediaId] ? <img src={urls[it.mediaId]} alt="" /> : <span>✦</span>}
                </span>
                <div className="row" style={{ gap: 4 }}>
                  <button
                    type="button"
                    className="btn"
                    aria-expanded={picking === it.id}
                    onClick={() => setPicking(picking === it.id ? null : it.id)}
                  >
                    {it.mediaId ? 'Trocar imagem' : 'Escolher imagem'}
                    <span className="sr-only"> do item {i + 1}</span>
                  </button>
                  {it.mediaId && (
                    <button type="button" className="btn btn--ghost" onClick={() => updateItem(it.id, { mediaId: null })}>
                      Tirar<span className="sr-only"> imagem do item {i + 1}</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="stack" style={{ gap: 8 }}>
                <div className="row" style={{ alignItems: 'flex-end' }}>
                  <div className="field" style={{ flex: '1 1 200px' }}>
                    <label htmlFor={`wn-${it.id}`}>Nome do item</label>
                    <input
                      id={`wn-${it.id}`}
                      type="text"
                      maxLength={120}
                      value={it.name}
                      onChange={(e) => updateItem(it.id, { name: e.target.value })}
                    />
                  </div>
                  <div className="field" style={{ flex: '0 1 160px' }}>
                    <label htmlFor={`ws-${it.id}`}>Status</label>
                    <select id={`ws-${it.id}`} value={it.status} onChange={(e) => updateItem(it.id, { status: e.target.value })}>
                      {block.statuses.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    className="toolbar__btn"
                    aria-label={`Remover item ${i + 1}`}
                    onClick={() => removeItem(it.id)}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
                <div className="field">
                  <label htmlFor={`wt-${it.id}`}>Sobre o item</label>
                  <textarea
                    id={`wt-${it.id}`}
                    rows={2}
                    maxLength={500}
                    value={it.note}
                    placeholder="Por que você quer, onde viu, tamanho, cor…"
                    onChange={(e) => updateItem(it.id, { note: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`wl-${it.id}`}>Link (opcional)</label>
                  <input
                    id={`wl-${it.id}`}
                    type="url"
                    inputMode="url"
                    maxLength={2000}
                    value={it.link}
                    placeholder="https://loja.com.br/produto"
                    onChange={(e) => updateItem(it.id, { link: e.target.value })}
                  />
                </div>
              </div>
              {picking === it.id && (
                <div className="wish-edit__picker">
                  <ImagePicker
                    selected={[]}
                    max={1}
                    onChange={(ids) => {
                      const id = ids[ids.length - 1] ?? null;
                      updateItem(it.id, { mediaId: id });
                      setPicking(null);
                    }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {!vitrine && block.items.length > 0 && (
        <table className="items-table">
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Status</th>
              <th scope="col">Nota</th>
              <th scope="col">Link</th>
              <th scope="col">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {block.items.map((it, i) => (
              <tr key={it.id}>
                <td>
                  <input
                    type="text"
                    aria-label={`Nome do item ${i + 1}`}
                    maxLength={120}
                    value={it.name}
                    onChange={(e) => updateItem(it.id, { name: e.target.value })}
                  />
                </td>
                <td>
                  <select
                    aria-label={`Status do item ${i + 1}`}
                    value={it.status}
                    onChange={(e) => updateItem(it.id, { status: e.target.value })}
                  >
                    {block.statuses.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="text"
                    aria-label={`Nota do item ${i + 1}`}
                    maxLength={500}
                    value={it.note}
                    onChange={(e) => updateItem(it.id, { note: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="url"
                    inputMode="url"
                    aria-label={`Link do item ${i + 1}`}
                    maxLength={2000}
                    value={it.link}
                    onChange={(e) => updateItem(it.id, { link: e.target.value })}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="toolbar__btn"
                    aria-label={`Remover item ${i + 1}`}
                    onClick={() => removeItem(it.id)}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div>
        <button type="button" className="btn" onClick={addItem}>
          <Icon name="plus" className="btn__icon" />
          Adicionar item
        </button>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: '0.8125rem' }}>
        Itens sem nome não são salvos.{vitrine ? ' As imagens vêm da sua galeria e seguem a visibilidade desta página.' : ''}
      </p>
    </div>
  );
}
