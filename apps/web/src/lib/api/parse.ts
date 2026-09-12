import { ApiError, zodIssuesToDetails } from '@allclear/shared';
import type { z } from 'zod';

export async function parseJsonBody<TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
): Promise<z.output<TSchema>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError('VALIDATION_ERROR', 'Request body must be valid JSON');
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ApiError('VALIDATION_ERROR', 'Invalid input', zodIssuesToDetails(result.error));
  }
  return result.data;
}

export function parseSearchParams<TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
): z.output<TSchema> {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new ApiError('VALIDATION_ERROR', 'Invalid query parameters', zodIssuesToDetails(result.error));
  }
  return result.data;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertUuid(value: string, field = 'id'): string {
  if (!UUID_RE.test(value)) {
    throw new ApiError('VALIDATION_ERROR', `Invalid ${field}`, [{ field, message: 'Must be a UUID' }]);
  }
  return value;
}
