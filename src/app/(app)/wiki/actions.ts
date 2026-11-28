'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { blockMediaIds, sanitizeBlocks, templatePages, TEMPLATES, type TemplateId } from '@/lib/blocks';
import { THEME_PRESETS, sanitizeTheme } from '@/lib/wikiTheme';
import { parseYouTubeId } from '@/lib/youtube';
import { sanitizePageSettings, type PageSettings } from '@/lib/pageSettings';

export type FormState = { error?: string; ok?: string } | undefined;

const VISIBILITIES = ['private', 'friends', 'unlisted', 'public'] as const;
type Visibility = (typeof VISIBILITIES)[number];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const str = (form: FormData, key: string, max: number) => String(form.get(key) ?? '').trim().slice(0, max);
const vis = (v: FormDataEntryValue | null, fallback: Visibility = 'private'): Visibility =>
  VISIBILITIES.includes(v as Visibility) ? (v as Visibility) : fallback;
const uuid = (form: FormData, key: string) => {
  const v = String(form.get(key) ?? '');
  return UUID_RE.test(v) ? v : null;
};

export async function createWiki(form: FormData) {
  const title = str(form, 'title', 120);
  if (!title) redirect('/criar/wiki?erro=titulo');

  const template = (TEMPLATES.find((t) => t.id === form.get('template'))?.id ?? 'branco') as TemplateId;
  const preset = THEME_PRESETS.find((p) => p.id === form.get('preset')) ?? THEME_PRESETS[0];

  const supabase = await createClient();
  const { data: wiki, error } = await supabase
    .from('wikis')
    .insert({
      title,
      description: str(form, 'description', 300),
      visibility: vis(form.get('visibility')),
      theme: preset.theme,
    })
    .select('id')
    .single();

  if (error || !wiki) {
    console.error('[createWiki]', error?.code, error?.message);
    redirect('/criar/wiki?erro=falhou');
  }

  const pages = templatePages(template).map((p, i) => ({
    wiki_id: wiki.id,
    title: p.title,
    blocks: p.blocks,
    position: i,
    // Páginas acompanham a wiki; o dono pode restringir cada uma depois.
    visibility: vis(form.get('visibility')),
  }));
  const { error: pagesError } = await supabase.from('pages').insert(pages);
  if (pagesError) console.error('[createWiki/pages]', pagesError.code, pagesError.message);

  redirect(`/wiki/${wiki.id}`);
}

export async function savePage(_prev: FormState, form: FormData): Promise<FormState> {
  const pageId = uuid(form, 'pageId');
  if (!pageId) return { error: 'Página inválida.' };
  const title = str(form, 'title', 120);
  if (!title) return { error: 'Dê um título à página.' };

  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get('blocks') ?? '[]'));
  } catch {
    return { error: 'Não foi possível ler os blocos.' };
  }
  const blocks = sanitizeBlocks(raw);

  const supabase = await createClient();
  const { data: current } = await supabase
    .from('pages')
    .select('id, wiki_id, title, blocks, theme')
    .eq('id', pageId)
    .single();
  if (!current) return { error: 'Página não encontrada.' };

  // Música de fundo (link do YouTube). Vazio = sem música.
  const settings: PageSettings = sanitizePageSettings(current.theme);
  const musicInput = str(form, 'bgMusic', 500);
  if (!musicInput) {
    settings.bgMusic = null;
  } else {
    const videoId = parseYouTubeId(musicInput);
    if (!videoId) return { error: 'O link da música de fundo não é um link válido do YouTube.' };
    if (settings.bgMusic?.youtubeId !== videoId) {
      let title = 'Música de fundo';
      try {
        const res = await fetch(
          `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`,
          { signal: AbortSignal.timeout(5000), cache: 'no-store' },
        );
        if (res.status === 401 || res.status === 403 || res.status === 404) {
          return { error: 'A música de fundo é um vídeo privado, removido ou que não permite ser incorporado.' };
        }
        if (res.ok) title = ((await res.json()) as { title?: string }).title?.slice(0, 200) || title;
      } catch {
        /* mantém o título padrão */
      }
      settings.bgMusic = { youtubeId: videoId, title };
    }
  }

  // Histórico de versões (RF-15): guarda o estado anterior antes de sobrescrever.
  await supabase.from('page_versions').insert({ page_id: pageId, title: current.title, blocks: current.blocks });

  const { error } = await supabase
    .from('pages')
    .update({ title, blocks, visibility: vis(form.get('visibility')), theme: settings })
    .eq('id', pageId);

  if (error) {
    console.error('[savePage]', error.code, error.message);
    return { error: 'Não foi possível salvar. Tente novamente.' };
  }

  // Mantém o vínculo das imagens com a página (define quem pode vê-las).
  const mediaIds = blockMediaIds(blocks);
  await supabase.from('page_media').delete().eq('page_id', pageId);
  if (mediaIds.length) {
    const { error: mediaError } = await supabase
      .from('page_media')
      .insert(mediaIds.map((media_id) => ({ page_id: pageId, media_id })));
    if (mediaError) {
      console.error('[savePage/media]', mediaError.code, mediaError.message);
      return { error: 'A página foi salva, mas algumas imagens não puderam ser vinculadas.' };
    }
  }
  revalidatePath(`/wiki/${current.wiki_id}`);
  // Volta para a tela anterior (a própria página da wiki), já mostrando o resultado.
  redirect(`/wiki/${current.wiki_id}?p=${pageId}&aviso=pagina-salva`);
}

export async function saveWikiSettings(_prev: FormState, form: FormData): Promise<FormState> {
  const wikiId = uuid(form, 'wikiId');
  if (!wikiId) return { error: 'Wiki inválida.' };
  const title = str(form, 'title', 120);
  if (!title) return { error: 'Dê um título à wiki.' };

  let rawTheme: unknown = {};
  try {
    rawTheme = JSON.parse(String(form.get('theme') ?? '{}'));
  } catch {
    /* usa o padrão */
  }
  // O contraste é recomendado, não obrigatório: a escolha final é de quem personaliza.
  // Visitantes podem usar o "Modo leitura" para ver a página no tema acessível.
  const theme = sanitizeTheme(rawTheme);

  const supabase = await createClient();
  const { error } = await supabase
    .from('wikis')
    .update({ title, description: str(form, 'description', 300), visibility: vis(form.get('visibility')), theme })
    .eq('id', wikiId);

  if (error) {
    console.error('[saveWikiSettings]', error.code, error.message);
    return { error: 'Não foi possível salvar. Tente novamente.' };
  }
  revalidatePath(`/wiki/${wikiId}`);
  redirect(`/wiki/${wikiId}?aviso=wiki-salva`);
}

export async function createPage(form: FormData) {
  const wikiId = uuid(form, 'wikiId');
  if (!wikiId) redirect('/meu-espaco');
  const title = str(form, 'title', 120) || 'Nova página';

  const supabase = await createClient();
  const [{ data: wiki }, { count }] = await Promise.all([
    supabase.from('wikis').select('visibility').eq('id', wikiId).single(),
    supabase.from('pages').select('id', { count: 'exact', head: true }).eq('wiki_id', wikiId),
  ]);

  const { data: page, error } = await supabase
    .from('pages')
    .insert({
      wiki_id: wikiId,
      title,
      blocks: templatePages('branco')[0].blocks,
      position: count ?? 0,
      visibility: wiki?.visibility ?? 'private',
    })
    .select('id')
    .single();

  if (error || !page) {
    console.error('[createPage]', error?.code, error?.message);
    redirect(`/wiki/${wikiId}?erro=pagina`);
  }
  redirect(`/wiki/${wikiId}/editar?p=${page.id}`);
}

export async function deletePage(form: FormData) {
  const wikiId = uuid(form, 'wikiId');
  const pageId = uuid(form, 'pageId');
  if (!wikiId || !pageId) redirect('/meu-espaco');

  const supabase = await createClient();
  const { error } = await supabase.from('pages').delete().eq('id', pageId).eq('wiki_id', wikiId);
  if (error) console.error('[deletePage]', error.code, error.message);
  revalidatePath(`/wiki/${wikiId}`);
  redirect(`/wiki/${wikiId}?aviso=pagina-excluida`);
}

export async function deleteWiki(form: FormData) {
  const wikiId = uuid(form, 'wikiId');
  if (!wikiId) redirect('/meu-espaco');

  const supabase = await createClient();
  const { data: wiki } = await supabase.from('wikis').select('title').eq('id', wikiId).single();
  if (!wiki || str(form, 'confirm', 120) !== wiki.title) redirect(`/wiki/${wikiId}/ajustes?erro=confirmacao`);

  await supabase.from('wikis').delete().eq('id', wikiId);
  redirect('/meu-espaco/editar?aba=conteudos&aviso=wiki-excluida');
}

/** Reordena as páginas da wiki (arrastar e soltar). Recebe os ids na nova ordem. */
export async function reorderPages(wikiId: string, orderedIds: string[]): Promise<{ ok: boolean }> {
  if (!UUID_RE.test(wikiId) || !Array.isArray(orderedIds) || orderedIds.length > 200) return { ok: false };
  const ids = orderedIds.filter((v) => typeof v === 'string' && UUID_RE.test(v));
  const supabase = await createClient();

  const { data: current } = await supabase.from('pages').select('id').eq('wiki_id', wikiId);
  const known = new Set((current ?? []).map((p) => p.id as string));
  if (ids.length !== known.size || ids.some((id) => !known.has(id))) return { ok: false };

  // A RLS só permite atualizar páginas da própria wiki.
  const results = await Promise.all(
    ids.map((id, position) => supabase.from('pages').update({ position }).eq('id', id).eq('wiki_id', wikiId)),
  );
  if (results.some((r) => r.error)) {
    console.error('[reorderPages]', results.find((r) => r.error)?.error?.message);
    return { ok: false };
  }
  revalidatePath(`/wiki/${wikiId}`);
  return { ok: true };
}
