import { secureHeaders } from 'hono/secure-headers';

// JSON API: nothing should ever be rendered, framed or loaded from it
export const applySecurityHeaders = secureHeaders({
    xFrameOptions: 'DENY',
    strictTransportSecurity: 'max-age=31536000; includeSubDomains',
    referrerPolicy: 'no-referrer',
    contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
});
