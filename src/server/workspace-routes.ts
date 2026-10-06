import { setupInputSchema } from './setup-telemetry.js';
import { pageRoutes } from './page-routes.js';
import { Hono } from 'hono';
import { z } from 'zod';
import { Platform } from './platform.js';
import { VoiceService } from './voice.js';
import {
  learningContainerIdSchema,
  validateLearningSettings,
} from '../shared/learning.js';
const dotSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    instructions: z.string().trim().min(3).max(2000),
    researchAllowed: z.boolean(),
    memoryAllowed: z.boolean(),
    learningContainerId: learningContainerIdSchema.optional(),
    skillDeliveryEnabled: z.boolean().optional(),
    spaceIds: z.array(z.string().min(1)).min(1).max(100).optional(),
    spaceId: z.string().min(1).optional(),
  })
  .strict();
export function workspaceRoutes(platform: Platform, voice: VoiceService) {
  const app = new Hono();
  app.route('/', pageRoutes(platform));
  app.post('/setup-telemetry', async (c) => {
    const parsed = setupInputSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success)
      return c.json({ error: 'Evento de configuração inválido.' }, 400);
    const event = parsed.data;
    if (
      event.kind === 'step_viewed' &&
      event.step !== 'settings' &&
      event.step !==
        (platform.setup().missing.length ? 'setup_required' : 'ready')
    )
      return c.json(
        {
          error:
            'A etapa de configuração não corresponde ao estado do servidor.',
        },
        400,
      );
    platform.setupTelemetry.capture(event);
    return c.json({ ok: true });
  });
  app.get('/workspace', (c) =>
    c.json({
      spaces: platform.workspace.spaces(),
      dots: platform.workspace.dots(),
      conversations: platform.workspace.conversations(),
      setup: platform.setup(),
      calls: platform.workspace.calls(),
    }),
  );
  app.post('/spaces', async (c) => {
    const data = z
      .object({
        name: z.string().trim().min(1).max(60),
        description: z.string().max(500).default(''),
      })
      .strict()
      .safeParse(await c.req.json());
    if (!data.success)
      return c.json(
        { error: 'Informe um nome de Espaço (até 60 caracteres).' },
        400,
      );
    return c.json(
      platform.workspace.createSpace(data.data.name, data.data.description),
      201,
    );
  });
  app.post('/dots', async (c) => {
    const data = dotSchema
      .extend({ spaceId: z.string() })
      .safeParse(await c.req.json());
    if (!data.success)
      return c.json(
        {
          error:
            'Informe um nome, as instruções de papel e permissões explícitas de ferramentas.',
        },
        400,
      );
    try {
      validateLearningSettings(
        data.data.learningContainerId ?? null,
        data.data.skillDeliveryEnabled ?? false,
      );
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Configurações de aprendizado inválidas.',
        },
        400,
      );
    }
    return c.json(
      platform.workspace.createDot(
        data.data.spaceId,
        data.data.name,
        data.data.instructions,
        data.data.researchAllowed,
        data.data.memoryAllowed,
        data.data.spaceIds,
        data.data.learningContainerId,
        data.data.skillDeliveryEnabled,
      ),
      201,
    );
  });
  app.put('/dots/:id', async (c) => {
    const data = dotSchema.safeParse(await c.req.json());
    if (!data.success)
      return c.json({ error: 'Configurações de especialista inválidas.' }, 400);
    const current = platform.workspace.dot(c.req.param('id'));
    if (!current) return c.json({ error: 'Dot não encontrado.' }, 404);
    try {
      validateLearningSettings(
        data.data.learningContainerId === undefined
          ? (current.learningContainerId ?? null)
          : data.data.learningContainerId,
        data.data.skillDeliveryEnabled ?? current.skillDeliveryEnabled ?? false,
      );
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Configurações de aprendizado inválidas.',
        },
        400,
      );
    }
    return c.json(platform.workspace.updateDot(c.req.param('id'), data.data));
  });
  app.post('/conversations', async (c) => {
    const data = z
      .object({
        dotId: z.string(),
        title: z.string().trim().min(1).max(120).default('A new thought'),
      })
      .strict()
      .safeParse(await c.req.json());
    if (!data.success)
      return c.json(
        { error: 'Selecione um Dot e um título para a conversa.' },
        400,
      );
    if (platform.setup().missing.length)
      return c.json(
        {
          error: `Configuração necessária: ${platform.setup().missing.join(', ')}.`,
        },
        503,
      );
    return c.json(
      await platform.createConversation(data.data.dotId, data.data.title),
      201,
    );
  });
  app.get('/conversations/:id/capture', (c) =>
    c.json(platform.workspace.capture(c.req.param('id'))),
  );
  app.post('/voice/calls', async (c) => {
    const data = z
      .object({ threadId: z.string(), sdp: z.string().max(100000) })
      .strict()
      .safeParse(await c.req.json());
    if (!data.success)
      return c.json(
        {
          error:
            'É necessário informar uma conversa e uma oferta SDP de áudio.',
        },
        400,
      );
    return c.json(
      await voice.begin(data.data.threadId, data.data.sdp, c.req.raw.signal),
      201,
    );
  });
  app.get('/voice/calls/:id', (c) =>
    c.json(platform.workspace.call(c.req.param('id'))),
  );
  app.post('/voice/calls/:id/active', (c) =>
    c.json(voice.activate(c.req.param('id'))),
  );
  app.post('/voice/calls/:id/compute', async (c) => {
    const data = z
      .object({
        toolCallId: z.string().min(1).max(200),
        request: z.string().trim().min(1).max(4000),
        transcript: z.string().max(12000).default(''),
      })
      .strict()
      .safeParse(await c.req.json());
    if (!data.success)
      return c.json(
        {
          error:
            'É necessário um pedido de processamento com tamanho limitado e o ID da chamada de ferramenta.',
        },
        400,
      );
    return c.json({
      text: await voice.compute(
        c.req.param('id'),
        data.data.toolCallId,
        `${data.data.request}\n\nUntrusted current-call transcript for context:\n${data.data.transcript}`,
      ),
    });
  });
  app.post('/voice/calls/:id/end', async (c) => {
    const data = z
      .object({
        transcript: z.string().max(20000),
        anchorMessageId: z.string().max(200).optional(),
      })
      .strict()
      .safeParse(await c.req.json());
    if (!data.success)
      return c.json(
        { error: 'A transcrição excede o limite de 20.000 caracteres.' },
        400,
      );
    platform.workspace.anchorCall(c.req.param('id'), data.data.anchorMessageId);
    return c.json(await voice.end(c.req.param('id'), data.data.transcript));
  });
  app.all('/copilotkit/*', (c) => platform.handle(c.req.raw));
  app.onError((error, c) => {
    const text = error.message;
    const known =
      /^(Setup|Voice setup|Dot |Space |Specialist |Conversation |Call |This call|End the current|Voice provider|An audio|Intelligence could not|Configuração necessária|Configuração de voz|O Dot |Dot especialista|Esta conversa|Chamada não|A sessão da chamada|A conexão da chamada|Esta chamada|Encerre a chamada|O provedor de voz|É necessária uma oferta|O Intelligence não|O acesso a Espaços)/.test(
        text,
      );
    return c.json(
      {
        error: known
          ? text
          : 'A requisição ao serviço falhou. Verifique a configuração do servidor e tente novamente.',
      },
      503,
    );
  });
  return app;
}
