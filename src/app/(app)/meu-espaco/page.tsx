import type { Metadata } from 'next';
import { ComingSoon } from '@/components/ComingSoon';

export const metadata: Metadata = { title: 'Meu espaço' };

export default function Page() {
  return <ComingSoon title="Meu espaço" icon="user" stage="Etapa 2" items={['Perfil customizável', 'Wikis e páginas com editor de blocos', 'Coleções (tenho, quero, já tive)']} />;
}
