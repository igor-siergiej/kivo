import { dependencyContainer } from "../../dependencies.js";
import { DependencyToken } from "../../lib/dependencyContainer/types.js";

export const verify = async ({ headers, set }: any) => {
	const config = dependencyContainer.resolve(DependencyToken.Config);
	const logger = dependencyContainer.resolve(DependencyToken.Logger);
	const authHeader = headers.authorization;

	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		logger.warn(
			"Token verification attempt with missing or malformed auth header"
		);
		set.status = 401;
		return {
			success: false,
			message: "Authorization header missing or malformed",
		};
	}

	const token = authHeader.split(" ")[1];

	try {
		const { verify } = await import("jsonwebtoken");
		const payload = verify(token, config.get("jwtSecret")) as {
			aud?: string;
			username?: string;
			id?: string;
		};

		if (payload.aud !== "kivo") {
			logger.warn("Token verification failed: invalid audience", {
				audience: payload.aud,
			});
			set.status = 401;
			return { success: false, message: "Invalid or expired token" };
		}

		logger.info("Token verified successfully", {
			username: payload.username,
		});
		return {
			success: true,
			payload: { id: payload.id, username: payload.username },
		};
	} catch (error) {
		const { TokenExpiredError, JsonWebTokenError } = await import(
			"jsonwebtoken"
		);

		// Handle expected token expiration and invalid tokens without logging errors
		if (error instanceof TokenExpiredError) {
			logger.warn("Token verification failed: token expired");
			set.status = 401;
			return { success: false, message: "Token expired" };
		}

		if (error instanceof JsonWebTokenError) {
			logger.warn("Token verification failed: invalid token", {
				error: (error as Error).message,
			});
			set.status = 401;
			return { success: false, message: "Invalid token" };
		}

		// Log unexpected errors
		logger.error("Error verifying token", error);
		set.status = 500;
		return { success: false, message: "Internal server error" };
	}
};
