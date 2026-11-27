'use client';

import Link from 'next/link';
import { startTransition, useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { Window } from '@/components/Window';
import { Icon } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { createClient } from '@/lib/supabase/client';
import {
  ADJUSTMENT_FIELDS,
  DEFAULT_EDIT,
  FILTERS,
  ZERO,
  canvasToBlob,
  renderToCanvas,
  type EditParams,
} from '@/lib/imageFilters';
import { finalizeImages, type FinalizeState } from './actions';

const MAX_FILES = 20;
const MAX_BYTES = 25 * 1024 * 1024;
const PREVIEW_SIDE = 900;
const THUMB_SIDE = 96;
const ORIGINAL_SIDE = 2560;
const EDITED_SIDE = 2048;

type Item = {
  key: string;
  name: string;
  bitmap: ImageBitmap;
  params: EditParams;
  alt: string;
  mediaId?: string; // preenchido após o envio
};

type Destination = 'post' | 'moodboard' | 'galeria';

export function ImageStudio({ userId }: { userId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [destination, setDestination] = useState<Destination>('post');
  const [visibility, setVisibility] = useState('friends');
  const [dragging, setDragging] = useState(false);
  const [state, formAction, pending] = useActionState<FinalizeState, FormData>(finalizeImages, undefined);
  const fileInput = useRef<HTMLInputElement>(null);

  const current = items[selected];

  // ---------- Carregamento ----------
  const addFiles = async (files: FileList | File[]) => {
    setLoadError(null);
    const list = Array.from(files).slice(0, MAX_FILES - items.length);
    const loaded: Item[] = [];
    const problems: string[] = [];
    for (const file of list) {
      if (!file.type.startsWith('image/')) {
        problems.push(`${file.name}: não é uma imagem.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        problems.push(`${file.name}: maior que 25 MB.`);
        continue;
      }
      try {
        // A orientação do EXIF é aplicada aqui; o EXIF em si é descartado ao reencodar.
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        loaded.push({ key: crypto.randomUUID(), name: file.name, bitmap, params: structuredClone(DEFAULT_EDIT), alt: '' });
      } catch {
        problems.push(
          `${file.name}: o navegador não conseguiu abrir este formato${/hei[cf]/i.test(file.type + file.name) ? ' (HEIC). Converta para JPG ou PNG' : ''}.`,
        );
      }
    }
    if (problems.length) setLoadError(problems.join(' '));
    if (loaded.length) {
      if (items.length === 0) setSelected(0);
      setItems((prev) => [...prev, ...loaded]);
    }
  };

  const updateCurrent = (changes: Partial<Item>) =>
    setItems((prev) => prev.map((it, i) => (i === selected ? { ...it, ...changes, mediaId: undefined } : it)));
  const setParams = (fn: (p: EditParams) => EditParams) => current && updateCurrent({ params: fn(current.params) });

  const removeCurrent = () => {
    setItems((prev) => prev.filter((_, i) => i !== selected));
    setSelected((s) => Math.max(0, s - 1));
  };

  // ---------- Envio ----------
  const uploadAll = async (): Promise<string[] | null> => {
    const supabase = createClient();
    setUploadError(null);
    setUploading({ done: 0, total: items.length });
    const ids: string[] = [];
    const updated = [...items];
    try {
      for (let i = 0; i < updated.length; i++) {
        const it = updated[i];
        if (it.mediaId) {
          ids.push(it.mediaId);
          setUploading({ done: i + 1, total: updated.length });
          continue;
        }
        const id = crypto.randomUUID();
        const base = `${userId}/${id}`;
        const original = await canvasToBlob(renderToCanvas(it.bitmap, { ...DEFAULT_EDIT, adj: { ...ZERO } }, ORIGINAL_SIDE), 0.9);
        const editedCanvas = renderToCanvas(it.bitmap, it.params, EDITED_SIDE);
        const edited = await canvasToBlob(editedCanvas, 0.86);

        const up1 = await supabase.storage.from('media').upload(`${base}/original.jpg`, original, { contentType: 'image/jpeg' });
        if (up1.error) throw up1.error;
        const up2 = await supabase.storage.from('media').upload(`${base}/edit.jpg`, edited, { contentType: 'image/jpeg' });
        if (up2.error) throw up2.error;

        const { error } = await supabase.from('media').insert({
          id,
          storage_path: `${base}/edit.jpg`,
          original_path: `${base}/original.jpg`,
          edit_params: it.params,
          alt_text: it.alt.trim().slice(0, 500),
          width: editedCanvas.width,
          height: editedCanvas.height,
        });
        if (error) throw error;

        updated[i] = { ...it, mediaId: id };
        ids.push(id);
        setUploading({ done: i + 1, total: updated.length });
      }
      setItems(updated);
      return ids;
    } catch (e) {
      console.error(e);
      setItems(updated); // mantém o que já subiu, para não duplicar ao tentar de novo
      setUploadError('Não foi possível enviar todas as imagens. Verifique a conexão e tente de novo.');
      return null;
    } finally {
      setUploading(null);
    }
  };

  const submit = async (form: FormData) => {
    const ids = await uploadAll();
    if (!ids) return;
    form.set('mediaIds', JSON.stringify(ids));
    startTransition(() => formAction(form));
  };

  // ---------- Interface ----------
  if (items.length === 0) {
    return (
      <Window title="Imagens" icon="image" headingLevel={1}>
        <div className="stack">
          <Link href="/criar">← Voltar para Criar</Link>
          <Notice error={loadError ?? undefined} />
          <div
            className={`dropzone${dragging ? ' is-dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void addFiles(e.dataTransfer.files);
            }}
          >
            <Icon name="image" className="dropzone__icon" />
            <p style={{ margin: 0, fontWeight: 600 }}>Arraste fotos para cá</p>
            <p className="muted" style={{ margin: 0 }}>
              JPG, PNG ou WebP, até 25 MB cada, no máximo {MAX_FILES} por vez.
            </p>
            <button type="button" className="btn btn--primary" onClick={() => fileInput.current?.click()}>
              Escolher fotos
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => e.target.files && void addFiles(e.target.files)}
            />
          </div>
          <p className="muted" style={{ margin: 0, fontSize: '0.875rem' }}>
            Localização e outros dados da câmera (EXIF) são removidos antes do envio.
          </p>
        </div>
      </Window>
    );
  }

  return (
    <>
      <Window title="Editar imagens" icon="image" headingLevel={1}>
        <div className="stack">
          <Notice error={loadError ?? undefined} />
          <div className="filmstrip" role="tablist" aria-label="Imagens selecionadas">
            {items.map((it, i) => (
              <button
                key={it.key}
                type="button"
                role="tab"
                aria-selected={i === selected}
                aria-label={`Imagem ${i + 1}: ${it.name}`}
                className="filmstrip__item"
                onClick={() => setSelected(i)}
              >
                <Thumb bitmap={it.bitmap} params={it.params} />
              </button>
            ))}
            {items.length < MAX_FILES && (
              <button type="button" className="filmstrip__add" onClick={() => fileInput.current?.click()} aria-label="Adicionar mais fotos">
                <Icon name="plus" />
              </button>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => e.target.files && void addFiles(e.target.files)}
            />
          </div>

          {current && (
            <div className="studio">
              <div className="studio__preview">
                <Preview bitmap={current.bitmap} params={current.params} />
                <div className="row" style={{ justifyContent: 'center' }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setParams((p) => ({ ...p, rotate: (((p.rotate + 270) % 360) as EditParams['rotate']) }))}
                  >
                    ⟲ Girar
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setParams((p) => ({ ...p, rotate: (((p.rotate + 90) % 360) as EditParams['rotate']) }))}
                  >
                    ⟳ Girar
                  </button>
                  <button type="button" className="btn" onClick={() => setParams((p) => ({ ...p, flip: !p.flip }))} aria-pressed={current.params.flip}>
                    ⇋ Espelhar
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={removeCurrent}>
                    Remover
                  </button>
                </div>
                <div className="field">
                  <label htmlFor="alt">Descrição da imagem (texto alternativo)</label>
                  <input
                    id="alt"
                    type="text"
                    maxLength={500}
                    value={current.alt}
                    onChange={(e) => updateCurrent({ alt: e.target.value })}
                    placeholder="Ex.: Relógio de bolso dourado sobre uma mesa de madeira"
                    aria-describedby="alt-help"
                  />
                  <small id="alt-help">Ajuda quem usa leitor de tela a saber o que a foto mostra.</small>
                </div>
              </div>

              <div className="studio__controls">
                <fieldset className="choice-group">
                  <legend>Filtros</legend>
                  <div className="filter-strip">
                    {FILTERS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        className="filter-chip"
                        aria-pressed={current.params.filter === f.id}
                        onClick={() => setParams((p) => ({ ...p, filter: f.id, intensity: 100 }))}
                      >
                        <Thumb bitmap={current.bitmap} params={{ ...current.params, filter: f.id, intensity: 100, adj: { ...ZERO } }} />
                        <span>{f.label}</span>
                      </button>
                    ))}
                  </div>
                  {current.params.filter !== 'original' && (
                    <Slider
                      id="intensity"
                      label="Intensidade do filtro"
                      min={0}
                      max={100}
                      value={current.params.intensity}
                      onChange={(v) => setParams((p) => ({ ...p, intensity: v }))}
                    />
                  )}
                </fieldset>

                <fieldset className="choice-group">
                  <legend>Ajustes</legend>
                  <div className="sliders">
                    {ADJUSTMENT_FIELDS.map((f) => (
                      <Slider
                        key={f.key}
                        id={`adj-${f.key}`}
                        label={f.label}
                        min={f.min}
                        max={f.max}
                        value={current.params.adj[f.key]}
                        onChange={(v) => setParams((p) => ({ ...p, adj: { ...p.adj, [f.key]: v } }))}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setParams(() => structuredClone(DEFAULT_EDIT))}
                  >
                    Restaurar original
                  </button>
                </fieldset>
              </div>
            </div>
          )}
        </div>
      </Window>

      <Window title="Onde guardar" icon="star">
        <form action={submit} className="stack">
          <Notice error={uploadError ?? state?.error} />

          <fieldset className="choice-group">
            <legend>Destino</legend>
            <div className="choice-grid">
              {(
                [
                  ['post', 'Post', 'Publica as fotos com uma legenda.'],
                  ['moodboard', 'Moodboard', 'Reúne as fotos num painel.'],
                  ['galeria', 'Só guardar', 'Ficam na sua galeria para usar depois.'],
                ] as const
              ).map(([value, label, hint]) => (
                <label key={value} className="choice">
                  <input
                    type="radio"
                    name="destination"
                    value={value}
                    checked={destination === value}
                    onChange={() => setDestination(value)}
                  />
                  <span className="choice__text">
                    <span className="choice__label">{label}</span>
                    <span className="choice__hint">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {destination === 'post' && (
            <div className="field">
              <label htmlFor="caption">Legenda (opcional)</label>
              <textarea id="caption" name="caption" rows={3} maxLength={5000} />
            </div>
          )}

          {destination === 'moodboard' && (
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div className="field" style={{ flex: '1 1 240px' }}>
                <label htmlFor="mb-title">Título do moodboard</label>
                <input id="mb-title" name="title" type="text" required maxLength={120} />
              </div>
              <div className="field" style={{ flex: '0 1 180px' }}>
                <label htmlFor="mb-layout">Layout</label>
                <select id="mb-layout" name="layout" defaultValue="mosaico">
                  <option value="mosaico">Mosaico</option>
                  <option value="grade">Grade</option>
                </select>
              </div>
              <div className="field" style={{ flex: '1 1 100%' }}>
                <label htmlFor="mb-desc">Descrição (opcional)</label>
                <input id="mb-desc" name="description" type="text" maxLength={300} />
              </div>
            </div>
          )}

          {destination !== 'galeria' && (
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div className="field" style={{ flex: '0 1 220px' }}>
                <label htmlFor="visibility">Quem pode ver</label>
                <select id="visibility" name="visibility" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
                  <option value="private">Só eu</option>
                  <option value="friends">Amigos</option>
                  <option value="unlisted">Quem tiver o link</option>
                  <option value="public">Público</option>
                </select>
              </div>
              {destination === 'post' && visibility !== 'private' && (
                <div className="field" style={{ flex: '0 1 240px' }}>
                  <label htmlFor="replyPolicy">Quem pode responder</label>
                  <select id="replyPolicy" name="replyPolicy" defaultValue="friends">
                    <option value="friends">Só amigos</option>
                    <option value="everyone">Qualquer pessoa com conta</option>
                    <option value="nobody">Ninguém</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {items.some((it) => !it.alt.trim()) && (
            <p className="muted" style={{ margin: 0 }}>
              {items.filter((it) => !it.alt.trim()).length === 1
                ? 'Uma imagem está sem descrição.'
                : `${items.filter((it) => !it.alt.trim()).length} imagens estão sem descrição.`}{' '}
              Você pode adicionar antes de enviar.
            </p>
          )}

          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <span className="muted" role="status" aria-live="polite">
              {uploading ? `Enviando ${uploading.done} de ${uploading.total}…` : ''}
            </span>
            <button type="submit" className="btn btn--primary" disabled={Boolean(uploading) || pending}>
              {uploading || pending ? 'Enviando…' : destination === 'galeria' ? 'Guardar imagens' : 'Enviar e publicar'}
            </button>
          </div>
        </form>
      </Window>
    </>
  );
}

function Slider({
  id,
  label,
  min,
  max,
  value,
  onChange,
}: {
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="slider">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="range" min={min} max={max} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <output htmlFor={id}>{value > 0 && min < 0 ? `+${value}` : value}</output>
    </div>
  );
}

/** Pré-visualização principal, redesenhada no próximo quadro após cada ajuste. */
function Preview({ bitmap, params }: { bitmap: ImageBitmap; params: EditParams }) {
  const holder = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);

  const draw = useCallback(() => {
    const canvas = renderToCanvas(bitmap, params, PREVIEW_SIDE);
    canvas.className = 'studio__canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Pré-visualização da imagem editada');
    holder.current?.replaceChildren(canvas);
  }, [bitmap, params]);

  useEffect(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(draw);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [draw]);

  return <div ref={holder} className="studio__canvas-holder" />;
}

function Thumb({ bitmap, params }: { bitmap: ImageBitmap; params: EditParams }) {
  const holder = useRef<HTMLSpanElement>(null);
  const key = JSON.stringify(params);
  useEffect(() => {
    const canvas = renderToCanvas(bitmap, JSON.parse(key) as EditParams, THUMB_SIDE);
    canvas.className = 'thumb__canvas';
    canvas.setAttribute('aria-hidden', 'true');
    holder.current?.replaceChildren(canvas);
  }, [bitmap, key]);
  return <span ref={holder} className="thumb" />;
}
