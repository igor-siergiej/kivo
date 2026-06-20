import type { Logger } from '@imapps/api-utils';
import type { Context } from 'hono';
import { APIError } from '../../types/index.js';

export function createErrorHandler(logger: Logger) {
    return (err: Error, c: Context) => {
        let status: number = 500;
        let message = 'Internal Server Error';

        if (err instanceof APIError) {
            status = err.status;
            message = err.message;
        } else if (err instanceof Error) {
            message = err.message;
            logger.error('Unhandled error', { error: message });
        }

        return c.json({ success: false, message }, status as Parameters<typeof c.json>[1]);
    };
}
