import type { ReactNode } from 'react';
import { safeHref, type RTDoc, type RTMark, type RTNode } from '@/lib/richtext';
import type { MediaView } from '@/lib/media';

type Media = Record<string, MediaView>;

// Renderiza o JSON como elementos React. Nenhum HTML vindo do usuário é injetado.

function withMarks(text: ReactNode, marks: RTMark[] | undefined, key: string): ReactNode {
  return (marks ?? []).reduce<ReactNode>((acc, mark, i) => {
    const k = `${key}-m${i}`;
    switch (mark.type) {
      case 'bold':
        return <strong key={k}>{acc}</strong>;
      case 'italic':
        return <em key={k}>{acc}</em>;
      case 'underline':
        return <u key={k}>{acc}</u>;
      case 'strike':
        return <s key={k}>{acc}</s>;
      case 'code':
        return <code key={k}>{acc}</code>;
      case 'link': {
        const href = safeHref(mark.attrs.href);
        return href ? (
          <a key={k} href={href} target="_blank" rel="noopener noreferrer nofollow ugc">
            {acc}
          </a>
        ) : (
          acc
        );
      }
      default:
        return acc;
    }
  }, text);
}

function renderNodes(nodes: RTNode[] | undefined, key: string, media: Media): ReactNode[] {
  return (nodes ?? []).map((node, i) => renderNode(node, `${key}.${i}`, media));
}

function renderNode(node: RTNode, key: string, media: Media): ReactNode {
  switch (node.type) {
    case 'text':
      return withMarks(node.text, node.marks, key);
    case 'paragraph':
      return <p key={key}>{renderNodes(node.content, key, media)}</p>;
    case 'heading':
      return node.attrs.level === 3 ? (
        <h4 key={key}>{renderNodes(node.content, key, media)}</h4>
      ) : (
        <h3 key={key}>{renderNodes(node.content, key, media)}</h3>
      );
    case 'bulletList':
      return <ul key={key}>{renderNodes(node.content, key, media)}</ul>;
    case 'orderedList':
      return (
        <ol key={key} start={node.attrs?.start ?? 1}>
          {renderNodes(node.content, key, media)}
        </ol>
      );
    case 'listItem':
      return <li key={key}>{renderNodes(node.content, key, media)}</li>;
    case 'blockquote':
      return <blockquote key={key}>{renderNodes(node.content, key, media)}</blockquote>;
    case 'codeBlock':
      return (
        <pre key={key}>
          <code>{renderNodes(node.content, key, media)}</code>
        </pre>
      );
    case 'hardBreak':
      return <br key={key} />;
    case 'horizontalRule':
      return <hr key={key} />;
    case 'image': {
      const view = media[node.attrs.mediaId];
      if (!view) return null; // sem permissão ou removida
      return (
        <figure key={key} className="rich__figure">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={view.url}
            alt={node.attrs.alt || view.alt}
            width={view.width ?? undefined}
            height={view.height ?? undefined}
            loading="lazy"
            decoding="async"
          />
        </figure>
      );
    }
    default:
      return null;
  }
}

/** Títulos do post viram h3/h4 para não competir com o título da página. */
export function RichText({ doc, className, media = {} }: { doc: RTDoc; className?: string; media?: Media }) {
  return <div className={['rich', className].filter(Boolean).join(' ')}>{renderNodes(doc.content, 'r', media)}</div>;
}
