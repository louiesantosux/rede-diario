import type { Metadata } from 'next';
import { ComingSoon } from '@/components/ComingSoon';

export const metadata: Metadata = { title: 'Conta e segurança' };

export default function Page() {
  return <ComingSoon title="Conta e segurança" icon="lock" stage="Etapa 1b" items={['Verificação em duas etapas (TOTP)', 'Confirmação de login em dispositivo novo', 'Lista de sessões ativas']} />;
}
