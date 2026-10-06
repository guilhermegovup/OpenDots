import { useMemo, useState } from 'react';
import {
  FileText,
  Plus,
  Search,
  LayoutGrid,
  List,
  ArrowUpRight,
} from 'lucide-react';
import type { Page } from '../server/pages';
import type { Space } from '../shared/types';
export function pageExcerpt(content: string) {
  return content
    .replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s*(?:[-+*]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/gm, '')
    .replace(/```[\s\S]*?```/g, 'Bloco de código')
    .replace(/!?\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`|~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
}
export function SpaceLibrary({
  space,
  pages,
  onPage,
  onNew,
}: {
  space: Space;
  pages: Page[];
  onPage: (id: string) => void;
  onNew: () => void;
}) {
  const [query, setQuery] = useState('');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [sort, setSort] = useState('recent');
  const filtered = useMemo(
    () =>
      pages
        .filter((page) =>
          `${page.title} ${page.content}`
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase()),
        )
        .sort((a, b) =>
          sort === 'name'
            ? a.title.localeCompare(b.title)
            : b.updatedAt - a.updatedAt || a.title.localeCompare(b.title),
        ),
    [pages, query, sort],
  );
  return (
    <section
      className="space-library"
      aria-label={`Biblioteca de páginas de ${space.name}`}
    >
      <header className="library-heading">
        <div>
          <span className="library-eyebrow">ESPAÇO</span>
          <h1>{space.name}</h1>
          {space.description && <p>{space.description}</p>}
        </div>
        <button className="document-primary" onClick={onNew}>
          <Plus size={17} /> Nova página
        </button>
      </header>
      <div className="library-tools">
        <label className="library-search">
          <Search size={17} />
          <input
            aria-label="Buscar páginas"
            placeholder="Buscar páginas"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="library-sort">
          <span className="sr-only">Ordenar páginas</span>
          <select
            aria-label="Ordenar páginas"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="recent">Editadas recentemente</option>
            <option value="name">Nome A–Z</option>
          </select>
        </label>
        <div
          className="library-view-toggle"
          role="group"
          aria-label="Visualização da biblioteca"
        >
          <button
            aria-label="Visualização em grade"
            aria-pressed={layout === 'grid'}
            onClick={() => setLayout('grid')}
          >
            <LayoutGrid size={17} />
          </button>
          <button
            aria-label="Visualização em lista"
            aria-pressed={layout === 'list'}
            onClick={() => setLayout('list')}
          >
            <List size={18} />
          </button>
        </div>
      </div>
      <div className="library-section-label">
        <h2>{query ? 'Resultados da busca' : 'Todas as páginas'}</h2>
        <span>
          {filtered.length} {filtered.length === 1 ? 'página' : 'páginas'}
        </span>
      </div>
      {filtered.length ? (
        <div className={`library-pages ${layout}`}>
          {filtered.map((page) => (
            <button
              className="library-page-card"
              key={page.id}
              onClick={() => onPage(page.id)}
            >
              <span className="library-page-icon">
                <FileText size={20} strokeWidth={1.5} />
              </span>
              <div className="library-card-body">
                <h3>{page.title}</h3>
                <p>
                  {pageExcerpt(page.content) ||
                    'Uma página vazia, pronta para escrever.'}
                </p>
                <div className="library-page-meta">
                  <span title={new Date(page.updatedAt).toLocaleString()}>
                    Editada em{' '}
                    {new Date(page.updatedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  {page.parentId && (
                    <span className="library-parent">
                      {
                        pages.find((parent) => parent.id === page.parentId)
                          ?.title
                      }
                    </span>
                  )}
                </div>
              </div>
              <ArrowUpRight className="library-card-arrow" size={15} />
            </button>
          ))}
        </div>
      ) : (
        <div className="library-empty">
          <FileText size={30} strokeWidth={1.3} />
          <h2>{query ? 'Nenhuma página encontrada' : 'Nenhuma página ainda'}</h2>
          <p>
            {query
              ? 'Tente outro título ou frase.'
              : 'Crie sua primeira página para começar a organizar este Espaço.'}
          </p>
          {!query && (
            <button className="document-primary" onClick={onNew}>
              <Plus size={16} /> Nova página
            </button>
          )}
        </div>
      )}
    </section>
  );
}
