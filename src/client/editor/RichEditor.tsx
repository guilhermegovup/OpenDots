import { useEffect, useRef } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { Markdown } from '@tiptap/markdown';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Code2,
  Undo2,
  Redo2,
  Link2,
} from 'lucide-react';
import { documentExtensions } from './markdown';
import { SlashCommands } from './slash-commands';
import { openPageLink } from '../page-navigation';
export default function RichEditor({
  value,
  onChange,
  onNotice,
}: {
  value: string;
  onChange: (value: string) => void;
  onNotice: (message: string) => void;
}) {
  const change = useRef(onChange);
  change.current = onChange;
  const notice = useRef(onNotice);
  notice.current = onNotice;
  const emitted = useRef(value);
  const editor = useEditor({
    extensions: [
      ...documentExtensions(),
      Markdown,
      Placeholder.configure({
        placeholder: 'Comece a escrever ou digite / para blocos…',
      }),
      SlashCommands,
    ],
    content: value,
    contentType: 'markdown',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'document-prose',
        'aria-label': 'Conteúdo da página',
        role: 'textbox',
        'aria-multiline': 'true',
      },
      handleClick: (_view, _pos, event) => {
        const target =
          event.target instanceof Element ? event.target.closest('a') : null;
        const href = target?.getAttribute('href');
        if (
          href?.startsWith('/#/spaces/') &&
          (event.metaKey || event.ctrlKey)
        ) {
          event.preventDefault();
          openPageLink(href);
          return true;
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const html = event.clipboardData?.getData('text/html') ?? '';
        if (/<(img|iframe|script)\b/i.test(html)) {
          event.preventDefault();
          notice.current(
            'Imagens e conteúdo incorporado não são suportados aqui. Use o código Markdown para manter a marcação original.',
          );
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const markdown = editor.getMarkdown();
      emitted.current = markdown;
      change.current(markdown);
    },
  });
  const state = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            bold: editor.isActive('bold'),
            italic: editor.isActive('italic'),
            bullet: editor.isActive('bulletList'),
            ordered: editor.isActive('orderedList'),
            quote: editor.isActive('blockquote'),
            code: editor.isActive('codeBlock'),
            undo: editor.can().undo(),
            redo: editor.can().redo(),
          }
        : null,
  });
  useEffect(() => {
    if (editor && value !== emitted.current) {
      emitted.current = value;
      editor.commands.setContent(value, {
        contentType: 'markdown',
        emitUpdate: false,
      });
    }
  }, [editor, value]);
  if (!editor) return <div className="editor-loading">Carregando editor…</div>;
  return (
    <>
      <div
        className="format-toolbar"
        role="toolbar"
        aria-label="Formatação de texto"
      >
        <button
          title="Negrito (⌘/Ctrl B)"
          aria-label="Negrito"
          aria-pressed={state?.bold}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={16} />
        </button>
        <button
          title="Itálico (⌘/Ctrl I)"
          aria-label="Itálico"
          aria-pressed={state?.italic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={16} />
        </button>
        <span className="toolbar-divider" />
        <button
          title="Lista com marcadores"
          aria-label="Lista com marcadores"
          aria-pressed={state?.bullet}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={17} />
        </button>
        <button
          title="Lista numerada"
          aria-label="Lista numerada"
          aria-pressed={state?.ordered}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={17} />
        </button>
        <button
          title="Citação"
          aria-label="Citação"
          aria-pressed={state?.quote}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote size={15} />
        </button>
        <button
          title="Bloco de código"
          aria-label="Bloco de código"
          aria-pressed={state?.code}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <Code2 size={17} />
        </button>
        <button
          title="Adicionar link"
          aria-label="Adicionar link"
          onClick={() => {
            const url = window.prompt(
              'URL do link (https:// ou link para uma página interna)',
              editor.getAttributes('link').href ?? '',
            );
            if (url === null) return;
            if (!url) {
              editor.chain().focus().unsetLink().run();
              return;
            }
            if (!/^(https?:\/\/|\/#\/spaces\/)/i.test(url)) {
              onNotice('Use uma URL pública http(s) ou um link para uma página interna.');
              return;
            }
            editor
              .chain()
              .focus()
              .extendMarkRange('link')
              .setLink({ href: url })
              .run();
          }}
        >
          <Link2 size={16} />
        </button>
        <span className="toolbar-divider" />
        <button
          aria-label="Desfazer"
          title="Desfazer"
          disabled={!state?.undo}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 size={16} />
        </button>
        <button
          aria-label="Refazer"
          title="Refazer"
          disabled={!state?.redo}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 size={16} />
        </button>
      </div>
      <EditorContent editor={editor} />
      <p className="editor-hint">
        Digite <kbd>/</kbd> para blocos · ⌘/Ctrl + S para salvar
      </p>
    </>
  );
}
