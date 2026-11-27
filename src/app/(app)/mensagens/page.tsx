import type { Metadata } from 'next';
import { ComingSoon } from '@/components/ComingSoon';

export const metadata: Metadata = { title: 'Mensagens' };

export default function Page() {
  return <ComingSoon title="Mensagens" icon="chat" stage="Etapa 4" items={['Conversas privadas com amigos', 'Respostas recebidas nos seus posts']} />;
}
