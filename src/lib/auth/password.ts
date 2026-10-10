// OWASP minimum for argon2id: 19 MiB memory, 2 iterations, 1 lane
const ARGON2_OPTIONS = { algorithm: 'argon2id', memoryCost: 19456, timeCost: 2 } as const;

export const hashPassword = (password: string) => Bun.password.hash(password, ARGON2_OPTIONS);

/** Handles both argon2id hashes and the bcrypt hashes written before the switch. */
export const verifyPassword = (password: string, hash: string) => Bun.password.verify(password, hash);

export const isLegacyHash = (hash: string) => hash.startsWith('$2');

let dummyHash: Promise<string> | undefined;

/** Burns the same hashing time as a real check so unknown usernames are not distinguishable by latency. */
export const verifyAgainstDummy = async (password: string) => {
    dummyHash ??= hashPassword('kivo-timing-equalisation');
    await verifyPassword(password, await dummyHash);
};
