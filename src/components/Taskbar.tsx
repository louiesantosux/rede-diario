'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from './Icon';

type Item = { href: string; label: string; icon: IconName; also?: string[] };

// Quatro destinos + orbe "Criar" no centro. Ajustes fica dentro de Meu espaço.
const LEFT: Item[] = [
  { href: '/inicio', label: 'Início', icon: 'home' },
  { href: '/meu-espaco', label: 'Meu espaço', icon: 'user', also: ['/configuracoes'] },
];
const RIGHT: Item[] = [
  { href: '/mensagens', label: 'Mensagens', icon: 'chat' },
  { href: '/amigos', label: 'Amigos', icon: 'friends' },
];

const isActive = (pathname: string, item: Item) =>
  [item.href, ...(item.also ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));

/** Barra de tarefas inspirada no Windows 7: navegação fixa, sem contadores. */
export function Taskbar() {
  const pathname = usePathname();

  const renderItem = (item: Item) => (
    <li key={item.href}>
      <Link
        href={item.href}
        className="taskbar__item"
        aria-current={isActive(pathname, item) ? 'page' : undefined}
      >
        <Icon name={item.icon} />
        <span>{item.label}</span>
      </Link>
    </li>
  );

  return (
    <nav className="taskbar" aria-label="Navegação principal">
      <ul>
        {LEFT.map(renderItem)}
        <li className="taskbar__orb-slot">
          <Link
            href="/criar"
            className="taskbar__orb"
            aria-current={pathname.startsWith('/criar') ? 'page' : undefined}
          >
            <Icon name="plus" />
            <span className="sr-only">Criar</span>
          </Link>
        </li>
        {RIGHT.map(renderItem)}
      </ul>
    </nav>
  );
}
