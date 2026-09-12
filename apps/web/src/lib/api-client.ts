'use client';

import { isApiErrorBody, type ApiErrorCode } from '@allclear/shared';

export class ClientApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: Array<{ field: string; message: string }>;

  constructor(code: ApiErrorCode, message: string, status: number, details?: Array<{ field: string; message: string }>) {
    super(message);
    this.name = 'ClientApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** fetch wrapper for our own /api routes: JSON in/out and the standard error envelope. */
export async function apiFetch<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const response = await fetch(path, {
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    credentials: 'same-origin',
  });

  if (response.status === 204) return undefined as T;

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // no body
  }

  if (!response.ok) {
    if (isApiErrorBody(payload)) {
      throw new ClientApiError(payload.error.code, payload.error.message, response.status, payload.error.details);
    }
    throw new ClientApiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', response.status);
  }
  return payload as T;
}

export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof ClientApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
