import type { ReactNode } from 'react';
import { safeHref, type RTDoc, type RTMark, type RTNode } from '@/lib/richtext';

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

function renderNodes(nodes: RTNode[] | undefined, key: string): ReactNode[] {
  return (nodes ?? []).map((node, i) => renderNode(node, `${key}.${i}`));
}

function renderNode(node: RTNode, key: string): ReactNode {
  switch (node.type) {
    case 'text':
      return withMarks(node.text, node.marks, key);
    case 'paragraph':
      return <p key={key}>{renderNodes(node.content, key)}</p>;
    case 'heading':
      return node.attrs.level === 3 ? (
        <h4 key={key}>{renderNodes(node.content, key)}</h4>
      ) : (
        <h3 key={key}>{renderNodes(node.content, key)}</h3>
      );
    case 'bulletList':
      return <ul key={key}>{renderNodes(node.content, key)}</ul>;
    case 'orderedList':
      return (
        <ol key={key} start={node.attrs?.start ?? 1}>
          {renderNodes(node.content, key)}
        </ol>
      );
    case 'listItem':
      return <li key={key}>{renderNodes(node.content, key)}</li>;
    case 'blockquote':
      return <blockquote key={key}>{renderNodes(node.content, key)}</blockquote>;
    case 'codeBlock':
      return (
        <pre key={key}>
          <code>{renderNodes(node.content, key)}</code>
        </pre>
      );
    case 'hardBreak':
      return <br key={key} />;
    case 'horizontalRule':
      return <hr key={key} />;
    default:
      return null;
  }
}

/** Títulos do post viram h3/h4 para não competir com o título da página. */
export function RichText({ doc, className }: { doc: RTDoc; className?: string }) {
  return <div className={['rich', className].filter(Boolean).join(' ')}>{renderNodes(doc.content, 'r')}</div>;
}
