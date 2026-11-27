import type { MediaView } from '@/lib/media';

type Props = { items: MediaView[]; layout?: 'grade' | 'mosaico' | 'post'; label?: string };

/** Grade de imagens. Sem curtidas, sem contadores: só as imagens e a descrição. */
export function MediaGallery({ items, layout = 'post', label = 'Imagens' }: Props) {
  if (items.length === 0) return null;
  return (
    <ul className={`gallery gallery--${layout} gallery--n${Math.min(items.length, 4)}`} aria-label={label}>
      {items.map((m) => (
        <li key={m.id} className="gallery__item">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={m.url}
            alt={m.alt}
            width={m.width ?? undefined}
            height={m.height ?? undefined}
            loading="lazy"
            decoding="async"
          />
        </li>
      ))}
    </ul>
  );
}
