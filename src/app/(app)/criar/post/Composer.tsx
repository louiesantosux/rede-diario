'use client';

import { useActionState, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Icon, type IconName } from '@/components/Icon';
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

type Props = { missionId: string | null; missionPrompt: string | null };

export function Composer({ missionId, missionPrompt }: Props) {
  const draftKey = `rascunho-post:${missionId ?? 'livre'}`;
  const [visibility, setVisibility] = useState<Visibility>(missionId ? 'private' : 'friends');
  const [replyPolicy, setReplyPolicy] = useState<ReplyPolicy>('friends');
  const [draftStatus, setDraftStatus] = useState<'none' | 'restored' | 'saved'>('none');
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
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
    ],
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
        <Toolbar editor={editor} />
        <EditorContent editor={editor} />
        <div className="composer__status">
          <span id="composer-help" className="muted">
            Links colados viram links automaticamente.
          </span>
          <span className="muted" role="status" aria-live="polite">
            {draftStatus === 'restored' && 'Rascunho recuperado.'}
            {draftStatus === 'saved' && 'Rascunho salvo neste navegador.'}
          </span>
        </div>
      </div>

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

type ToolButton = {
  label: string;
  icon?: IconName;
  text?: string;
  textStyle?: CSSProperties;
  active?: boolean;
  disabled?: boolean;
  run: () => void;
};

function Toolbar({ editor }: { editor: Editor | null }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive('bold') ?? false,
      italic: e?.isActive('italic') ?? false,
      underline: e?.isActive('underline') ?? false,
      strike: e?.isActive('strike') ?? false,
      h2: e?.isActive('heading', { level: 2 }) ?? false,
      h3: e?.isActive('heading', { level: 3 }) ?? false,
      bullet: e?.isActive('bulletList') ?? false,
      ordered: e?.isActive('orderedList') ?? false,
      quote: e?.isActive('blockquote') ?? false,
      canUndo: e?.can().undo() ?? false,
      canRedo: e?.can().redo() ?? false,
    }),
  });

  const chain = () => editor!.chain().focus();
  const groups: ToolButton[][] = [
    [
      { label: 'Negrito', text: 'N', textStyle: { fontWeight: 800 }, active: s?.bold, run: () => chain().toggleBold().run() },
      { label: 'Itálico', text: 'I', textStyle: { fontStyle: 'italic', fontFamily: 'Georgia, serif' }, active: s?.italic, run: () => chain().toggleItalic().run() },
      { label: 'Sublinhado', text: 'S', textStyle: { textDecoration: 'underline' }, active: s?.underline, run: () => chain().toggleUnderline().run() },
      { label: 'Tachado', text: 'abc', textStyle: { textDecoration: 'line-through' }, active: s?.strike, run: () => chain().toggleStrike().run() },
    ],
    [
      { label: 'Título', text: 'T1', textStyle: { fontWeight: 700 }, active: s?.h2, run: () => chain().toggleHeading({ level: 2 }).run() },
      { label: 'Subtítulo', text: 'T2', textStyle: { fontWeight: 600 }, active: s?.h3, run: () => chain().toggleHeading({ level: 3 }).run() },
    ],
    [
      { label: 'Lista com marcadores', icon: 'list', active: s?.bullet, run: () => chain().toggleBulletList().run() },
      { label: 'Lista numerada', icon: 'listOrdered', active: s?.ordered, run: () => chain().toggleOrderedList().run() },
      { label: 'Citação', icon: 'quote', active: s?.quote, run: () => chain().toggleBlockquote().run() },
    ],
    [
      { label: 'Desfazer', icon: 'undo', disabled: !s?.canUndo, run: () => chain().undo().run() },
      { label: 'Refazer', icon: 'redo', disabled: !s?.canRedo, run: () => chain().redo().run() },
    ],
  ];

  // Padrão ARIA de barra de ferramentas: setas movem o foco entre os botões.
  const moveFocus = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    const next =
      e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatação do texto" onKeyDown={moveFocus}>
      {groups.map((group, gi) => (
        <div key={gi} className="toolbar__group">
          {group.map((b) => (
            <button
              key={b.label}
              type="button"
              className="toolbar__btn"
              aria-label={b.label}
              title={b.label}
              aria-pressed={b.active === undefined ? undefined : b.active}
              disabled={!editor || b.disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={b.run}
            >
              {b.icon ? <Icon name={b.icon} /> : <span style={b.textStyle}>{b.text}</span>}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
