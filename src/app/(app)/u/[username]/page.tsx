import type { Metadata } from 'next';
import { SpaceView, loadSpace } from '@/components/space/SpaceView';

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const res = await loadSpace(username);
  const s = res?.space;
  return { title: s ? `Espaço de ${s.display_name || `@${s.username}`}` : 'Espaço' };
}

export default async function SpacePage({ params }: Props) {
  const { username } = await params;
  return <SpaceView username={username} />;
}
