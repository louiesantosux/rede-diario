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
          <label htmlFor="url">Link do YouTube</label>
          <input id="url" name="url" type="text" inputMode="url" required placeholder="https://www.youtube.com/watch?v=…" />
        </div>
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? 'Adicionando…' : 'Adicionar'}
        </button>
      </div>
    </form>
  );
}
