'use client';

import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, type Content } from '@tiptap/react';
import { createClient } from '@/lib/supabase/client';
import { hydrateDoc } from '@/lib/mediaClient';
import { Toolbar } from './Toolbar';
import { editorExtensions } from './extensions';
import { InsertImageDialog, type InsertedImage } from './InsertImageDialog';

type Props = {
  initial: unknown;
  label: string;
  onChange: (doc: unknown) => void;
};

/** Editor de texto rico reutilizável (blocos de texto das wikis), com imagens. */
export function RichEditor({ initial, label, onChange }: Props) {
  const [imageOpen, setImageOpen] = useState(false);
  const hydrating = useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: editorExtensions(),
    content: initial as Content,
    editorProps: {
      attributes: {
        class: 'composer__editor composer__editor--compact rich',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label,
      },
    },
    onUpdate: ({ editor }) => {
      if (!hydrating.current) onChange(editor.getJSON());
    },
  });

  // Imagens salvas guardam só o id: busca URLs temporárias para exibir no editor.
  useEffect(() => {
    if (!editor) return;
    let alive = true;
    (async () => {
      const { doc, hasImages } = await hydrateDoc(createClient(), editor.getJSON());
      if (!alive || !hasImages) return;
      hydrating.current = true;
      editor.commands.setContent(doc as Content);
      hydrating.current = false;
    })();
    return () => {
      alive = false;
    };
  }, [editor]);

  const insert = (img: InsertedImage) => {
    editor
      ?.chain()
      .focus()
      .insertContent({ type: 'image', attrs: { src: img.url, alt: img.alt, mediaId: img.mediaId } })
      .run();
  };

  return (
    <div className="composer">
      <Toolbar editor={editor} label={`Formatação: ${label}`} onImage={() => setImageOpen(true)} />
      <EditorContent editor={editor} />
      <InsertImageDialog open={imageOpen} onClose={() => setImageOpen(false)} onInsert={insert} />
    </div>
  );
}
