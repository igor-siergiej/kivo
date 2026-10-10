import crypto, { type KeyObject } from 'node:crypto';
import { dependencyContainer } from '../../dependencies.js';
import { DependencyToken } from '../dependencyContainer/types.js';

interface JsonWebKey {
    kty?: string;
    crv?: string;
    x?: string;
    y?: string;
}

export interface SigningKeys {
    privateKey: KeyObject;
    publicKey: KeyObject;
    kid: string;
    jwk: JsonWebKey & { kid: string; use: 'sig'; alg: 'ES256' };
}

let cached: { pem: string; keys: SigningKeys } | undefined;

/** RFC 7638 thumbprint of an EC public key, used as the key id. */
const thumbprint = (jwk: JsonWebKey) =>
    crypto
        .createHash('sha256')
        .update(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y }))
        .digest('base64url');

/**
 * ES256 key pair from JWT_PRIVATE_KEY (PKCS8 PEM; literal "\n" sequences allowed for single-line env vars).
 * Returns undefined when unset, in which case tokens stay HS256-signed.
 */
export const getSigningKeys = (): SigningKeys | undefined => {
    const raw = dependencyContainer.resolve(DependencyToken.Config).get('jwtPrivateKey');
    if (!raw) return undefined;

    const pem = raw.replace(/\\n/g, '\n');
    if (cached?.pem === pem) return cached.keys;

    const privateKey = crypto.createPrivateKey(pem);
    if (privateKey.asymmetricKeyType !== 'ec' || privateKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
        throw new Error('JWT_PRIVATE_KEY must be an EC P-256 key (ES256)');
    }

    const publicKey = crypto.createPublicKey(privateKey);
    const publicJwk = publicKey.export({ format: 'jwk' }) as JsonWebKey;
    const kid = thumbprint(publicJwk);
    const keys: SigningKeys = {
        privateKey,
        publicKey,
        kid,
        jwk: { ...publicJwk, kid, use: 'sig', alg: 'ES256' },
    };

    cached = { pem, keys };
    return keys;
};
