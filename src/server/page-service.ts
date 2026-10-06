import { randomUUID } from 'node:crypto';
import { PageError } from './pages.js';
import type { WorkspaceStore } from './workspace.js';
export interface PageIntelligence {
  getOrCreateThread(input: {
    threadId: string;
    userId: string;
    agentId: string;
    name: string;
  }): Promise<unknown>;
  getThreadMessages(input: {
    threadId: string;
    userId: string;
  }): Promise<{ messages: { role: string; content?: unknown }[] }>;
}
async function bounded<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                'A requisição ao Intelligence expirou. Tente novamente para recuperar a mesma conversa.',
              ),
            ),
          30000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export class PageService {
  private pending = new Map<
    string,
    Promise<ReturnType<WorkspaceStore['requireThread']>>
  >();
  constructor(
    private workspace: WorkspaceStore,
    private intelligence: () => PageIntelligence,
  ) {}
  async conversation(spaceId: string, pageId: string, dotId: string) {
    const page = this.workspace.pages.get(spaceId, pageId);
    const dot = this.workspace.dot(dotId);
    if (!dot || !this.workspace.canAccessSpace(dotId, spaceId))
      throw new PageError(
        'Escolha um especialista deste Espaço com acesso habilitado.',
        400,
      );
    const key = `${pageId}:${dotId}`;
    const pending = this.pending.get(key);
    if (pending) return pending;
    const current = this.workspace.pages.thread(pageId, dotId);
    if (current?.ready)
      return this.workspace.requireThread(current.threadId, dotId);
    const sdk = this.intelligence();
    const task = (async () => {
      const candidateId = randomUUID();
      if (!this.workspace.pages.reserveThread(pageId, dotId, candidateId))
        throw new PageError(
          'A conversa desta página está sendo criada. Tente novamente em instantes.',
          409,
        );
      const threadId = this.workspace.pages.thread(pageId, dotId)!.threadId;
      try {
        await bounded(
          sdk.getOrCreateThread({
            threadId,
            userId: this.workspace.ownerId,
            agentId: dotId,
            name: page.title,
          }),
        );
        if (!this.workspace.canAccessSpace(dotId, spaceId))
          throw new PageError('O acesso ao Espaço foi revogado.');
        const thread =
          this.workspace.conversations().find((t) => t.id === threadId) ??
          this.workspace.bindThread(threadId, dotId, page.title);
        this.workspace.pages.finishThread(pageId, dotId);
        return thread;
      } catch (error) {
        this.workspace.pages.releaseThread(pageId, dotId);
        throw error;
      }
    })();
    this.pending.set(key, task);
    try {
      return await task;
    } finally {
      this.pending.delete(key);
    }
  }
  async saveConversation(
    threadId: string,
    title: string,
    parentId: string | null,
  ) {
    const thread = this.workspace.requireThread(threadId);
    const dot = this.workspace.dot(thread.dotId)!;
    const history = await bounded(
      this.intelligence().getThreadMessages({
        threadId,
        userId: this.workspace.ownerId,
      }),
    );
    const chunks: string[] = [];
    for (const message of history.messages) {
      if (!['user', 'assistant'].includes(message.role)) continue;
      let text = '';
      if (typeof message.content === 'string') text = message.content;
      else if (Array.isArray(message.content)) {
        text = message.content
          .flatMap((part) =>
            part &&
            typeof part === 'object' &&
            'text' in part &&
            typeof part.text === 'string'
              ? [part.text]
              : [],
          )
          .join('\n');
      }
      if (text.trim())
        chunks.push(
          `## ${message.role === 'user' ? 'Você' : 'Dot'}\n\n${text}`,
        );
    }
    const content = chunks.join('\n\n');
    if (!content)
      throw new PageError('Esta conversa não tem texto salvo para guardar.');
    if (content.length > 100000)
      throw new PageError(
        'Esta conversa excede o limite de 100.000 caracteres por página. Salve uma conversa mais curta.',
      );
    const destination =
      this.workspace.pages.forThread(threadId)?.spaceId ?? dot.spaceId;
    if (!this.workspace.canAccessSpace(dot.id, destination))
      throw new PageError('O acesso ao Espaço foi revogado.', 400);
    return this.workspace.pages.create(
      destination,
      { title, content, parentId },
      threadId,
    );
  }
}
