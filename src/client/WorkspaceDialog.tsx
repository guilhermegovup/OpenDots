import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Dot, Memory, State, WorkspaceState } from '../shared/types';
export type Dialog =
  | { type: 'space' }
  | { type: 'dot'; dot?: Dot; spaceId: string }
  | { type: 'settings' }
  | { type: 'memory'; memory?: Memory }
  | { type: 'schedule'; threadId: string };
export function WorkspaceDialog({
  dialog,
  state,
  workspace,
  onClose,
  mutate,
}: {
  dialog: Dialog;
  state: State;
  workspace: WorkspaceState;
  onClose: () => void;
  mutate: (path: string, method: string, body?: unknown) => Promise<boolean>;
}) {
  const [name, setName] = useState(
    dialog.type === 'dot' ? (dialog.dot?.name ?? '') : '',
  );
  const [text, setText] = useState(
    dialog.type === 'dot'
      ? (dialog.dot?.instructions ?? '')
      : dialog.type === 'memory'
        ? (dialog.memory?.text ?? '')
        : '',
  );
  const [research, setResearch] = useState(
    dialog.type === 'dot'
      ? (dialog.dot?.researchAllowed ?? true)
      : state.settings.researchAllowed,
  );
  const [memory, setMemory] = useState(
    dialog.type === 'dot'
      ? (dialog.dot?.memoryAllowed ?? true)
      : state.settings.memoryAllowed,
  );
  const [spaceIds, setSpaceIds] = useState(
    dialog.type === 'dot' ? (dialog.dot?.spaceIds ?? [dialog.spaceId]) : [],
  );
  const [defaultSpace, setDefaultSpace] = useState(
    dialog.type === 'dot' ? (dialog.dot?.spaceId ?? dialog.spaceId) : '',
  );
  const [interval, setInterval] = useState('86400');
  const [learningContainer, setLearningContainer] = useState(
    dialog.type === 'dot' ? (dialog.dot?.learningContainerId ?? '') : '',
  );
  const [skillDelivery, setSkillDelivery] = useState(
    dialog.type === 'dot' ? (dialog.dot?.skillDeliveryEnabled ?? false) : false,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const container = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    container.current
      ?.querySelector<HTMLElement>('input,textarea,select')
      ?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const items = [
          ...(container.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]),input,textarea,select,a[href]',
          ) ?? []),
        ];
        if (event.shiftKey && document.activeElement === items[0]) {
          event.preventDefault();
          items.at(-1)?.focus();
        } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
          event.preventDefault();
          items[0]?.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, []);
  const title =
    dialog.type === 'space'
      ? 'Um espaço para algo.'
      : dialog.type === 'dot'
        ? dialog.dot
          ? 'Deixe este Dot do seu jeito.'
          : 'Conheça seu próximo especialista.'
        : dialog.type === 'settings'
          ? 'Seu workspace, suas regras.'
          : dialog.type === 'memory'
            ? 'Algo para lembrar.'
            : 'Deixe seu Dot cuidar do tempo.';
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        ref={container}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close icon-button"
          aria-label="Fechar diálogo"
          onClick={onClose}
        >
          <X size={18} />
        </button>
        <span className="eyebrow">MODELO OPENDOTS</span>
        <h2 id="dialog-title">{title}</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            let path = '',
              method = 'POST',
              body: unknown;
            if (dialog.type === 'space') {
              path = '/spaces';
              body = { name, description: text };
            }
            if (dialog.type === 'dot') {
              path = dialog.dot ? `/dots/${dialog.dot.id}` : '/dots';
              method = dialog.dot ? 'PUT' : 'POST';
              body = {
                spaceId: defaultSpace,
                spaceIds,
                name,
                instructions: text,
                researchAllowed: research,
                memoryAllowed: memory,
                learningContainerId: learningContainer.trim() || null,
                skillDeliveryEnabled: skillDelivery,
              };
            }
            if (dialog.type === 'settings') {
              path = '/settings';
              method = 'PATCH';
              body = { researchAllowed: research, memoryAllowed: memory };
            }
            if (dialog.type === 'memory') {
              path = dialog.memory
                ? `/memories/${dialog.memory.id}`
                : '/memories';
              method = dialog.memory ? 'PUT' : 'POST';
              body = { text };
            }
            if (dialog.type === 'schedule') {
              path = '/tasks';
              body = {
                prompt: text,
                threadId: dialog.threadId,
                intervalSeconds: Number(interval),
              };
            }
            if (await mutate(path, method, body)) onClose();
            else
              setError(
                'Não foi possível salvar. Verifique o erro do workspace e tente novamente.',
              );
            setBusy(false);
          }}
        >
          {(dialog.type === 'space' || dialog.type === 'dot') && (
            <>
              <label className="field-label" htmlFor="entity-name">
                Nome
              </label>
              <input
                id="entity-name"
                value={name}
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </>
          )}
          {dialog.type !== 'settings' && (
            <>
              <label className="field-label" htmlFor="entity-text">
                {dialog.type === 'dot'
                  ? 'Instruções da função'
                  : dialog.type === 'space'
                    ? 'O que fica aqui?'
                    : dialog.type === 'memory'
                      ? 'Preferência ou contexto'
                      : 'Tarefa a retomar'}
              </label>
              <textarea
                id="entity-text"
                rows={4}
                maxLength={dialog.type === 'schedule' ? 4000 : 2000}
                required={dialog.type !== 'space'}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  dialog.type === 'dot'
                    ? 'Você é um parceiro de pesquisa criterioso. Compare evidências e seja claro sobre incertezas.'
                    : ''
                }
              />
            </>
          )}
          {dialog.type === 'dot' && (
            <fieldset className="space-access-fields">
              <legend>Acesso aos espaços</legend>
              <p className="muted">
                Escolha onde este Dot pode ler e editar páginas.
              </p>
              {workspace.spaces.map((space) => (
                <label className="permission-row" key={space.id}>
                  <input
                    type="checkbox"
                    checked={spaceIds.includes(space.id)}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? [...spaceIds, space.id]
                        : spaceIds.filter((id) => id !== space.id);
                      setSpaceIds(next);
                      if (!next.includes(defaultSpace))
                        setDefaultSpace(next[0] ?? '');
                    }}
                  />
                  <span>{space.name}</span>
                </label>
              ))}
              <label className="field-label" htmlFor="default-space">
                Destino padrão das páginas salvas
              </label>
              <select
                id="default-space"
                value={defaultSpace}
                required
                onChange={(event) => setDefaultSpace(event.target.value)}
              >
                <option value="" disabled>
                  Escolha um espaço
                </option>
                {workspace.spaces
                  .filter((space) => spaceIds.includes(space.id))
                  .map((space) => (
                    <option key={space.id} value={space.id}>
                      {space.name}
                    </option>
                  ))}
              </select>
            </fieldset>
          )}
          {(dialog.type === 'dot' || dialog.type === 'settings') && (
            <>
              <label className="permission-row">
                <input
                  type="checkbox"
                  checked={research}
                  onChange={(e) => setResearch(e.target.checked)}
                />
                <span>
                  <strong>Pesquisa em páginas públicas</strong>
                  <small>
                    Permite a ferramenta de navegador somente leitura no
                    servidor. As configurações globais sempre prevalecem.
                  </small>
                </span>
              </label>
              <label className="permission-row">
                <input
                  type="checkbox"
                  checked={memory}
                  onChange={(e) => setMemory(e.target.checked)}
                />
                <span>
                  <strong>Usar memórias salvas</strong>
                  <small>
                    Inclui suas preferências nas novas interações. Alterar a
                    permissão interrompe o trabalho em andamento.
                  </small>
                </span>
              </label>
            </>
          )}
          {dialog.type === 'dot' && (
            <fieldset className="space-access-fields">
              <legend>Aprendizado automático</legend>
              <label className="field-label" htmlFor="learning-container">
                ID do contêiner de aprendizado
              </label>
              <input
                id="learning-container"
                value={learningContainer}
                maxLength={64}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                placeholder="research-workflow"
                aria-describedby="learning-help"
                onChange={(event) => {
                  setLearningContainer(event.target.value);
                  if (!event.target.value.trim()) setSkillDelivery(false);
                }}
              />
              <p className="muted" id="learning-help">
                Crie primeiro este contêiner no seu projeto do Intelligence. As
                novas conversas vão contribuir com evidências para ele. Deixe
                em branco para manter as novas conversas fora do Aprendizado.
                As conversas existentes mantêm a atribuição original.
              </p>
              <label className="permission-row">
                <input
                  type="checkbox"
                  checked={skillDelivery}
                  disabled={!learningContainer.trim()}
                  onChange={(event) => setSkillDelivery(event.target.checked)}
                />
                <span>
                  <strong>Usar skills publicadas</strong>
                  <small>
                    Carrega skills revisadas do contêiner atribuído a cada
                    conversa. Ative a entrega no Intelligence também. Desativar
                    interrompe o carregamento de skills, mas não a coleta de
                    evidências.
                  </small>
                </span>
              </label>
              <a
                href="https://docs.copilotkit.ai/learning"
                target="_blank"
                rel="noreferrer"
              >
                Configurar o Aprendizado e revisar skills ↗
              </a>
            </fieldset>
          )}
          {dialog.type === 'schedule' && (
            <>
              <label className="field-label" htmlFor="schedule-interval">
                Repetir após cada execução bem-sucedida
              </label>
              <select
                id="schedule-interval"
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
              >
                <option value="60">A cada minuto (teste)</option>
                <option value="3600">A cada hora</option>
                <option value="86400">Todo dia</option>
                <option value="604800">Toda semana</option>
              </select>
              <p className="muted">
                Executa no servidor, nesta mesma conversa, mesmo com a aba
                fechada. Execuções com falha ou interrompidas aguardam nova
                tentativa manual. Revise o trabalho concluído antes de repetir
                uma execução interrompida.
              </p>
            </>
          )}
          {dialog.type === 'settings' && (
            <div className="config-note">
              <strong>Configuração dos serviços</strong>
              <p>
                {workspace.setup.missing.length
                  ? `Adicione ${workspace.setup.missing.join(', ')} ao ambiente do servidor e reinicie.`
                  : 'A configuração de texto está presente. Uma conversa bem-sucedida confirma a conectividade.'}
              </p>
              <p>
                Slack: {workspace.setup.slack.replaceAll('_', ' ')}. Voz:{' '}
                {workspace.setup.voice
                  ? 'configuração presente'
                  : 'requer VOICE_API_KEY e VOICE_MODEL'}
                .
              </p>
              <p>
                Metadados de configuração e uso são coletados por padrão.{' '}
                <a
                  href="https://github.com/CopilotKit/OpenDots/blob/main/docs/SETUP-TELEMETRY.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  Detalhes sobre rastreamento e como desativar
                </a>
              </p>
              <a
                href="https://github.com/CopilotKit/OpenDots/blob/main/docs/SETUP.md"
                target="_blank"
                rel="noreferrer"
              >
                Guia de configuração do modelo ↗
              </a>
            </div>
          )}
          {dialog.type === 'memory' && (
            <p className="muted">
              Memórias são preferências explícitas, não aprendizado automático.
              Evite segredos: memórias ativas são enviadas ao seu provedor de
              modelo.
            </p>
          )}
          {error && (
            <p className="chat-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary full" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar'}
          </button>
        </form>
      </section>
    </div>
  );
}
