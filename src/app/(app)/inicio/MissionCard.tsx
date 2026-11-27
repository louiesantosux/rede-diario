'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Window } from '@/components/Window';

const skipKey = (date: string) => `missao-pulada-${date}`;

/** Missão diária: opcional, sem pontos, sem sequência, com "Pular" sempre visível. */
export function MissionCard({ id, date, prompt }: { id: string; date: string; prompt: string }) {
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    try {
      setSkipped(localStorage.getItem(skipKey(date)) === '1');
    } catch {
      /* armazenamento indisponível: mantém visível */
    }
  }, [date]);

  if (skipped) return null;

  const skip = () => {
    try {
      localStorage.setItem(skipKey(date), '1');
    } catch {
      /* ignora */
    }
    setSkipped(true);
  };

  return (
    <Window title="Missão do dia" icon="star">
      <div className="stack">
        <p style={{ fontSize: '1.125rem', margin: 0 }}>{prompt}</p>
        <p className="muted" style={{ margin: 0 }}>
          Opcional. Responda quando quiser, ou não responda.
        </p>
        <div className="row">
          <Link className="btn btn--primary" href={`/criar?missao=${id}`}>
            Escrever sobre isso
          </Link>
          <button type="button" className="btn btn--ghost" onClick={skip}>
            Pular hoje
          </button>
        </div>
      </div>
    </Window>
  );
}
