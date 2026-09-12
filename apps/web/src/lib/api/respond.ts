import { NextResponse } from 'next/server';
import { ApiError, zodIssuesToDetails } from '@allclear/shared';
import { ZodError } from 'zod';

type Handler<TContext> = (request: Request, context: TContext) => Promise<Response>;

export function json<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, init);
}

export function noContent(init?: ResponseInit): Response {
  return new Response(null, { status: 204, ...init });
}

export function errorResponse(error: ApiError, headers?: HeadersInit): NextResponse {
  return NextResponse.json(error.toBody(), { status: error.status, headers });
}

/**
 * Wraps a route handler so every failure uses the consistent error format from API Design §8.
 * ApiError → its own status; ZodError → 400 VALIDATION_ERROR; anything else → 500 INTERNAL_ERROR.
 */
export function withErrorHandling<TContext = unknown>(handler: Handler<TContext>): Handler<TContext> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ApiError) {
        const headers = (error as ApiError & { headers?: Record<string, string> }).headers;
        return errorResponse(error, headers);
      }
      if (error instanceof ZodError) {
        return errorResponse(new ApiError('VALIDATION_ERROR', 'Invalid input', zodIssuesToDetails(error)));
      }
      console.error('[api] unhandled error', error);
      return errorResponse(new ApiError('INTERNAL_ERROR', 'Something went wrong on our side. Please try again.'));
    }
  };
}
