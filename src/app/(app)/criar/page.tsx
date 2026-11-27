import type { Metadata } from 'next';
import { ComingSoon } from '@/components/ComingSoon';

export const metadata: Metadata = { title: 'Criar' };

export default function Page() {
  return <ComingSoon title="Criar" icon="plus" stage="Etapa 2" items={['Novo post', 'Nova wiki ou página', 'Upload de imagem com editor', 'Resposta à missão do dia']} />;
}
