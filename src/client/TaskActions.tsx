import { Clock3, Pause, Play, Square } from 'lucide-react';
import type { Action, Settings, Task } from '../shared/types';
export function TaskActions({
  task,
  busy,
  settings,
  onAction,
  onSchedule,
}: {
  task: Task;
  busy: boolean;
  settings: Settings;
  onAction: (action: Action) => void;
  onSchedule: () => void;
}) {
  const active = task.status === 'running' || task.status === 'queued';
  return (
    <div className="task-controls">
      {active ? (
        <button disabled={busy} onClick={() => onAction('pause')}>
          <Pause size={14} />
          Pausar tarefa
        </button>
      ) : (
        <button
          disabled={busy || settings.paused || !settings.researchAllowed}
          onClick={() => onAction('run')}
        >
          <Play size={14} />
          {task.status === 'interrupted'
            ? 'Tentar novamente após revisão'
            : task.status === 'failed'
              ? 'Tentar tarefa novamente'
              : task.status === 'paused'
                ? 'Retomar tarefa'
                : 'Executar novamente'}
        </button>
      )}
      {task.status === 'completed' && !!task.intervalSeconds && (
        <button disabled={busy} onClick={() => onAction('pause')}>
          <Pause size={14} />
          Pausar agendamento
        </button>
      )}
      <button onClick={onSchedule}>
        <Clock3 size={14} />
        {task.intervalSeconds ? 'Editar agendamento' : 'Definir agendamento'}
      </button>
      {task.status !== 'cancelled' && (
        <button
          disabled={busy}
          className="quiet-button"
          onClick={() => onAction('cancel')}
        >
          <Square size={12} />
          Cancelar
        </button>
      )}
    </div>
  );
}
