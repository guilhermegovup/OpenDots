import { pageReviewSchema } from '../shared/page-review.js';
import { Hono } from 'hono';
import { z } from 'zod';
import { PageError, pageInput, pagePatch } from './pages.js';
import type { Platform } from './platform.js';
export function pageRoutes(platform: Platform) {
  const app = new Hono();
  app.get('/conversations/:id/reviewed-page/:toolCallId', (c) => {
    const thread = platform.workspace.requireThread(c.req.param('id'));
    const receipt = platform.workspace.pages.reviewReceipt(
      thread.id,
      c.req.param('toolCallId'),
    );
    if (!receipt) return c.json(null);
    if (!platform.workspace.canAccessSpace(thread.dotId, receipt.spaceId))
      return c.json(
        { error: 'Este Dot não tem mais acesso ao Espaço selecionado.' },
        403,
      );
    return c.json({
      ...platform.workspace.pages.get(receipt.spaceId, receipt.pageId),
      reviewDraft: receipt.draft,
    });
  });
  app.post('/conversations/:id/reviewed-page', async (c) => {
    const data = pageReviewSchema
      .extend({ toolCallId: z.string().min(1).max(200) })
      .safeParse(await c.req.json());
    if (!data.success)
      return c.json({ error: 'Informe um rascunho de página válido.' }, 400);
    const thread = platform.workspace.requireThread(c.req.param('id'));
    if (!platform.workspace.canAccessSpace(thread.dotId, data.data.spaceId))
      return c.json(
        { error: 'Este Dot não tem mais acesso ao Espaço selecionado.' },
        403,
      );
    const { spaceId, toolCallId, ...draft } = data.data;
    return c.json(
      platform.workspace.pages.createReviewed(
        spaceId,
        draft,
        thread.id,
        toolCallId,
      ),
      201,
    );
  });
  app.get('/conversations/:id/page-context', (c) => {
    const thread = platform.workspace.requireThread(c.req.param('id'));
    const dot = platform.workspace.dot(thread.dotId)!;
    const page = platform.workspace.pages.forThread(thread.id);
    return c.json(
      page && platform.workspace.canAccessSpace(dot.id, page.spaceId)
        ? { id: page.id, spaceId: page.spaceId, title: page.title }
        : null,
    );
  });
  app.get('/spaces/:spaceId/pages', (c) =>
    c.json(platform.workspace.pages.list(c.req.param('spaceId'))),
  );
  app.get('/spaces/:spaceId/pages/:id', (c) =>
    c.json(
      platform.workspace.pages.get(c.req.param('spaceId'), c.req.param('id')),
    ),
  );
  app.post('/spaces/:spaceId/pages', async (c) => {
    const data = pageInput.safeParse(await c.req.json());
    if (!data.success)
      return c.json(
        {
          error:
            'Informe um título (máx. 160 caracteres) e conteúdo em Markdown (máx. 100.000).',
        },
        400,
      );
    return c.json(
      platform.workspace.pages.create(c.req.param('spaceId'), data.data),
      201,
    );
  });
  app.patch('/spaces/:spaceId/pages/:id', async (c) => {
    const data = pagePatch.safeParse(await c.req.json());
    if (!data.success)
      return c.json(
        {
          error: 'É necessário um patch de página válido e o expectedRevision.',
        },
        400,
      );
    return c.json(
      platform.workspace.pages.update(
        c.req.param('spaceId'),
        c.req.param('id'),
        data.data,
      ),
    );
  });
  app.post('/spaces/:spaceId/pages/:id/conversation', async (c) => {
    const data = z
      .object({ dotId: z.string().min(1) })
      .strict()
      .safeParse(await c.req.json());
    if (!data.success)
      return c.json({ error: 'Escolha um especialista.' }, 400);
    return c.json(
      await platform.pages.conversation(
        c.req.param('spaceId'),
        c.req.param('id'),
        data.data.dotId,
      ),
    );
  });
  app.post('/conversations/:id/page', async (c) => {
    const data = z
      .object({
        title: z.string().trim().min(1).max(160),
        parentId: z.string().nullable().default(null),
      })
      .strict()
      .safeParse(await c.req.json());
    if (!data.success)
      return c.json(
        { error: 'Informe um título de página e uma página-mãe válidos.' },
        400,
      );
    return c.json(
      await platform.pages.saveConversation(
        c.req.param('id'),
        data.data.title,
        data.data.parentId,
      ),
      201,
    );
  });
  app.onError((error, c) =>
    error instanceof SyntaxError
      ? c.json({ error: 'Requisição JSON inválida.' }, 400)
      : error instanceof PageError
        ? c.json({ error: error.message }, error.status)
        : error.message ===
            'Esta conversa não pertence a este Dot e proprietário.'
          ? c.json({ error: error.message }, 404)
          : c.json(
              {
                error:
                  'Não foi possível concluir a operação na página. Verifique a configuração do Intelligence ou tente novamente; seu rascunho não foi descartado.',
              },
              503,
            ),
  );
  return app;
}
