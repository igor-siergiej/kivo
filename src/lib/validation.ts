import type { Context } from 'hono';
import { z } from 'zod';

import { APIError, HttpErrorCode } from '../types/index.js';

export const MAX_USERNAME_LENGTH = 64;
export const MAX_PASSWORD_LENGTH = 1024;
export const MAX_USERNAMES_PER_REQUEST = 100;

const jsonObject = z.looseObject({});

const rejectInvalidJson = (): never => {
    throw new APIError('Request body must be valid JSON', HttpErrorCode.BadRequest);
};

/**
 * Parses the request body as JSON, requires it to be an object, then decodes it with `schema`.
 * Field schemas are lenient (`.catch(undefined)`), so routes report their own domain errors for bad fields.
 */
export const readJsonBody = async <S extends z.ZodType>(c: Context, schema: S): Promise<z.output<S>> => {
    const body = jsonObject.safeParse(await c.req.json().catch(rejectInvalidJson));

    if (!body.success) {
        throw new APIError('Request body must be a JSON object', HttpErrorCode.BadRequest);
    }

    return schema.parse(body.data);
};

/** A non-empty string within `maxLength`; anything else decodes to undefined. */
export const boundedString = (maxLength: number) => z.string().min(1).max(maxLength).optional().catch(undefined);

export const credentialsSchema = z.object({
    username: boundedString(MAX_USERNAME_LENGTH),
    password: boundedString(MAX_PASSWORD_LENGTH),
});

export const MIN_PASSWORD_LENGTH = 8;

// bcrypt-era limit kept: longer inputs add no strength to legacy hashes and cost more to hash
export const MAX_PASSWORD_BYTES = 72;

/** At least 8 characters and 72 bytes max, containing a letter and a digit; any other characters allowed. */
export const isAcceptablePassword = (password: string) =>
    password.length >= MIN_PASSWORD_LENGTH &&
    Buffer.byteLength(password) <= MAX_PASSWORD_BYTES &&
    /\p{L}/u.test(password) &&
    /\d/.test(password);
