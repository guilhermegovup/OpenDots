import { Store } from './store.js';
import type { Result, Memory } from '../shared/types.js';
import type { Claim } from './store.js';
import { research, type Config } from './research.js';
export class Runner {
  private timer?: ReturnType<typeof setInterval>;
  private active = new Map<string, AbortController>();
  constructor(
    private store: Store,
    private config: Config,
    private execute?: (
      claim: Claim,
      memories: Memory[],
      signal: AbortSignal,
      progress: (text: string) => void,
    ) => Promise<Result>,
  ) {}
  start() {
    if (!this.timer) {
      this.timer = setInterval(() => void this.tick(), 1000);
      void this.tick();
    }
  }
  stop() {
    clearInterval(this.timer);
    this.timer = undefined;
    for (const task of this.store.tasks()) {
      if (this.active.has(task.id) && task.lease)
        this.store.interrupt(
          { ...task, lease: task.lease },
          'O servidor parou durante esta execução. Revise o que já foi feito antes de tentar de novo.',
        );
    }
    this.abortAll();
  }
  abort(id: string) {
    this.active.get(id)?.abort(new Error('Execução interrompida.'));
  }
  abortAll() {
    for (const controller of this.active.values())
      controller.abort(
        new Error('Execução interrompida porque as configurações mudaram.'),
      );
  }
  async tick() {
    try {
      await this.runTick();
    } catch {
      // Store errors must not become unhandled interval promise rejections.
      // Do not log task content, provider responses, or database details.
      console.error(
        'Background runner tick failed; will retry on the next tick.',
      );
    }
  }
  private async runTick() {
    if (this.active.size) return;
    const claim = this.store.claim();
    if (!claim) return;
    const controller = new AbortController();
    this.active.set(claim.id, controller);
    const ownershipCheck = setInterval(() => {
      try {
        if (!this.store.owns(claim))
          controller.abort(
            new Error('A permissão ou a reserva da execução foi revogada.'),
          );
      } catch {
        controller.abort(
          new Error('A verificação de posse da execução falhou.'),
        );
      }
    }, 100);
    const timeout = setTimeout(
      () =>
        controller.abort(
          new Error('A pesquisa excedeu o limite de 90 segundos.'),
        ),
      90_000,
    );
    try {
      const settings = this.store.settings();
      const memories = settings.memoryAllowed ? this.store.memories() : [];
      const progress = (text: string) => {
        if (!this.store.owns(claim))
          controller.abort(
            new Error('A permissão ou a reserva da execução foi revogada.'),
          );
        controller.signal.throwIfAborted();
        this.store.event(claim.id, claim.lease, text);
      };
      const result = this.execute
        ? await this.execute(claim, memories, controller.signal, progress)
        : await research(
            claim.prompt,
            memories,
            this.config,
            controller.signal,
            progress,
          );
      controller.signal.throwIfAborted();
      this.store.finish(claim, result);
    } catch (error) {
      this.store.fail(
        claim,
        error instanceof Error
          ? error.message
          : 'Falha inesperada na pesquisa.',
      );
    } finally {
      clearInterval(ownershipCheck);
      clearTimeout(timeout);
      this.active.delete(claim.id);
    }
  }
}
