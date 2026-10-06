import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { TaskActions } from '../src/client/TaskActions';
import type { Settings, Task } from '../src/shared/types';
const settings: Settings = {
  name: 'Dot',
  paused: false,
  researchAllowed: true,
  memoryAllowed: true,
};
const task: Task = {
  id: 'one',
  prompt: 'A recurring task',
  status: 'completed',
  intervalSeconds: 3600,
  nextRunAt: Date.now() + 3600000,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  error: null,
  lease: null,
  leaseUntil: null,
};
it('offers pause for a completed task waiting on its next scheduled run', () => {
  const html = renderToStaticMarkup(
    <TaskActions
      task={task}
      settings={settings}
      busy={false}
      onAction={() => {}}
      onSchedule={() => {}}
    />,
  );
  expect(html).toContain('Pausar agendamento');
  expect(html).toContain('Editar agendamento');
});
it('offers resume for a paused task without claiming to be running', () => {
  const html = renderToStaticMarkup(
    <TaskActions
      task={{ ...task, status: 'paused' }}
      settings={settings}
      busy={false}
      onAction={() => {}}
      onSchedule={() => {}}
    />,
  );
  expect(html).toContain('Retomar tarefa');
  expect(html).not.toContain('Pausar agendamento');
});
it('labels an interrupted task for owner review before retry', () => {
  const html = renderToStaticMarkup(
    <TaskActions
      task={{ ...task, status: 'interrupted' }}
      settings={settings}
      busy={false}
      onAction={() => {}}
      onSchedule={() => {}}
    />,
  );
  expect(html).toContain('Tentar novamente após revisão');
  expect(html).not.toContain('Pausar tarefa');
});
