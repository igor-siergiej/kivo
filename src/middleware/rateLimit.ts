import { getClientIP } from "../lib/utils/getClientIP.js";

interface RateLimitEntry {
	count: number;
	resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every minute
setInterval(() => {
	const now = Date.now();
	for (const [ip, data] of rateLimitStore.entries()) {
		if (now > data.resetTime) {
			rateLimitStore.delete(ip);
		}
	}
}, 60000);

export function checkGlobalRateLimit(request: Request): { allowed: boolean; retryAfter?: number } {
	const clientIP = getClientIP(request);
	const now = Date.now();
	const windowMs = 60 * 1000; // 1 minute
	const maxRequests = 55;

	const clientData = rateLimitStore.get(clientIP);

	if (!clientData || now > clientData.resetTime) {
		// New window
		rateLimitStore.set(clientIP, {
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
