import { ORNAMENT_GLYPHS, ORNAMENT_SPOTS, type SpaceTheme } from '@/lib/space';

/** Enfeites decorativos espalhados pelas bordas do espaço (só visuais). */
export function SpaceOrnaments({ ornament, scale = 1 }: { ornament: SpaceTheme['ornament']; scale?: number }) {
  if (ornament === 'nenhum') return null;
  const glyphs = ORNAMENT_GLYPHS[ornament];
  return (
    <div className="space-ornaments" aria-hidden="true">
      {ORNAMENT_SPOTS.map((spot, i) => (
        <span
          key={i}
          style={{
            top: `${spot.top}%`,
            left: `${spot.left}%`,
            fontSize: `${spot.size * scale}rem`,
            transform: `translate(-50%, -50%) rotate(${spot.rot}deg)`,
          }}
        >
          {glyphs[i % glyphs.length]}
        </span>
      ))}
    </div>
  );
}
