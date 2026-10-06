import { useEffect, useRef, useState } from 'react';
import { Check, FileText, ArrowUpRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { pageReviewSchema } from '../shared/page-review';
import {
  decidePageReview,
  matchesReviewedDraft,
  restorePageReview,
} from './page-review-decision';
import { openPageLink } from './page-navigation';
import type { ReviewedPage } from '../server/pages';
export function PageReviewCard({
  args,
  status,
  respond,
  threadId,
  toolCallId,
  onSaved,
}: {
  args: unknown;
  status: string;
  result?: unknown;
  respond?: (result: unknown) => Promise<void>;
  threadId: string;
  toolCallId: string;
  onSaved: () => void;
}) {
  const draft = pageReviewSchema.safeParse(args);
  const [savedPage, setSavedPage] = useState<ReviewedPage>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [receiptReady, setReceiptReady] = useState(false);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const pending = useRef(false);
  const finished = status === 'complete';
  const conflict = !!savedPage && !matchesReviewedDraft(savedPage, args);
  const saved = !!savedPage && !conflict;
  const pageId = savedPage?.id ?? '';
  const spaceId = savedPage?.spaceId ?? '';
  useEffect(() => {
    let active = true;
    setReceiptReady(false);
    setSavedPage(undefined);
    setError('');
    void restorePageReview(threadId, toolCallId)
      .then((page) => {
        if (!active) return;
        setSavedPage(page ?? undefined);
        setReceiptReady(true);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : 'Não foi possível restaurar esta revisão.',
          );
      });
    return () => {
      active = false;
    };
  }, [threadId, toolCallId, restoreAttempt]);
  const decide = async (approved: boolean) => {
    if (!respond || !receiptReady || conflict || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const page = await decidePageReview(threadId, toolCallId, args, approved);
      if (!page) {
        await respond({
          approved: false,
          message: 'The owner declined this draft. Do not save it.',
        });
        return;
      }
      setSavedPage(page);
      onSaved();
      await respond({
        approved: true,
        pageId: page.id,
        spaceId: page.spaceId,
        url: `/#/spaces/${page.spaceId}/pages/${page.id}`,
      });
    } catch (cause) {
      setReceiptReady(false);
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível salvar o rascunho aprovado.',
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <section className="page-review-card" aria-label="Revisar rascunho da página">
      <header>
        <FileText size={17} />
        <strong>
          {conflict
            ? 'Revisão alterada'
            : saved
              ? 'Salvo no seu Espaço'
              : !receiptReady
                ? 'Verificando revisão salva…'
                : finished
                  ? 'Revisão encerrada'
                  : 'Pronto para sua revisão'}
        </strong>
        <span>
          {conflict
            ? 'Precisa de nova revisão'
            : saved
              ? 'Aprovado'
              : !receiptReady
                ? 'Verificando'
                : finished
                  ? 'Não salvo'
                  : 'Você decide'}
        </span>
      </header>
      <div className="page-review-body">
        <h3>{draft.success ? draft.data.title : 'Preparando seu rascunho…'}</h3>
        {draft.success && (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              img: ({ alt }) => <span>{alt}</span>,
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noreferrer">
                  {children}
                </a>
              ),
            }}
          >
            {draft.data.content}
          </ReactMarkdown>
        )}
      </div>
      {conflict && (
        <p role="alert">
          Esta revisão foi salva com outro rascunho. Inicie uma nova revisão
          para o rascunho alterado.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {!receiptReady && error && (
        <button
          type="button"
          onClick={() => setRestoreAttempt((attempt) => attempt + 1)}
        >
          Tentar revisar de novo
        </button>
      )}
      <footer>
        {(saved || conflict) && pageId && spaceId && (
          <button
            type="button"
            className="review-primary"
            onClick={() =>
              openPageLink(
                `/#/spaces/${encodeURIComponent(spaceId)}/pages/${encodeURIComponent(pageId)}`,
              )
            }
          >
            {conflict ? 'Abrir página salva' : 'Abrir página'}{' '}
            <ArrowUpRight size={15} />
          </button>
        )}
        {!finished && respond && receiptReady && !conflict && (
          <>
            <button
              type="button"
              disabled={busy || (!saved && !draft.success)}
              className="review-primary"
              onClick={() => void decide(true)}
            >
              <Check size={15} />
              {busy
                ? 'Salvando…'
                : saved
                  ? 'Continuar conversa'
                  : 'Aprovar e salvar'}
            </button>
            {!saved && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void decide(false)}
              >
                Recusar
              </button>
            )}
          </>
        )}
        {!saved && !conflict && (
          <small>
            {!receiptReady
              ? 'Verificando se este rascunho já foi salvo.'
              : finished
                ? 'Nenhuma página foi salva.'
                : 'Nada é salvo até você aprovar.'}
          </small>
        )}
      </footer>
    </section>
  );
}
