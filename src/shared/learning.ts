import { z } from 'zod';

export const learningContainerIdSchema = z
  .string()
  .max(64)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Use de 1 a 64 letras minúsculas, números e hífens simples.',
  )
  .nullable();

export function validateLearningSettings(
  containerId: string | null,
  delivery: boolean,
) {
  if (!learningContainerIdSchema.safeParse(containerId).success)
    throw new Error(
      'O ID do contêiner de aprendizado do Dot deve usar de 1 a 64 letras minúsculas, números e hífens simples.',
    );
  if (delivery && !containerId)
    throw new Error(
      'A entrega de skills do Dot exige um contêiner de aprendizado.',
    );
}
