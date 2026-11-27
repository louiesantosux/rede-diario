'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PER_CALL = 100;

export type DeleteMediaResult = { ok: true; deleted: number } | { ok: false; error: string };

/**
 * Apaga imagens da galeria: os arquivos (editado e original) e o registro.
 * O banco tira a imagem de posts, moodboards e do espaço (gatilho media_forget).
 */
export async function deleteMedia(ids: string[]): Promise<DeleteMediaResult> {
  const wanted = Array.from(new Set(ids.filter((id) => typeof id === 'string' && UUID_RE.test(id)))).slice(0, MAX_PER_CALL);
  if (wanted.length === 0) return { ok: false, error: 'Nenhuma imagem selecionada.' };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };

  const { data: rows, error: readError } = await supabase
    .from('media')
    .select('id, storage_path, original_path')
    .eq('owner_id', userId)
    .in('id', wanted);
  if (readError || !rows?.length) return { ok: false, error: 'Não encontramos essas imagens na sua galeria.' };

  const paths = rows.flatMap((r) => [r.storage_path as string, r.original_path as string | null].filter((p): p is string => Boolean(p)));
  const { error: storageError } = await supabase.storage.from('media').remove(paths);
  if (storageError) console.error('[deleteMedia/storage]', storageError.message);

  const { error } = await supabase
    .from('media')
    .delete()
    .eq('owner_id', userId)
    .in(
      'id',
      rows.map((r) => r.id as string),
    );
  if (error) {
    console.error('[deleteMedia]', error.code, error.message);
    return { ok: false, error: 'Não foi possível apagar. Tente novamente.' };
  }

  revalidatePath('/meu-espaco');
  revalidatePath('/meu-espaco/galeria');
  return { ok: true, deleted: rows.length };
}
