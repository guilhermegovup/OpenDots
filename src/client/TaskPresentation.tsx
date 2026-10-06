import {
  CheckCheck,
  ChevronRight,
  LoaderCircle,
  MessageCircle,
} from 'lucide-react';
import type { Task } from '../shared/types';
import { Mascot } from './Mascot';
export const relative = (value: number) => {
  const minutes = Math.floor((Date.now() - value) / 60000);
  return minutes < 1
    ? 'Agora mesmo'
    : minutes < 60
      ? `há ${minutes} min`
      : minutes < 1440
        ? `há ${Math.floor(minutes / 60)} h`
        : new Date(value).toLocaleDateString('pt-BR');
};
const statusNames: Record<Task['status'], string> = {
  queued: 'Na fila',
  running: 'Em execução',
  paused: 'Pausada',
  completed: 'Concluída',
  failed: 'Falhou',
  interrupted: 'Interrompida',
  cancelled: 'Cancelada',
};
export const statusLabel = (task: Task) =>
  task.status === 'completed' && task.nextRunAt
    ? 'Agendada'
    : (statusNames[task.status] ?? task.status);
export function Status({ task }: { task: Task }) {
  return (
    <span className={`status ${task.status}`}>
      <span />
      {statusLabel(task)}
    </span>
  );
}

export function TaskRow({
  task,
  onClick,
}: {
  task: Task;
  onClick: () => void;
}) {
  return (
    <button className="task-row" onClick={onClick}>
      <span className="task-row-icon">
        {task.status === 'completed' ? (
          <CheckCheck size={19} />
        ) : task.status === 'running' ? (
          <LoaderCircle className="spin" size={19} />
        ) : (
          <MessageCircle size={19} />
        )}
      </span>
      <div>
        <strong>{task.prompt}</strong>
        <span>
          {task.intervalSeconds
            ? `Repete a cada ${task.intervalSeconds < 3600 ? task.intervalSeconds / 60 + ' min' : task.intervalSeconds / 3600 + ' h'} · `
            : ''}
          {relative(task.updatedAt)}
        </span>
      </div>
      <Status task={task} />
      <ChevronRight size={16} />
    </button>
  );
}
export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="large-empty">
      <Mascot />
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}
