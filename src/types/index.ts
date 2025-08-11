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
    MethodNotAllowed = 405,
    InternalServerError = 500,
    BadGateway = 502,
    ServiceUnavailable = 503,
    GatewayTimeout = 504,
}
