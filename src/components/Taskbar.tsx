'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from './Icon';

const ITEMS: { href: string; label: string; icon: IconName; create?: boolean }[] = [
  { href: '/inicio', label: 'Início', icon: 'home' },
  { href: '/meu-espaco', label: 'Meu espaço', icon: 'user' },
  { href: '/criar', label: 'Criar', icon: 'plus', create: true },
  { href: '/mensagens', label: 'Mensagens', icon: 'chat' },
  { href: '/amigos', label: 'Amigos', icon: 'friends' },
  { href: '/configuracoes', label: 'Ajustes', icon: 'gear' },
];

/** Barra de tarefas inspirada no Windows 7: navegação fixa, sem contadores. */
export function Taskbar() {
  const pathname = usePathname();
  return (
    <nav className="taskbar" aria-label="Navegação principal">
      <ul>
        {ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={item.create ? 'taskbar__create' : undefined}
              >
                <Icon name={item.icon} />
                <span className={item.create ? 'sr-only' : undefined}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
