'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { deletePost } from './actions';

/** Exclusão em dois passos, para evitar apagar sem querer. */
export function DeletePost({ postId }: { postId: string }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <form action={deletePost} className="row post__delete">
      <input type="hidden" name="postId" value={postId} />
      {confirm ? (
        <>
          <span>Apagar este post? As respostas privadas também serão apagadas.</span>
          <button type="button" className="btn btn--ghost" onClick={() => setConfirm(false)} autoFocus>
            Cancelar
          </button>
          <button type="submit" className="btn btn--danger">
            <Icon name="trash" className="btn__icon" />
            Apagar post
          </button>
        </>
      ) : (
        <button type="button" className="btn btn--ghost" onClick={() => setConfirm(true)}>
          <Icon name="trash" className="btn__icon" />
          Apagar post
        </button>
      )}
    </form>
  );
}
