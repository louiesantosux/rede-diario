'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Notice } from '@/components/Notice';
import { addTrack, type TrackState } from '../actions';

export function AddTrackForm({ playlistId }: { playlistId: string }) {
  const [state, formAction, pending] = useActionState<TrackState, FormData>(addTrack, undefined);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={formAction} className="stack">
      <input type="hidden" name="playlistId" value={playlistId} />
      <Notice error={state?.error} ok={state?.ok} />
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: '1 1 320px' }}>
          <label htmlFor="url">Link de uma música, álbum ou playlist</label>
          <input
            id="url"
            name="url"
            type="text"
            inputMode="url"
            required
            placeholder="youtube.com/watch?v=… ou open.spotify.com/track/…"
            aria-describedby="url-help"
          />
        </div>
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? 'Adicionando…' : 'Adicionar'}
        </button>
      </div>
      <small id="url-help" className="muted">
        Aceita YouTube, YouTube Music e Spotify. Itens do Spotify tocam no player do próprio Spotify: a música inteira
        para quem está conectado ao Spotify no navegador, e uma prévia de 30 segundos para os demais.
      </small>
    </form>
  );
}
