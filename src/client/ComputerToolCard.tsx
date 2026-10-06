import { useEffect, useState } from 'react';
import { ArrowUpRight, FileText, Monitor, Terminal } from 'lucide-react';
import { z } from 'zod';
import { api } from './api';

const screenSchema = z.object({
  base64: z
    .string()
    .regex(/^[A-Za-z0-9+/=]+$/)
    .max(4_000_000),
  url: z.string(),
});
export type ComputerToolRenderProps = {
  name: string;
  toolCallId: string;
  status: string;
  args?: unknown;
  result?: unknown;
};
const labels: Record<string, string> = {
  navigate: 'Abrindo site',
  snapshot: 'Inspecionando o navegador',
  read: 'Lendo a página',
  screenshot: 'Visualizando o navegador',
  click: 'Clicando no navegador',
  type: 'Digitando no navegador',
  key: 'Usando o teclado',
  scroll: 'Rolando a página',
  files_write: 'Salvando arquivo',
  files_read: 'Lendo arquivo',
  files_list: 'Listando arquivos',
  exec: 'Executando comando no terminal',
};
export function computerToolResult(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return { error: raw };
    }
  }
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? Object.fromEntries(Object.entries(raw))
    : {};
}
export function ComputerToolCard({
  name,
  status,
  args,
  result,
  dotId,
  dotName,
  showScreen,
  running,
  onExpand,
}: ComputerToolRenderProps & {
  dotId: string;
  dotName: string;
  showScreen: boolean;
  running: boolean;
  onExpand?: () => void;
}) {
  const [screen, setScreen] = useState<z.infer<typeof screenSchema>>();
  const [screenError, setScreenError] = useState('');
  const action = name.replace(/^computer_/, '');
  const data = computerToolResult(result);
  const parameters = computerToolResult(args);
  const interrupted =
    data.status === 'stopped' || data.reason === 'stop_requested';
  const error =
    typeof data.error === 'string'
      ? data.error
      : data.status === 'error' && typeof data.message === 'string'
        ? data.message
        : '';
  const interruption =
    interrupted && typeof data.message === 'string' ? data.message : '';
  const complete = status === 'complete';
  const failed =
    data.status === 'error' ||
    !!error ||
    (typeof data.exitCode === 'number' && data.exitCode !== 0);
  const state = interrupted
    ? 'Interrompido'
    : failed
      ? 'Requer atenção'
      : complete
        ? 'Concluído'
        : running
          ? 'Em andamento'
          : 'Interrompido';
  const detail =
    typeof parameters.url === 'string'
      ? parameters.url
      : typeof parameters.path === 'string'
        ? parameters.path
        : '';
  useEffect(() => {
    if (!showScreen) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    setScreen(undefined);
    setScreenError('');
    const refresh = async () => {
      if (!document.hidden) {
        try {
          const value = await api<unknown>(
            `/dots/${encodeURIComponent(dotId)}/computer/actions`,
            'POST',
            { action: 'screenshot', input: {} },
            controller.signal,
          );
          const next = screenSchema.parse(value);
          if (!controller.signal.aborted) {
            setScreen(next);
            setScreenError('');
          }
        } catch (cause) {
          if (!controller.signal.aborted) {
            setScreen(undefined);
            setScreenError(
              cause instanceof Error
                ? cause.message
                : 'Prévia do computador indisponível.',
            );
          }
        }
      }
      if (!controller.signal.aborted)
        timer = setTimeout(() => void refresh(), 3000);
    };
    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [dotId, showScreen]);
  const Icon =
    action === 'exec'
      ? Terminal
      : action.startsWith('files_')
        ? FileText
        : Monitor;
  return (
    <section
      className={`inline-computer ${showScreen ? 'with-screen' : ''}`}
      aria-label={`Computador de ${dotName}: ${labels[action] ?? action}`}
    >
      <header>
        <Icon size={16} aria-hidden="true" />
        <strong>{labels[action] ?? 'Usando o computador'}</strong>
        <span className={failed ? 'tool-state failed' : 'tool-state'}>
          {state}
        </span>
        {onExpand && (
          <button
            type="button"
            aria-label={`Expandir computador de ${dotName}`}
            onClick={onExpand}
          >
            <ArrowUpRight size={16} />
          </button>
        )}
      </header>
      {detail && (
        <div className="inline-computer-detail" title={detail}>
          {detail}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {interruption && <p role="status">{interruption}</p>}
      {action === 'exec' && complete && typeof data.stdout === 'string' && (
        <pre aria-label="Saída do terminal do computador">
          {data.stdout.slice(0, 4000)}
        </pre>
      )}
      {action === 'exec' &&
        complete &&
        typeof data.stderr === 'string' &&
        data.stderr && <pre>{data.stderr.slice(0, 2000)}</pre>}
      {showScreen && (
        <div className="inline-computer-preview">
          <div className="inline-computer-caption">
            <span className="live-indicator" />
            Computador de {dotName} · Visão atual do navegador
          </div>
          {screen && (
            <img
              src={`data:image/png;base64,${screen.base64}`}
              alt={`Visão atual do navegador no computador de ${dotName}`}
            />
          )}
          {screenError ? (
            <p role="status">{screenError}</p>
          ) : (
            !screen && <p role="status">Conectando ao computador…</p>
          )}
          {screen && <div className="inline-computer-url">{screen.url}</div>}
        </div>
      )}
    </section>
  );
}
