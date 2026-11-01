import { Logger, MongoDbConnection } from '@imapps/api-utils';
import { type Collection, ObjectId } from 'mongodb';
import { z } from 'zod';

import { dependencyContainer } from '../../src/dependencies';
import type { AppConfig } from '../../src/lib/config';
import type { Session, User } from '../../src/lib/database/types';
import { DependencyToken } from '../../src/lib/dependencyContainer/types';

type Collections = { users: User; sessions: Session };

type Scalar = string | number | boolean | Date | ObjectId | undefined;

type FieldFilter = Scalar | RegExp | { $exists: boolean } | { $in: Scalar[] };

type DocFilter = { [field: string]: FieldFilter };

type Settings = AppConfig['values'];

const existsFilter = z.object({ $exists: z.boolean() });
const inFilter = z.object({ $in: z.array(z.unknown()) });
const text = z.string();

const matchesField = (actual: Scalar, expected: FieldFilter, ignoreCase: boolean) => {
    const actualText = text.safeParse(actual);
    const expectedText = text.safeParse(expected);

    if (ignoreCase && actualText.success && expectedText.success) {
        return actualText.data.toLowerCase() === expectedText.data.toLowerCase();
    }

    if (expected instanceof RegExp) {
        return actualText.success && expected.test(actualText.data);
    }

    const exists = existsFilter.safeParse(expected);

    if (exists.success) return (actual !== undefined) === exists.data.$exists;

    const included = inFilter.safeParse(expected);

    if (included.success) return included.data.$in.includes(actual);

    return actual === expected;
};

const matches = (doc: User | Session, filter: DocFilter, ignoreCase = false) =>
    Object.entries(filter).every(([key, expected]) => matchesField(doc[key], expected, ignoreCase));

interface FakeCursor<T> {
    project: () => FakeCursor<T>;
    toArray: () => Promise<T[]>;
}

export class FakeCollection<T extends User | Session> {
    docs: T[] = [];

    constructor(private readonly uniqueUsername = false) {}

    findOne = async (filter: DocFilter, options: { collation?: { locale: string; strength: number } } = {}) =>
        this.docs.find((doc) => matches(doc, filter, Boolean(options.collation))) ?? null;

    insertOne = async (doc: T) => {
        if (this.uniqueUsername && this.docs.some((existing) => matches(existing, { username: doc.username }, true))) {
            throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
        }

        this.docs.push(doc);

        return { insertedId: doc._id };
    };

    deleteOne = async (filter: DocFilter) => {
        const index = this.docs.findIndex((doc) => matches(doc, filter));

        if (index >= 0) this.docs.splice(index, 1);

        return { deletedCount: index >= 0 ? 1 : 0 };
    };

    deleteMany = async (filter: DocFilter) => {
        const before = this.docs.length;
        this.docs = this.docs.filter((doc) => !matches(doc, filter));

        return { deletedCount: before - this.docs.length };
    };

    updateOne = async (filter: DocFilter, update: { $set: Partial<T> }) => {
        const doc = this.docs.find((candidate) => matches(candidate, filter));

        if (doc) Object.assign(doc, update.$set);

        return { modifiedCount: doc ? 1 : 0 };
    };

    find = (filter: DocFilter): FakeCursor<T> => {
        const found = this.docs.filter((doc) => matches(doc, filter));
        const cursor: FakeCursor<T> = { project: () => cursor, toArray: async () => found };

        return cursor;
    };
}

export const TEST_SECRET = 'test-secret-test-secret-test-secret-01';

export interface TestEnvironment {
    users: FakeCollection<User>;
    sessions: FakeCollection<Session>;
    logs: string[];
}

interface ActiveFakes extends TestEnvironment {
    settings: Settings;
}

let active: ActiveFakes | undefined;

const current = () => {
    if (!active) throw new Error('installFakes() has not been called');

    return active;
};

/**
 * SAFETY: FakeCollection implements exactly the driver methods the routes call; the driver's Collection type
 * is far larger, so the structural overlap the compiler needs for a direct assertion does not exist.
 */
const asDriverCollection = <Target>(fake: FakeCollection<User> | FakeCollection<Session>) => fake as Target;

class FakeDatabase extends MongoDbConnection<Collections> {
    override getCollection<K extends keyof Collections & string>(name: K) {
        return asDriverCollection<Collection<Collections[K]>>(current()[name]);
    }
}

class FakeLogger extends Logger {
    override info = (message: string) => current().logs.push(`info:${message}`);
    override warn = (message: string) => current().logs.push(`warn:${message}`);
    override error = (message: string) => current().logs.push(`error:${message}`);
}

class FakeConfig {
    get values() {
        return current().settings;
    }

    get<K extends keyof Settings>(key: K): Settings[K] {
        return current().settings[key];
    }
}

let registered = false;

/** Registers the fakes once (the container rejects re-registration); `installFakes` swaps what they serve. */
const registerFakes = () => {
    if (registered) return;

    registered = true;
    dependencyContainer.registerSingleton(DependencyToken.Database, FakeDatabase);
    dependencyContainer.registerSingleton(DependencyToken.Logger, FakeLogger);
    dependencyContainer.registerSingleton(DependencyToken.Config, FakeConfig);
};

/** Replaces what the container's Database, Logger and Config serve with fresh in-memory fakes. */
export const installFakes = (overrides: Partial<Settings> = {}): TestEnvironment => {
    registerFakes();

    const environment: TestEnvironment = {
        users: new FakeCollection<User>(true),
        sessions: new FakeCollection<Session>(),
        logs: [],
    };

    const settings: Settings = {
        port: 3008,
        connectionUri: 'mongodb://localhost:27017',
        databaseName: 'kivo_test',
        jwtSecret: TEST_SECRET,
        jwtPrivateKey: undefined,
        accessTokenExpiry: '15m',
        refreshTokenExpiry: '7d',
        secure: false,
        sameSite: 'Lax',
        lookupAuthEnabled: false,
        serviceToken: undefined,
        corsAllowedOrigins: 'http://localhost:3000',
        ...overrides,
    };

    active = { ...environment, settings };

    return environment;
};

export const newId = () => new ObjectId();
