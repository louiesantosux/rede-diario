'use client';

import { useActionState } from 'react';
import { Notice } from '@/components/Notice';
import { sendReply, type ReplyState } from './actions';

export function ReplyForm({ postId }: { postId: string }) {
  const [state, formAction, pending] = useActionState<ReplyState, FormData>(sendReply, undefined);

  if (state?.ok) {
    return (
      <p className="notice notice--ok" role="status">
        Resposta enviada. Só o autor do post vai ver.
      </p>
    );
  }

  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="postId" value={postId} />
      <Notice error={state?.error} />
      <div className="field">
        <label htmlFor="reply">Sua resposta</label>
        <textarea id="reply" name="body" rows={4} required maxLength={4000} aria-describedby="reply-help" />
        <small id="reply-help">Só o autor do post vê as respostas. Elas não aparecem para mais ninguém.</small>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? 'Enviando…' : 'Enviar resposta'}
        </button>
      </div>
    </form>
  );
}
