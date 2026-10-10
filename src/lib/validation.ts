import type { Context } from 'hono';
import { APIError, HttpErrorCode } from '../types/index.js';

export const MAX_USERNAME_LENGTH = 64;
export const MAX_PASSWORD_LENGTH = 1024;
export const MAX_USERNAMES_PER_REQUEST = 100;

export const readJsonObject = async (c: Context): Promise<Record<string, unknown>> => {
    let body: unknown;
    try {
        body = await c.req.json();
    } catch {
        throw new APIError('Request body must be valid JSON', HttpErrorCode.BadRequest);
    }

    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        throw new APIError('Request body must be a JSON object', HttpErrorCode.BadRequest);
    }

    return body as Record<string, unknown>;
};

/** Returns the value only if it is a non-empty string within `maxLength`; otherwise undefined. */
export const stringField = (body: Record<string, unknown>, key: string, maxLength: number): string | undefined => {
    const value = body[key];
    return typeof value === 'string' && value.length > 0 && value.length <= maxLength ? value : undefined;
};
