import { Window } from './Window';
import type { IconName } from './Icon';

/** Tela provisória para áreas das próximas etapas, evitando links quebrados na navegação. */
export function ComingSoon({ title, icon, stage, items }: { title: string; icon: IconName; stage: string; items: string[] }) {
  return (
    <main id="conteudo" className="page">
      <Window title={title} icon={icon} headingLevel={1}>
        <p>
          Em construção: chega na <strong>{stage}</strong>.
        </p>
        <ul>
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </Window>
    </main>
  );
}
