import type { Metadata } from 'next';
import Link from 'next/link';
import { Window } from '@/components/Window';
import { Icon, type IconName } from '@/components/Icon';

export const metadata: Metadata = { title: 'Criar' };

type Option = { href?: string; icon: IconName; title: string; text: string; soon?: string };

// Menu no estilo "Iniciar" do Windows 7: o que pode ser criado.
const OPTIONS: Option[] = [
  { href: '/criar/post', icon: 'pen', title: 'Post', text: 'Um texto para o seu diário ou para os amigos.' },
  { href: '/criar/wiki', icon: 'book', title: 'Wiki', text: 'Coleções, listas e páginas sobre o que você ama.' },
  { icon: 'image', title: 'Imagem ou moodboard', text: 'Envie fotos e ajuste cores e luz.', soon: 'Etapa 3' },
  { icon: 'music', title: 'Playlist', text: 'Músicas do YouTube reunidas por você.', soon: 'Etapa 5' },
  { icon: 'pin', title: 'Encontro no mapa', text: 'Um evento privado só com amigos.', soon: 'Etapa 6' },
];

export default function CriarPage() {
  return (
    <main id="conteudo" className="page page--narrow">
      <Window title="Criar" icon="plus" headingLevel={1}>
        <ul className="start-menu">
          {OPTIONS.map((opt) => {
            const inner = (
              <>
                <span className="start-menu__icon">
                  <Icon name={opt.icon} />
                </span>
                <span className="start-menu__text">
                  <span className="start-menu__title">{opt.title}</span>
                  <span className="start-menu__hint">{opt.soon ? `Em breve (${opt.soon})` : opt.text}</span>
                </span>
              </>
            );
            return (
              <li key={opt.title}>
                {opt.href ? (
                  <Link href={opt.href} className="start-menu__item">
                    {inner}
                  </Link>
                ) : (
                  <span className="start-menu__item start-menu__item--soon" aria-disabled="true">
                    {inner}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </Window>
    </main>
  );
}
