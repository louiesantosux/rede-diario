import type { Metadata } from 'next';
import Link from 'next/link';
import { Window } from '@/components/Window';
import { Notice } from '@/components/Notice';
import { createPlaylist } from '../../playlist/actions';

export const metadata: Metadata = { title: 'Nova playlist' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const ERRORS: Record<string, string> = {
  titulo: 'Dê um nome à playlist ou cole o link de uma playlist do YouTube.',
  falhou: 'Não foi possível criar a playlist. Tente novamente.',
  link: 'O link não é de uma playlist do YouTube ou do YouTube Music.',
};

export default async function NovaPlaylistPage({ searchParams }: Props) {
  const sp = await searchParams;
  const erro = Array.isArray(sp.erro) ? sp.erro[0] : sp.erro;
  const detalhe = Array.isArray(sp.detalhe) ? sp.detalhe[0] : sp.detalhe;
  const message = erro === 'importacao' ? detalhe?.slice(0, 200) : erro ? ERRORS[erro] : undefined;

  return (
    <main id="conteudo" className="page page--narrow">
      <Window title="Nova playlist" icon="music" headingLevel={1}>
        <form action={createPlaylist} className="stack">
          <Link href="/criar">← Voltar para Criar</Link>
          <Notice error={message} />
          <div className="field">
            <label htmlFor="importUrl">Importar uma playlist pronta (opcional)</label>
            <input
              id="importUrl"
              name="importUrl"
              type="text"
              inputMode="url"
              placeholder="https://music.youtube.com/playlist?list=…"
              aria-describedby="import-help"
            />
            <small id="import-help">
              Funciona com playlists públicas ou não listadas do YouTube e do YouTube Music (até 200 faixas).
            </small>
          </div>
          <div className="field">
            <label htmlFor="title">Nome</label>
            <input
              id="title"
              name="title"
              type="text"
              maxLength={120}
              placeholder="Ex.: Para dias de chuva"
              aria-describedby="title-help"
            />
            <small id="title-help">Se importar uma playlist e deixar vazio, usamos o nome dela.</small>
          </div>
          <div className="field">
            <label htmlFor="description">Descrição (opcional)</label>
            <textarea id="description" name="description" rows={2} maxLength={500} />
          </div>
          <div className="field">
            <label htmlFor="visibility">Quem pode ver</label>
            <select id="visibility" name="visibility" defaultValue="friends">
              <option value="private">Só eu</option>
              <option value="friends">Amigos</option>
              <option value="unlisted">Quem tiver o link</option>
              <option value="public">Público</option>
            </select>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: '0.875rem' }}>
            Depois de criar, você pode adicionar mais músicas ou outras playlists colando links do YouTube.
          </p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn--primary">
              Criar playlist
            </button>
          </div>
        </form>
      </Window>
    </main>
  );
}
