import type { Handler } from "elysia";
import type { Logger } from "@imapps/api-utils";
import { APIError, HttpErrorCode } from "../../types/index.js";

export function createErrorHandler(logger: Logger): Handler {
	return ({ code, error }) => {
		let status = 500;
		let message = "Internal Server Error";

		if (error instanceof APIError) {
			status = error.status;
			message = error.message;
		} else if (code === "NOT_FOUND") {
			status = 404;
			message = "Not Found";
		} else if (code === "VALIDATION") {
			status = 400;
			message = "Validation Error";
		} else if (error instanceof Error) {
			message = error.message;
			logger.error("Unhandled error", { error });
		}

		return {
			success: false,
			message,
		};
	};
}
