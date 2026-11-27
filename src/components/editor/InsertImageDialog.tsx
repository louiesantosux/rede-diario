'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_EDIT } from '@/lib/imageFilters';
import { signedUrls, uploadBitmap } from '@/lib/mediaClient';
import { Notice } from '@/components/Notice';

export type InsertedImage = { mediaId: string; url: string; alt: string };

type Mine = { id: string; url: string; alt: string };

/** Diálogo para inserir uma imagem no texto: da galeria ou enviando uma foto nova. */
export function InsertImageDialog({
  open,
  onClose,
  onInsert,
}: {
  open: boolean;
  onClose: () => void;
  onInsert: (img: InsertedImage) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<'galeria' | 'enviar'>('galeria');
  const [mine, setMine] = useState<Mine[] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!open || mine) return;
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      const { data: rows } = await supabase
        .from('media')
        .select('id, alt_text')
        .eq('owner_id', auth.user?.id ?? '')
        .order('created_at', { ascending: false })
        .limit(60);
      const urls = await signedUrls(supabase, (rows ?? []).map((r) => r.id as string));
      setMine(
        (rows ?? [])
          .map((r) => ({ id: r.id as string, url: urls[r.id as string] ?? '', alt: (r.alt_text as string) ?? '' }))
          .filter((m) => m.url),
      );
    })();
  }, [open, mine]);

  const reset = () => {
    setFile(null);
    setAlt('');
    setError(null);
    setBusy(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const { id } = await uploadBitmap(supabase, auth.user!.id, bitmap, structuredClone(DEFAULT_EDIT), alt);
      const urls = await signedUrls(supabase, [id]);
      onInsert({ mediaId: id, url: urls[id] ?? '', alt });
      setMine(null); // recarrega a galeria na próxima abertura
      close();
    } catch {
      setError('Não foi possível enviar. Use JPG, PNG ou WebP e tente de novo.');
      setBusy(false);
    }
  };

  return (
    <dialog ref={dialog} className="dialog" aria-labelledby="insert-image-title" onClose={close}>
      <div className="window">
        <div className="window__titlebar">
          <h2 id="insert-image-title">Inserir imagem</h2>
        </div>
        <div className="window__body stack">
          <div className="row" role="tablist" aria-label="Origem da imagem">
            <button type="button" role="tab" aria-selected={tab === 'galeria'} className="btn" onClick={() => setTab('galeria')}>
              Da galeria
            </button>
            <button type="button" role="tab" aria-selected={tab === 'enviar'} className="btn" onClick={() => setTab('enviar')}>
              Enviar foto
            </button>
          </div>

          {tab === 'galeria' &&
            (mine === null ? (
              <p className="muted">Carregando sua galeria…</p>
            ) : mine.length === 0 ? (
              <p style={{ margin: 0 }}>Sua galeria está vazia. Use “Enviar foto”.</p>
            ) : (
              <ul className="picker" style={{ maxHeight: 360, overflowY: 'auto' }}>
                {mine.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="picker__item"
                      aria-label={`Inserir: ${m.alt || 'imagem sem descrição'}`}
                      onClick={() => {
                        onInsert({ mediaId: m.id, url: m.url, alt: m.alt });
                        close();
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.url} alt="" loading="lazy" />
                    </button>
                  </li>
                ))}
              </ul>
            ))}

          {tab === 'enviar' && (
            <div className="stack">
              <Notice error={error ?? undefined} />
              <div className="field">
                <label htmlFor="insert-file">Foto</label>
                <input
                  id="insert-file"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="field">
                <label htmlFor="insert-alt">Descrição da imagem</label>
                <input id="insert-alt" type="text" maxLength={500} value={alt} onChange={(e) => setAlt(e.target.value)} />
              </div>
              <p className="muted" style={{ margin: 0, fontSize: '0.875rem' }}>
                Os dados da câmera e a localização são removidos. Para usar filtros, envie por{' '}
                <Link href="/criar/imagem">Criar → Imagem</Link> e depois escolha na galeria.
              </p>
              <div>
                <button type="button" className="btn btn--primary" disabled={!file || busy} onClick={upload}>
                  {busy ? 'Enviando…' : 'Enviar e inserir'}
                </button>
              </div>
            </div>
          )}

          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn--ghost" onClick={close}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
