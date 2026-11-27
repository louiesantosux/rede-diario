'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { sanitizeBlocks, templatePages, TEMPLATES, type TemplateId } from '@/lib/blocks';
import { THEME_PRESETS, sanitizeTheme, themePasses } from '@/lib/wikiTheme';

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
  const { data: current } = await supabase.from('pages').select('id, wiki_id, title, blocks').eq('id', pageId).single();
  if (!current) return { error: 'Página não encontrada.' };

  // Histórico de versões (RF-15): guarda o estado anterior antes de sobrescrever.
  await supabase.from('page_versions').insert({ page_id: pageId, title: current.title, blocks: current.blocks });

  const { error } = await supabase
    .from('pages')
    .update({ title, blocks, visibility: vis(form.get('visibility')) })
    .eq('id', pageId);

  if (error) {
    console.error('[savePage]', error.code, error.message);
    return { error: 'Não foi possível salvar. Tente novamente.' };
  }
  revalidatePath(`/wiki/${current.wiki_id}`);
  return { ok: 'Página salva.' };
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
  const theme = sanitizeTheme(rawTheme);
  if (!themePasses(theme)) {
    return { error: 'O contraste entre texto e fundo está abaixo do mínimo (4,5:1). Ajuste as cores para salvar.' };
  }

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
  return { ok: 'Wiki atualizada.' };
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
  const { count } = await supabase.from('pages').select('id', { count: 'exact', head: true }).eq('wiki_id', wikiId);
  if ((count ?? 0) <= 1) redirect(`/wiki/${wikiId}/editar?p=${pageId}&erro=ultima`);

  await supabase.from('pages').delete().eq('id', pageId);
  redirect(`/wiki/${wikiId}`);
}

export async function deleteWiki(form: FormData) {
  const wikiId = uuid(form, 'wikiId');
  if (!wikiId) redirect('/meu-espaco');

  const supabase = await createClient();
  const { data: wiki } = await supabase.from('wikis').select('title').eq('id', wikiId).single();
  if (!wiki || str(form, 'confirm', 120) !== wiki.title) redirect(`/wiki/${wikiId}/ajustes?erro=confirmacao`);

  await supabase.from('wikis').delete().eq('id', wikiId);
  redirect('/meu-espaco?aviso=wiki-excluida');
}
