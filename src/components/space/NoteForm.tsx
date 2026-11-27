'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Notice } from '@/components/Notice';
import { sendNote, type FormState } from '@/app/(app)/meu-espaco/actions';
import { NOTE_MAX } from '@/lib/space';

export function NoteForm({ ownerId, ownerName }: { ownerId: string; ownerName: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(sendNote, undefined);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={action} className="stack note-form">
      <input type="hidden" name="ownerId" value={ownerId} />
      <div className="field">
        <label htmlFor="note-body">Deixar um recado para {ownerName}</label>
        <textarea id="note-body" name="body" rows={3} maxLength={NOTE_MAX} required aria-describedby="note-help" />
        <small id="note-help" className="space-muted">
          Até {NOTE_MAX} caracteres. O recado só aparece no mural depois de aprovado.
        </small>
      </div>
      <Notice error={state?.error} ok={state?.ok} />
      <div>
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? 'Enviando…' : 'Enviar recado'}
        </button>
      </div>
    </form>
  );
}
