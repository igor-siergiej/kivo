import type { Logger } from '@imapps/api-utils';
import type { Handler } from 'elysia';
import { APIError } from '../../types/index.js';

export function createErrorHandler(logger: Logger): Handler {
    return ({ error }) => {
        let status = 500;
        let message = 'Internal Server Error';

        if (error instanceof APIError) {
            status = error.status;
            message = error.message;
        } else if (error instanceof Error) {
            message = error.message;
            logger.error('Unhandled error', { error: message });
        }

        return {
            success: false,
            message,
            status,
        };
    };
}
