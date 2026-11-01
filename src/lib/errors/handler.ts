import type { Logger } from '@imapps/api-utils';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { APIError } from '../../types/index.js';

export function createErrorHandler(logger: Logger) {
    return (err: Error, c: Context) => {
        if (err instanceof APIError) {
            return c.json({ success: false, message: err.message }, err.status);
        }

        if (err instanceof HTTPException) {
            return c.json({ success: false, message: err.message }, err.status);
        }

        logger.error('Unhandled error', { error: err.message });

        return c.json({ success: false, message: 'Internal Server Error' }, 500);
    };
}
