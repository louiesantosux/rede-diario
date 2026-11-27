'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Mine = { id: string; url: string; alt: string };

/** Seleção de imagens da própria galeria (só imagens próprias podem ser usadas). */
export function ImagePicker({
  selected,
  max,
  onChange,
}: {
  selected: string[];
  max: number;
  onChange: (ids: string[]) => void;
}) {
  const [mine, setMine] = useState<Mine[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      const { data: rows, error: e1 } = await supabase
        .from('media')
        .select('id, storage_path, alt_text')
        .eq('owner_id', auth.user?.id ?? '')
        .order('created_at', { ascending: false })
        .limit(120);
      if (e1 || !rows) {
        if (alive) setError(true);
        return;
      }
      const { data: signed } = await supabase.storage
        .from('media')
        .createSignedUrls(
          rows.map((r) => r.storage_path as string),
          3600,
        );
      const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
      if (alive) {
        setMine(
          rows
            .map((r) => ({ id: r.id as string, url: byPath.get(r.storage_path as string) ?? '', alt: (r.alt_text as string) ?? '' }))
            .filter((m) => m.url),
        );
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <p className="notice notice--error">Não foi possível carregar sua galeria.</p>;
  if (!mine) return <p className="muted">Carregando sua galeria…</p>;
  if (mine.length === 0) {
    return (
      <p style={{ margin: 0 }}>
        Sua galeria está vazia. <Link href="/criar/imagem">Envie fotos</Link> e depois volte para escolher.
      </p>
    );
  }

  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((s) => s !== id));
    else if (selected.length < max) onChange([...selected, id]);
  };

  return (
    <div className="stack">
      <p className="muted" style={{ margin: 0, fontSize: '0.875rem' }}>
        {selected.length} de até {max} selecionadas. A ordem segue a ordem de seleção.
      </p>
      <ul className="picker">
        {mine.map((m) => {
          const index = selected.indexOf(m.id);
          return (
            <li key={m.id}>
              <button
                type="button"
                className="picker__item"
                aria-pressed={index >= 0}
                aria-label={`${m.alt || 'Imagem sem descrição'}${index >= 0 ? `, selecionada, posição ${index + 1}` : ''}`}
                onClick={() => toggle(m.id)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt="" loading="lazy" />
                {index >= 0 && <span className="picker__badge">{index + 1}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="muted" style={{ margin: 0, fontSize: '0.875rem' }}>
        Para usar fotos novas, <Link href="/criar/imagem">envie-as</Link> (salve esta página antes).
      </p>
    </div>
  );
}
