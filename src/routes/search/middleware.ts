import { getClientIP } from "../../lib/utils/getClientIP.js";

const searchRateLimit = new Map<string, { count: number; resetTime: number }>();

// Cleanup old entries every minute
setInterval(() => {
	const now = Date.now();
	for (const [ip, data] of searchRateLimit.entries()) {
		if (now > data.resetTime) {
			searchRateLimit.delete(ip);
		}
	}
}, 60000);

export function checkSearchRateLimit(request: Request): { allowed: boolean; retryAfter?: number } {
	const clientIP = getClientIP(request);
	const now = Date.now();
	const windowMs = 60 * 1000;
	const maxRequests = 30;

	const clientData = searchRateLimit.get(clientIP);

	if (!clientData || now > clientData.resetTime) {
		// New window
		searchRateLimit.set(clientIP, {
			count: 1,
			resetTime: now + windowMs,
		});
		return { allowed: true };
	}

	if (clientData.count >= maxRequests) {
		// Rate limit exceeded
		return {
			allowed: false,
			retryAfter: Math.ceil((clientData.resetTime - now) / 1000),
		};
	}

	// Increment counter
	clientData.count++;
	return { allowed: true };
}

export const searchRateLimitMiddleware = async ({ request, set }: any) => {
	const rateLimitResult = checkSearchRateLimit(request);

	// Apply security headers
	set.headers["X-Content-Type-Options"] = "nosniff";
	set.headers["X-Frame-Options"] = "DENY";
	set.headers["X-XSS-Protection"] = "1; mode=block";
	set.headers["Cache-Control"] =
		"no-store, no-cache, must-revalidate, proxy-revalidate";
	set.headers["Pragma"] = "no-cache";
	set.headers["Expires"] = "0";

	if (!rateLimitResult.allowed) {
		set.status = 429;
		return {
			success: false,
			message: "Search rate limit exceeded. Please try again later.",
			retryAfter: rateLimitResult.retryAfter,
		};
	}
};
