import type { Metadata } from 'next';
import Link from 'next/link';
import { Window } from '@/components/Window';
import { Notice } from '@/components/Notice';
import { NOTICES, pickMessage } from '@/lib/messages';
import { signOut } from '../../(auth)/actions';

export const metadata: Metadata = { title: 'Ajustes' };

const SECTIONS = [
  { href: '/configuracoes/acessibilidade', title: 'Acessibilidade', text: 'Tema, tamanho do texto, fonte, movimento e modo leitura.' },
  { href: '/configuracoes/seguranca', title: 'Conta e segurança', text: 'Senha, verificação em duas etapas e dispositivos.' },
  { href: '/configuracoes/privacidade', title: 'Privacidade', text: 'Visibilidade do perfil e pedidos de amizade.' },
  { href: '/configuracoes/bem-estar', title: 'Bem-estar e notificações', text: 'Missões, pausas e horário de silêncio.' },
];

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ConfiguracoesPage({ searchParams }: Props) {
  const sp = await searchParams;
  return (
    <main id="conteudo" className="page">
      <Notice ok={pickMessage(NOTICES, sp.aviso)} />
      <Window title="Ajustes" icon="gear" headingLevel={1}>
        <div className="stack">
          <Link href="/meu-espaco">← Voltar para Meu espaço</Link>
          <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {SECTIONS.map((s) => (
              <li key={s.href} className="card">
                <Link href={s.href} style={{ fontWeight: 700 }}>
                  {s.title}
                </Link>
                <p className="muted" style={{ margin: 0 }}>
                  {s.text}
                </p>
              </li>
            ))}
          </ul>
          <form action={signOut}>
            <button type="submit" className="btn">
              Sair da conta
            </button>
          </form>
        </div>
      </Window>
    </main>
  );
}
