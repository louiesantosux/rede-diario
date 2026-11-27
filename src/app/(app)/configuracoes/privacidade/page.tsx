import type { Metadata } from 'next';
import { ComingSoon } from '@/components/ComingSoon';

export const metadata: Metadata = { title: 'Privacidade' };

export default function Page() {
  return <ComingSoon title="Privacidade" icon="lock" stage="Etapa 4" items={['Visibilidade do perfil', 'Aceitar pedidos de desconhecidos', 'Exportar e excluir dados']} />;
}
