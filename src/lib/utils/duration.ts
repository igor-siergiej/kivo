const UNIT_SECONDS = new Map([
    ['s', 1],
    ['m', 60],
    ['h', 3600],
    ['d', 86400],
    ['w', 604800],
]);

/** Parses jsonwebtoken-style lifetimes ("15m", "7d") or plain seconds. */
export const durationToSeconds = (value: string | number): number => {
    const match = /^(\d+)\s*([smhdw])?$/i.exec(String(value).trim());
    const unitSeconds = UNIT_SECONDS.get((match?.[2] ?? 's').toLowerCase());

    if (!match || unitSeconds === undefined) {
        throw new Error(`Unsupported duration '${value}', use e.g. 15m, 12h, 7d`);
    }

    return Number(match[1]) * unitSeconds;
};
