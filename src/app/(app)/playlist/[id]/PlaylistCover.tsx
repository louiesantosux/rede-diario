'use client';

import { useState } from 'react';
import { ImagePicker } from '@/components/wiki/ImagePicker';
import { createClient } from '@/lib/supabase/client';
import { signedUrls } from '@/lib/mediaClient';
import { setPlaylistCover } from '../actions';

type Props = {
  playlistId: string;
  custom: { id: string; url: string } | null;
  auto: string | null;
};

/** Escolha da capa: uma foto da galeria ou a capa automática (primeira faixa). Salva ao escolher. */
export function PlaylistCover({ playlistId, custom: initial, auto }: Props) {
  const [custom, setCustom] = useState(initial);
  const [picking, setPicking] = useState(false);
  const [status, setStatus] = useState('');

  const save = async (id: string | null) => {
    setPicking(false);
    setStatus('Salvando…');
    if (id) {
      const urls = await signedUrls(createClient(), [id]);
      setCustom({ id, url: urls[id] ?? '' });
    } else setCustom(null);
    const res = await setPlaylistCover(playlistId, id);
    setStatus(res.ok ? (id ? 'Capa salva.' : 'Voltou para a capa automática.') : res.error ?? 'Não foi possível salvar.');
  };

  const url = custom?.url || auto;

  return (
    <div className="stack">
      <div className="row" style={{ alignItems: 'center' }}>
        <span className="playlist-cover playlist-cover--sm" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {url ? <img src={url} alt="" /> : <span>♪</span>}
        </span>
        <div className="stack" style={{ gap: 6 }}>
          <p style={{ margin: 0 }}>
            {custom ? 'Capa escolhida por você.' : 'Capa automática: a da primeira música da lista.'}
          </p>
          <div className="row">
            <button type="button" className="btn" aria-expanded={picking} onClick={() => setPicking((p) => !p)}>
              {custom ? 'Trocar capa' : 'Escolher uma foto'}
            </button>
            {custom && (
              <button type="button" className="btn btn--ghost" onClick={() => void save(null)}>
                Usar capa automática
              </button>
            )}
          </div>
        </div>
      </div>
      {picking && (
        <div className="space-picker" role="group" aria-label="Escolher capa da playlist">
          <ImagePicker selected={[]} max={1} onChange={(ids) => void save(ids[ids.length - 1] ?? null)} />
        </div>
      )}
      <p className="autosave" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
