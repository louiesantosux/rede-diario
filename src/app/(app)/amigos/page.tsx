import type { Metadata } from 'next';
import { ComingSoon } from '@/components/ComingSoon';

export const metadata: Metadata = { title: 'Amigos' };

export default function Page() {
  return <ComingSoon title="Amigos" icon="friends" stage="Etapa 4" items={['Busca por @usuário', 'Pedidos de amizade', 'Bloqueio silencioso']} />;
}
