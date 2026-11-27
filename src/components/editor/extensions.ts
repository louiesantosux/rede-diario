import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';

/**
 * Imagem que guarda a referência `mediaId`. O `src` é só para exibição no editor
 * (URL temporária) e é descartado pelo servidor ao salvar.
 */
export const MediaImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      mediaId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-media-id'),
        renderHTML: (attrs: Record<string, unknown>) => (attrs.mediaId ? { 'data-media-id': String(attrs.mediaId) } : {}),
      },
    };
  },
}).configure({ inline: false, allowBase64: false });

export function editorExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
    }),
    MediaImage,
  ];
}
