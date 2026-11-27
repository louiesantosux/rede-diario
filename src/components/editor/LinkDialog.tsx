'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Editor } from '@tiptap/react';

/** Aceita "site.com", "www.site.com" ou "https://site.com"; recusa outros protocolos. */
export function normalizeUrl(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

type Props = { editor: Editor | null; open: boolean; onClose: () => void };

/** Inserir, editar (texto e endereço) ou remover um link no texto. */
export function LinkDialog({ editor, open, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState('');
  const [href, setHref] = useState('');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ao abrir, lê o link sob o cursor (ou o texto selecionado).
  useEffect(() => {
    const d = dialog.current;
    if (!d || !editor) return;
    if (open && !d.open) {
      const isLink = editor.isActive('link');
      if (isLink) editor.chain().extendMarkRange('link').run();
      const { from, to } = editor.state.selection;
      setText(editor.state.doc.textBetween(from, to, ' '));
      setHref(isLink ? String(editor.getAttributes('link').href ?? '') : '');
      setEditing(isLink);
      setError(null);
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open, editor]);

  // Sem <form>: o diálogo fica dentro do formulário do post/página e formulários não podem ser aninhados.
  const apply = () => {
    if (!editor) return;
    const url = normalizeUrl(href);
    if (!url) {
      setError('Informe um endereço válido, como site.com.br ou https://site.com.br.');
      return;
    }
    const label = text.trim() || url;
    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .insertContent({ type: 'text', text: label, marks: [{ type: 'link', attrs: { href: url } }] })
      .run();
    onClose();
  };

  const remove = () => {
    editor?.chain().focus().extendMarkRange('link').unsetLink().run();
    onClose();
  };

  return (
    <dialog ref={dialog} className="dialog dialog--small" aria-labelledby="link-dialog-title" onClose={onClose}>
      <div className="window">
        <div className="window__titlebar">
          <h2 id="link-dialog-title">{editing ? 'Editar link' : 'Inserir link'}</h2>
        </div>
        <div
          className="window__body stack"
          onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
            if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
              e.preventDefault();
              apply();
            }
          }}
        >
          {error && (
            <p className="notice notice--error" role="alert">
              {error}
            </p>
          )}
          <div className="field">
            <label htmlFor="link-text">Texto do link</label>
            <input
              id="link-text"
              type="text"
              maxLength={300}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ex.: minha loja de relógios favorita"
            />
          </div>
          <div className="field">
            <label htmlFor="link-href">Endereço</label>
            <input
              id="link-href"
              type="text"
              inputMode="url"
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder="https://"
              aria-describedby="link-help"
            />
            <small id="link-help">Links abrem em uma nova aba.</small>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            {editing ? (
              <button type="button" className="btn btn--danger" onClick={remove}>
                Remover link
              </button>
            ) : (
              <span />
            )}
            <div className="row">
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                Cancelar
              </button>
              <button type="button" className="btn btn--primary" onClick={apply}>
                {editing ? 'Salvar' : 'Inserir'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
