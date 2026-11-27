import Link from 'next/link';
import { RichText } from '@/components/RichText';
import type { Block } from '@/lib/blocks';
import { docText, isPostBody } from '@/lib/richtext';

export type BlogPost = { id: string; body: unknown; created_at: string };

const dateFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Sao_Paulo' });

function postTitle(body: unknown) {
  if (!isPostBody(body)) return 'Post';
  const first = (body.text || docText(body.doc)).split('\n')[0] ?? '';
  return first.length > 90 ? `${first.slice(0, 90)}…` : first || 'Post';
}

function postExcerpt(body: unknown) {
  if (!isPostBody(body)) return '';
  const rest = body.text.split('\n').slice(1).join(' ').trim();
  return rest.length > 220 ? `${rest.slice(0, 220)}…` : rest;
}

export function WikiBlocks({ blocks, posts }: { blocks: Block[]; posts: BlogPost[] }) {
  if (blocks.length === 0) return <p className="wiki-empty">Esta página ainda está vazia.</p>;

  return (
    <div className="wiki-blocks">
      {blocks.map((block) => {
        switch (block.type) {
          case 'text':
            return <RichText key={block.id} doc={block.doc} />;

          case 'divider':
            return (
              <div key={block.id} className={`wiki-divider wiki-divider--${block.style}`} role="separator">
                {block.style === 'estrelas' && <span aria-hidden="true">✦ ✧ ✦</span>}
              </div>
            );

          case 'collection':
            return (
              <section key={block.id} className="collection" aria-label={block.title || 'Coleção'}>
                {block.title && <h3 className="collection__title">{block.title}</h3>}
                {block.items.length === 0 ? (
                  <p className="wiki-empty">Nenhum item ainda.</p>
                ) : (
                  block.statuses.map((status) => {
                    const items = block.items.filter((it) => it.status === status);
                    if (items.length === 0) return null;
                    return (
                      <div key={status} className="collection__group">
                        <h4 className="collection__status">{status}</h4>
                        <ul className="collection__grid">
                          {items.map((it) => (
                            <li key={it.id} className="collection__item">
                              <span className="collection__name">{it.name}</span>
                              {it.note && <span className="collection__note">{it.note}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })
                )}
              </section>
            );

          case 'blog':
            return (
              <section key={block.id} className="wiki-blog" aria-label="Blog">
                {posts.length === 0 ? (
                  <p className="wiki-empty">
                    Nenhum post vinculado ainda. Ao compor um post, escolha esta wiki em “Vincular a uma wiki”.
                  </p>
                ) : (
                  <ol className="wiki-blog__list">
                    {posts.map((p) => (
                      <li key={p.id} className="wiki-blog__item">
                        <time dateTime={p.created_at}>{dateFmt.format(new Date(p.created_at))}</time>
                        <Link href={`/post/${p.id}`} className="wiki-blog__title">
                          {postTitle(p.body)}
                        </Link>
                        {postExcerpt(p.body) && <p>{postExcerpt(p.body)}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
