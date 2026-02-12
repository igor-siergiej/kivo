export function getClientIP(request: Request): string {
    // Priority: X-Forwarded-For → CF-Connecting-IP → X-Real-IP → fallback
    const xForwardedFor = request.headers.get('x-forwarded-for');
    if (xForwardedFor) return xForwardedFor.split(',')[0].trim();

    const cfConnectingIp = request.headers.get('cf-connecting-ip');
    if (cfConnectingIp) return cfConnectingIp;

    const xRealIp = request.headers.get('x-real-ip');
    if (xRealIp) return xRealIp;

    return 'unknown';
}
