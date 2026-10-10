export class APIError extends Error {
    public status: HttpErrorCode;
    constructor(message: string, status: HttpErrorCode) {
        super(message);
        this.status = status;
        this.name = 'APIError';
    }
}

export enum HttpErrorCode {
    BadRequest = 400,
    Unauthorized = 401,
    Forbidden = 403,
    NotFound = 404,
    InternalServerError = 500,
    ServiceUnavailable = 503,
}

/** `error` is kept alongside the {success,message} envelope for clients that read the old 404 shape. */
export const NOT_FOUND_BODY = { success: false, message: 'Not Found', error: 'Not Found' } as const;
