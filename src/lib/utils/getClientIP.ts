/**
 * Kivo sits behind a Cloudflare tunnel and Traefik, so `cf-connecting-ip` is set by Cloudflare itself.
 * `x-forwarded-for` is appended to by each proxy, so only its last hop is trustworthy: the first
 * entries are whatever the client sent.
 */
export function getClientIP(request: Request): string {
    const cfConnectingIp = request.headers.get('cf-connecting-ip');
    if (cfConnectingIp) return cfConnectingIp.trim();

    const xForwardedFor = request.headers.get('x-forwarded-for');
    if (xForwardedFor) {
        const hops = xForwardedFor.split(',');
        return hops[hops.length - 1].trim();
    }

    const xRealIp = request.headers.get('x-real-ip');
    if (xRealIp) return xRealIp.trim();

    return 'unknown';
}
