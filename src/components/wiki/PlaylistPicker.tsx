'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/** Escolhe uma das próprias playlists para exibir num bloco da wiki. */
export function PlaylistPicker({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string | null;
  onChange: (playlistId: string | null) => void;
}) {
  const [mine, setMine] = useState<{ id: string; title: string }[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      const { data } = await supabase
        .from('playlists')
        .select('id, title')
        .eq('owner_id', auth.user?.id ?? '')
        .order('updated_at', { ascending: false });
      if (alive) setMine((data ?? []) as { id: string; title: string }[]);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!mine) return <p className="muted">Carregando suas playlists…</p>;
  if (mine.length === 0) {
    return (
      <p style={{ margin: 0 }}>
        Você ainda não tem playlists. <Link href="/criar/playlist">Crie uma</Link> (salve esta página antes).
      </p>
    );
  }

  return (
    <div className="field" style={{ maxWidth: 360 }}>
      <label htmlFor={id}>Playlist exibida</label>
      <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Escolha uma playlist</option>
        {mine.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </select>
      <small>Quem não puder ver a playlist não verá este bloco.</small>
    </div>
  );
}
