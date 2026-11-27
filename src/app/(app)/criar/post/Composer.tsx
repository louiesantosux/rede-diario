'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { Icon } from '@/components/Icon';
import { Toolbar } from '@/components/editor/Toolbar';
import { editorExtensions } from '@/components/editor/extensions';
import { InsertImageDialog, type InsertedImage } from '@/components/editor/InsertImageDialog';
import { createClient } from '@/lib/supabase/client';
import { hydrateDoc } from '@/lib/mediaClient';
import { Notice } from '@/components/Notice';
import { createPost, type ComposeState } from '../actions';

type Visibility = 'private' | 'friends' | 'unlisted' | 'public';
type ReplyPolicy = 'friends' | 'everyone' | 'nobody';

const VISIBILITY_OPTIONS: { value: Visibility; label: string; hint: string }[] = [
  { value: 'private', label: 'Privado', hint: 'Só você vê. Bom para o diário.' },
  { value: 'friends', label: 'Amigos', hint: 'Aparece no início dos seus amigos.' },
  { value: 'unlisted', label: 'Não listado', hint: 'Só quem receber o link consegue abrir.' },
  { value: 'public', label: 'Público', hint: 'Qualquer pessoa com conta pode ler.' },
];

const REPLY_OPTIONS: { value: ReplyPolicy; label: string }[] = [
  { value: 'friends', label: 'Só amigos' },
  { value: 'everyone', label: 'Qualquer pessoa com conta' },
  { value: 'nobody', label: 'Ninguém' },
];

type Draft = { doc: unknown; visibility: Visibility; replyPolicy: ReplyPolicy; savedAt: number };

type Props = {
  missionId: string | null;
  missionPrompt: string | null;
  wikis: { id: string; title: string }[];
  initialWikiId: string | null;
};

export function Composer({ missionId, missionPrompt, wikis, initialWikiId }: Props) {
  const draftKey = `rascunho-post:${missionId ?? 'livre'}`;
  const [visibility, setVisibility] = useState<Visibility>(missionId ? 'private' : 'friends');
  const [replyPolicy, setReplyPolicy] = useState<ReplyPolicy>('friends');
  const [draftStatus, setDraftStatus] = useState<'none' | 'restored' | 'saved'>('none');
  const [imageOpen, setImageOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ComposeState, FormData>(createPost, undefined);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefs = useRef({ visibility, replyPolicy });
  prefs.current = { visibility, replyPolicy };

  const saveDraft = (editor: Editor) => {
    try {
      if (editor.isEmpty) {
        localStorage.removeItem(draftKey);
        return;
      }
      const draft: Draft = { doc: editor.getJSON(), ...prefs.current, savedAt: Date.now() };
      localStorage.setItem(draftKey, JSON.stringify(draft));
      setDraftStatus('saved');
    } catch {
      /* armazenamento indisponível */
    }
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: editorExtensions(),
    editorProps: {
      attributes: {
        class: 'composer__editor rich',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-labelledby': 'composer-label',
        'aria-describedby': 'composer-help',
      },
    },
    onCreate: ({ editor }) => {
      try {
        const raw = localStorage.getItem(draftKey);
        if (!raw) return;
        const draft = JSON.parse(raw) as Draft;
        editor.commands.setContent(draft.doc as Parameters<typeof editor.commands.setContent>[0]);
        setVisibility(draft.visibility);
        setReplyPolicy(draft.replyPolicy);
        setDraftStatus('restored');
        // URLs de imagens no rascunho expiram: gera novas.
        void hydrateDoc(createClient(), draft.doc).then(({ doc, hasImages }) => {
          if (hasImages) editor.commands.setContent(doc as Parameters<typeof editor.commands.setContent>[0]);
        });
      } catch {
        /* rascunho inválido: ignora */
      }
    },
    onUpdate: ({ editor }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveDraft(editor), 600);
    },
  });

  // Salva também quando muda visibilidade ou respostas.
  useEffect(() => {
    if (editor && !editor.isEmpty) saveDraft(editor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibility, replyPolicy]);

  // Se a publicação falhar, o rascunho volta a ser salvo.
  useEffect(() => {
    if (state?.error && editor) saveDraft(editor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const submit = (form: FormData) => {
    if (!editor) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    form.set('body', JSON.stringify(editor.getJSON()));
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* ignora */
    }
    formAction(form);
  };

  const insertImage = (img: InsertedImage) => {
    editor
      ?.chain()
      .focus()
      .insertContent({ type: 'image', attrs: { src: img.url, alt: img.alt, mediaId: img.mediaId } })
      .run();
  };

  const discard = () => {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* ignora */
    }
    editor?.commands.clearContent(true);
    setDraftStatus('none');
    editor?.commands.focus();
  };

  return (
    <form action={submit} className="stack">
      {missionId && <input type="hidden" name="missionId" value={missionId} />}

      {missionPrompt && (
        <div className="card composer__mission">
          <Icon name="star" className="btn__icon" />
          <div>
            <p className="muted" style={{ margin: 0, fontSize: '0.875rem' }}>
              Missão do dia
            </p>
            <p style={{ margin: 0, fontWeight: 600 }}>{missionPrompt}</p>
          </div>
        </div>
      )}

      <Notice error={state?.error} />

      <div className="composer">
        <p id="composer-label" className="composer__label">
          Texto
        </p>
        <Toolbar editor={editor} onImage={() => setImageOpen(true)} />
        <EditorContent editor={editor} />
        <div className="composer__status">
          <span id="composer-help" className="muted">
            Links colados viram links automaticamente. Use o botão de imagem para inserir fotos no texto.
          </span>
          <span className="muted" role="status" aria-live="polite">
            {draftStatus === 'restored' && 'Rascunho recuperado.'}
            {draftStatus === 'saved' && 'Rascunho salvo neste navegador.'}
          </span>
        </div>
      </div>

      <InsertImageDialog open={imageOpen} onClose={() => setImageOpen(false)} onInsert={insertImage} />

      <fieldset className="choice-group">
        <legend>Quem pode ver</legend>
        <div className="choice-grid">
          {VISIBILITY_OPTIONS.map((opt) => (
            <label key={opt.value} className="choice">
              <input
                type="radio"
                name="visibility"
                value={opt.value}
                checked={visibility === opt.value}
                onChange={() => setVisibility(opt.value)}
              />
              <span className="choice__text">
                <span className="choice__label">{opt.label}</span>
                <span className="choice__hint">{opt.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {wikis.length > 0 && (
        <div className="field">
          <label htmlFor="wikiId">Vincular a uma wiki (aparece no blog dela)</label>
          <select id="wikiId" name="wikiId" defaultValue={initialWikiId ?? ''}>
            <option value="">Nenhuma</option>
            {wikis.map((w) => (
              <option key={w.id} value={w.id}>
                {w.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {visibility !== 'private' && (
        <fieldset className="choice-group">
          <legend>Quem pode responder</legend>
          <p className="muted" style={{ margin: '0 0 8px' }}>
            Respostas chegam só para você. Ninguém vê o que os outros responderam.
          </p>
          <div className="row">
            {REPLY_OPTIONS.map((opt) => (
              <label key={opt.value} className="check" style={{ paddingTop: 0, alignItems: 'center', marginRight: 16 }}>
                <input
                  type="radio"
                  name="replyPolicy"
                  value={opt.value}
                  checked={replyPolicy === opt.value}
                  onChange={() => setReplyPolicy(opt.value)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="btn btn--ghost" onClick={discard} disabled={pending}>
          Descartar rascunho
        </button>
        <button type="submit" className="btn btn--primary" disabled={pending || !editor}>
          <Icon name="pen" className="btn__icon" />
          {pending ? 'Publicando…' : visibility === 'private' ? 'Guardar no diário' : 'Publicar'}
        </button>
      </div>
    </form>
  );
}
