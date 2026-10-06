import { Extension, type Editor, type Range } from '@tiptap/core';
import Suggestion, {
  exitSuggestion,
  type SuggestionProps,
} from '@tiptap/suggestion';
interface Block {
  title: string;
  description: string;
  /** Extra search terms (English names kept so existing queries still match). */
  keywords: string;
  run: (editor: Editor, range: Range) => void;
}
const command =
  (action: (editor: Editor) => void) => (editor: Editor, range: Range) => {
    editor.chain().focus().deleteRange(range).run();
    action(editor);
  };
export const blocks: Block[] = [
  {
    title: 'Texto',
    description: 'Comece com um parágrafo simples',
    keywords: 'text paragraph',
    run: command((e) => e.chain().setParagraph().run()),
  },
  ...([1, 2, 3] as const).map((level) => ({
    title: `Título ${level}`,
    description:
      level === 1
        ? 'Um título de seção grande'
        : level === 2
          ? 'Um título de seção médio'
          : 'Um título de seção pequeno',
    keywords: `heading ${level}`,
    run: command((e) => e.chain().setHeading({ level }).run()),
  })),
  {
    title: 'Lista com marcadores',
    description: 'Uma lista simples não ordenada',
    keywords: 'bullet list',
    run: command((e) => e.chain().toggleBulletList().run()),
  },
  {
    title: 'Lista numerada',
    description: 'Uma sequência ordenada',
    keywords: 'numbered list',
    run: command((e) => e.chain().toggleOrderedList().run()),
  },
  {
    title: 'Lista de tarefas',
    description: 'Acompanhe o que precisa ser feito',
    keywords: 'checklist todo checkbox',
    run: command((e) => e.chain().toggleTaskList().run()),
  },
  {
    title: 'Citação',
    description: 'Destaque um trecho',
    keywords: 'quote blockquote',
    run: command((e) => e.chain().toggleBlockquote().run()),
  },
  {
    title: 'Código',
    description: 'Um bloco de código',
    keywords: 'code',
    run: command((e) => e.chain().toggleCodeBlock().run()),
  },
  {
    title: 'Divisor',
    description: 'Separe seções',
    keywords: 'divider separator hr',
    run: command((e) => e.chain().setHorizontalRule().run()),
  },
  {
    title: 'Tabela',
    description: 'Três colunas com cabeçalho',
    keywords: 'table',
    run: command((e) =>
      e.chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    ),
  },
];
export const SlashCommands = Extension.create({
  name: 'slashCommands',
  addProseMirrorPlugins() {
    return [
      Suggestion<Block>({
        editor: this.editor,
        char: '/',
        startOfLine: true,
        allowedPrefixes: null,
        items: ({ query }) =>
          blocks.filter((block) =>
            `${block.title} ${block.description} ${block.keywords}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          ),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => {
          let menu: HTMLDivElement | undefined;
          let current: SuggestionProps<Block> | undefined;
          let index = 0;
          const close = () => {
            menu?.remove();
            menu = undefined;
            const dom = current?.editor.view.dom;
            dom?.removeAttribute('aria-controls');
            dom?.removeAttribute('aria-activedescendant');
            dom?.removeAttribute('aria-autocomplete');
            document.removeEventListener('pointerdown', outside);
          };
          const outside = (event: PointerEvent) => {
            if (menu && !menu.contains(event.target as Node)) {
              if (current) exitSuggestion(current.editor.view);
              close();
            }
          };
          const paint = () => {
            if (!menu || !current) return;
            const props = current;
            menu.replaceChildren();
            const label = document.createElement('div');
            label.className = 'slash-menu-label';
            label.textContent = 'INSERIR BLOCO';
            menu.append(label);
            if (!props.items.length) {
              const empty = document.createElement('p');
              empty.textContent = 'Nenhum bloco encontrado';
              menu.append(empty);
            }
            props.items.forEach((item, i) => {
              const button = document.createElement('button');
              button.type = 'button';
              button.id = `slash-block-${i}`;
              button.setAttribute('role', 'option');
              button.setAttribute('aria-selected', String(i === index));
              button.className = i === index ? 'selected' : '';
              const title = document.createElement('strong');
              title.textContent = item.title;
              const description = document.createElement('span');
              description.textContent = item.description;
              button.append(title, description);
              button.addEventListener('mousedown', (event) =>
                event.preventDefault(),
              );
              button.addEventListener('click', () => props.command(item));
              menu!.append(button);
            });
            const rect = props.clientRect?.();
            if (rect) {
              menu.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - 332))}px`;
              menu.style.top = `${Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 360))}px`;
            }
            props.editor.view.dom.setAttribute(
              'aria-activedescendant',
              `slash-block-${index}`,
            );
            menu
              .querySelector('.selected')
              ?.scrollIntoView({ block: 'nearest' });
          };
          return {
            onStart: (props) => {
              current = props;
              index = 0;
              menu = document.createElement('div');
              menu.id = 'document-block-menu';
              menu.className = 'slash-menu';
              menu.setAttribute('role', 'listbox');
              menu.setAttribute('aria-label', 'Inserir bloco');
              document.body.append(menu);
              props.editor.view.dom.setAttribute('aria-controls', menu.id);
              props.editor.view.dom.setAttribute('aria-autocomplete', 'list');
              document.addEventListener('pointerdown', outside);
              paint();
            },
            onUpdate: (props) => {
              current = props;
              index = 0;
              paint();
            },
            onExit: close,
            onKeyDown: ({ event, view }) => {
              if (event.isComposing || view.composing || event.keyCode === 229)
                return false;
              if (event.key === 'Escape') {
                exitSuggestion(view);
                close();
                return true;
              }
              if (!current?.items.length) return false;
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                index =
                  (index +
                    (event.key === 'ArrowDown' ? 1 : -1) +
                    current.items.length) %
                  current.items.length;
                paint();
                return true;
              }
              if (event.key === 'Enter') {
                current.command(current.items[index]);
                return true;
              }
              return false;
            },
          };
        },
      }),
    ];
  },
});
