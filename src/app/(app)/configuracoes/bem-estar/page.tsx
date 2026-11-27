import type { Metadata } from 'next';
import { ComingSoon } from '@/components/ComingSoon';

export const metadata: Metadata = { title: 'Bem-estar e notificações' };

export default function Page() {
  return <ComingSoon title="Bem-estar e notificações" icon="star" stage="Etapa 2" items={['Ativar ou desativar missões', 'Lembrete de pausa', 'Horário de silêncio']} />;
}
