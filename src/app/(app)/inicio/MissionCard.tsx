'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Window } from '@/components/Window';

const skipKey = (date: string) => `missao-pulada-${date}`;

type State = 'visible' | 'leaving' | 'hidden';

/** Missão diária: opcional, sem pontos, sem sequência, com "Pular" sempre visível. */
export function MissionCard({ id, date, prompt }: { id: string; date: string; prompt: string }) {
  const [state, setState] = useState<State>('visible');
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(skipKey(date)) === '1') setState('hidden');
    } catch {
      /* armazenamento indisponível: mantém visível */
    }
    return () => {
      if (fallback.current) clearTimeout(fallback.current);
    };
  }, [date]);

  if (state === 'hidden') return null;

  const skip = () => {
    try {
      localStorage.setItem(skipKey(date), '1');
    } catch {
      /* ignora */
    }
    if (document.documentElement.dataset.reduceMotion === 'true') {
      setState('hidden');
      return;
    }
    setState('leaving');
    // Garante a remoção mesmo se a animação não disparar.
    fallback.current = setTimeout(() => setState('hidden'), 400);
  };

  return (
    <Window
      title="Missão do dia"
      icon="star"
      className={state === 'leaving' ? 'window--leaving' : undefined}
      onAnimationEnd={(e) => {
        if (state === 'leaving' && e.animationName === 'window-out') setState('hidden');
      }}
    >
      <div className="stack">
        <p style={{ fontSize: '1.125rem', margin: 0 }}>{prompt}</p>
        <p className="muted" style={{ margin: 0 }}>
          Opcional. Responda quando quiser, ou não responda.
        </p>
        <div className="row">
          <Link className="btn btn--primary" href={`/criar/post?missao=${id}`}>
            Escrever sobre isso
          </Link>
          <button type="button" className="btn btn--ghost" onClick={skip} disabled={state === 'leaving'}>
            Pular hoje
          </button>
        </div>
      </div>
    </Window>
  );
}
