'use client';

import { EditorContent, useEditor, type Content } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Toolbar } from './Toolbar';

type Props = {
  initial: unknown;
  label: string;
  onChange: (doc: unknown) => void;
};

/** Editor de texto rico reutilizável (blocos de texto das wikis). */
export function RichEditor({ initial, label, onChange }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
    ],
    content: initial as Content,
    editorProps: {
      attributes: {
        class: 'composer__editor composer__editor--compact rich',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label,
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  return (
    <div className="composer">
      <Toolbar editor={editor} label={`Formatação: ${label}`} />
      <EditorContent editor={editor} />
    </div>
  );
}
