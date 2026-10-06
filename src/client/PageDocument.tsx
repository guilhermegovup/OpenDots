import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ArrowLeft,
  PanelLeft,
  Check,
  LoaderCircle,
  FileCode2,
} from 'lucide-react';
import type { Page } from '../server/pages';
import type { WorkspaceState } from '../shared/types';
import { api } from './api';
import { usePageAutosave } from './editor/use-page-autosave';
import { inspectMarkdown } from './editor/markdown';
import { DocumentMenu } from './editor/DocumentMenu';
import { PageConversation } from './PageConversation';
const RichEditor = lazy(() => import('./editor/RichEditor'));
export function PageDocument({
  page,
  pages,
  workspace,
  paused,
  onHome,
  onOutline,
  onSubpage,
  onDirty,
  onSaved,
  onRefresh,
  onSchedule,
  onThread,
  onSettings,
  onCreateDot,
}: {
  page: Page;
  pages: Page[];
  workspace: WorkspaceState;
  paused: boolean;
  onHome: () => void;
  onOutline: () => void;
  onSubpage: () => void;
  onDirty: (value: boolean) => void;
  onSaved: (page: Page) => void;
  onRefresh: () => void;
  onSchedule: (id: string) => void;
  onThread: (id: string) => void;
  onSettings: () => void;
  onCreateDot: () => void;
}) {
  const { controller, state } = usePageAutosave(page, onSaved);
  const draft = state.draft!;
  const [source, setSource] = useState(false);
  const [move, setMove] = useState(false);
  const [notice, setNotice] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const safety = useMemo(() => inspectMarkdown(draft.content), [draft.content]);
  const sourceMode = source || !safety.supported;
  useEffect(() => {
    onDirty(controller.dirty);
    return () => onDirty(false);
  }, [state, controller, onDirty]);
  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => {
      if (controller.dirty) event.preventDefault();
    };
    const save = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 's' &&
        !event.isComposing
      ) {
        event.preventDefault();
        void controller.flush(true);
      }
    };
    window.addEventListener('beforeunload', leave);
    window.addEventListener('keydown', save);
    return () => {
      window.removeEventListener('beforeunload', leave);
      window.removeEventListener('keydown', save);
    };
  }, [controller]);
  const beforeChat = useCallback(() => controller.flush(true), [controller]);
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([draft.content], { type: 'text/markdown;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `${draft.title.replace(/[^\p{L}\p{N} -]/gu, '').slice(0, 80) || 'page'}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const latest = async () => {
    if (
      !window.confirm(
        'Carregar a última versão salva da página e substituir este rascunho? Baixe o rascunho antes se quiser mantê-lo.',
      )
    )
      return;
    try {
      controller.receive(
        await api<Page>(`/spaces/${page.spaceId}/pages/${page.id}`),
      );
      controller.useLatest();
      setNotice('');
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar a página mais recente. Seu rascunho não foi alterado.',
      );
    }
  };
  const descendants = new Set([page.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of pages)
      if (
        item.parentId &&
        descendants.has(item.parentId) &&
        !descendants.has(item.id)
      ) {
        descendants.add(item.id);
        changed = true;
      }
  }
  const status =
    state.status === 'saving'
      ? 'Salvando…'
      : state.status === 'saved'
        ? 'Todas as alterações salvas'
        : state.status === 'dirty'
          ? 'Alterações não salvas'
          : state.status === 'conflict'
            ? 'Alterações precisam de revisão'
            : 'Não foi possível salvar';
  return (
    <section
      className={`document-session ${chatOpen ? 'chat-visible' : ''}`}
      aria-label="Área do documento"
    >
      <div className="document-column">
        <header className="document-topbar">
          <button className="document-back" onClick={onHome}>
            <ArrowLeft size={16} />
            <span>Todas as páginas</span>
          </button>
          <button
            className="document-icon"
            aria-label="Alternar estrutura da página"
            onClick={onOutline}
          >
            <PanelLeft size={17} />
          </button>
          <span
            className={`document-save-status ${state.status}`}
            role="status"
            aria-live="polite"
          >
            {state.status === 'saved' ? (
              <Check size={13} />
            ) : state.status === 'saving' ? (
              <LoaderCircle size={13} className="saving-spinner" />
            ) : null}
            {status}
          </span>
          <DocumentMenu
            items={[
              {
                label: 'Salvar agora · ⌘/Ctrl S',
                action: () => void controller.flush(true),
              },
              {
                label: sourceMode ? 'Editor visual' : 'Código Markdown',
                action: () => {
                  if (sourceMode && !safety.supported) {
                    setNotice(
                      safety.reason ?? 'Este documento precisa do modo código.',
                    );
                    return;
                  }
                  setSource(!sourceMode);
                },
              },
              { label: 'Mover página', action: () => setMove(!move) },
              { label: 'Nova subpágina', action: onSubpage },
              { label: 'Baixar Markdown', action: download },
              ...(page.sourceThreadId
                ? [
                    {
                      label: 'Abrir conversa de origem',
                      action: () => onThread(page.sourceThreadId!),
                    },
                  ]
                : []),
            ]}
          />
        </header>
        <div className="document-scroll">
          <article className="document-reading-column">
            {state.error && (
              <div
                className={`document-save-notice ${state.status}`}
                role="alert"
              >
                <p>{state.error}</p>
                <div>
                  {state.status === 'error' && (
                    <button onClick={() => void controller.flush(true)}>
                      Tentar salvar de novo
                    </button>
                  )}
                  <button onClick={download}>Baixar rascunho</button>
                  {state.status === 'conflict' && (
                    <button onClick={() => void latest()}>Carregar mais recente</button>
                  )}
                </div>
              </div>
            )}
            {notice && (
              <div className="document-notice" role="status">
                {notice}
                <button onClick={() => setNotice('')}>Dispensar</button>
              </div>
            )}
            {move && (
              <div
                className="document-move"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setMove(false);
                }}
              >
                <label>
                  Mover para
                  <select
                    autoFocus
                    aria-label="Página pai"
                    value={draft.parentId ?? ''}
                    onChange={(e) =>
                      controller.edit({ parentId: e.target.value || null })
                    }
                  >
                    <option value="">Raiz do Espaço</option>
                    {pages
                      .filter((p) => !descendants.has(p.id))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                  </select>
                </label>
                <button onClick={() => setMove(false)}>Concluído</button>
              </div>
            )}
            <input
              className="document-title"
              aria-label="Título da página"
              placeholder="Página sem título"
              maxLength={160}
              value={draft.title}
              onChange={(event) =>
                controller.edit({ title: event.target.value })
              }
            />
            {sourceMode ? (
              <>
                <div className="source-mode-label">
                  <FileCode2 size={15} />
                  <span>Código Markdown</span>
                </div>
                {!safety.supported && (
                  <p className="source-mode-reason">{safety.reason}</p>
                )}
                <textarea
                  className="document-source"
                  aria-label="Markdown da página"
                  spellCheck={false}
                  value={draft.content}
                  maxLength={100000}
                  onChange={(event) =>
                    controller.edit({ content: event.target.value })
                  }
                />
              </>
            ) : (
              <Suspense
                fallback={<div className="editor-loading">Carregando editor…</div>}
              >
                <RichEditor
                  value={draft.content}
                  onChange={(content) => controller.edit({ content })}
                  onNotice={setNotice}
                />
              </Suspense>
            )}
          </article>
        </div>
      </div>
      <div className={`document-assistant ${chatOpen ? 'open' : ''}`}>
        <PageConversation
          page={page}
          workspace={workspace}
          paused={paused}
          beforeChat={beforeChat}
          onRefresh={onRefresh}
          onSchedule={onSchedule}
          onSettings={onSettings}
          onCreateDot={onCreateDot}
          onOpenChange={setChatOpen}
        />
      </div>
    </section>
  );
}
