'use client';

import { useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import { Icon, type IconName } from '@/components/Icon';
import { LinkDialog } from './LinkDialog';

type ToolButton = {
  label: string;
  icon?: IconName;
  text?: string;
  textStyle?: CSSProperties;
  active?: boolean;
  disabled?: boolean;
  run: () => void;
};

export function Toolbar({
  editor,
  label = 'Formatação do texto',
  onImage,
}: {
  editor: Editor | null;
  label?: string;
  onImage?: () => void;
}) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive('bold') ?? false,
      italic: e?.isActive('italic') ?? false,
      underline: e?.isActive('underline') ?? false,
      strike: e?.isActive('strike') ?? false,
      h2: e?.isActive('heading', { level: 2 }) ?? false,
      h3: e?.isActive('heading', { level: 3 }) ?? false,
      bullet: e?.isActive('bulletList') ?? false,
      ordered: e?.isActive('orderedList') ?? false,
      quote: e?.isActive('blockquote') ?? false,
      link: e?.isActive('link') ?? false,
      canUndo: e?.can().undo() ?? false,
      canRedo: e?.can().redo() ?? false,
    }),
  });

  const [linkOpen, setLinkOpen] = useState(false);
  const chain = () => editor!.chain().focus();
  const groups: ToolButton[][] = [
    [
      { label: 'Negrito', text: 'N', textStyle: { fontWeight: 800 }, active: s?.bold, run: () => chain().toggleBold().run() },
      { label: 'Itálico', text: 'I', textStyle: { fontStyle: 'italic', fontFamily: 'Georgia, serif' }, active: s?.italic, run: () => chain().toggleItalic().run() },
      { label: 'Sublinhado', text: 'S', textStyle: { textDecoration: 'underline' }, active: s?.underline, run: () => chain().toggleUnderline().run() },
      { label: 'Tachado', text: 'abc', textStyle: { textDecoration: 'line-through' }, active: s?.strike, run: () => chain().toggleStrike().run() },
    ],
    [
      { label: 'Título', text: 'T1', textStyle: { fontWeight: 700 }, active: s?.h2, run: () => chain().toggleHeading({ level: 2 }).run() },
      { label: 'Subtítulo', text: 'T2', textStyle: { fontWeight: 600 }, active: s?.h3, run: () => chain().toggleHeading({ level: 3 }).run() },
    ],
    [
      { label: 'Lista com marcadores', icon: 'list', active: s?.bullet, run: () => chain().toggleBulletList().run() },
      { label: 'Lista numerada', icon: 'listOrdered', active: s?.ordered, run: () => chain().toggleOrderedList().run() },
      { label: 'Citação', icon: 'quote', active: s?.quote, run: () => chain().toggleBlockquote().run() },
      { label: s?.link ? 'Editar link' : 'Inserir link', icon: 'link', active: s?.link, run: () => setLinkOpen(true) },
      ...(onImage ? [{ label: 'Inserir imagem', icon: 'image' as IconName, run: onImage }] : []),
    ],
    [
      { label: 'Desfazer', icon: 'undo', disabled: !s?.canUndo, run: () => chain().undo().run() },
      { label: 'Refazer', icon: 'redo', disabled: !s?.canRedo, run: () => chain().redo().run() },
    ],
  ];

  // Padrão ARIA de barra de ferramentas: setas movem o foco entre os botões.
  const moveFocus = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    const next =
      e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  return (
    <>
    <div className="toolbar" role="toolbar" aria-label={label} onKeyDown={moveFocus}>
      {groups.map((group, gi) => (
        <div key={gi} className="toolbar__group">
          {group.map((b) => (
            <button
              key={b.label}
              type="button"
              className="toolbar__btn"
              aria-label={b.label}
              title={b.label}
              aria-pressed={b.active === undefined ? undefined : b.active}
              disabled={!editor || b.disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={b.run}
            >
              {b.icon ? <Icon name={b.icon} /> : <span style={b.textStyle}>{b.text}</span>}
            </button>
          ))}
        </div>
      ))}
    </div>
    <LinkDialog editor={editor} open={linkOpen} onClose={() => setLinkOpen(false)} />
    </>
  );
}
