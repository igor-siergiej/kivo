import { ObjectId } from 'mongodb';
import { dependencyContainer } from '../../src/dependencies';
import { DependencyToken } from '../../src/lib/dependencyContainer/types';

type Doc = Record<string, unknown>;

const matches = (doc: Doc, filter: Doc, ignoreCase = false) =>
    Object.entries(filter).every(([key, expected]) => {
        if (ignoreCase && typeof expected === 'string' && typeof doc[key] === 'string') {
            return (doc[key] as string).toLowerCase() === expected.toLowerCase();
        }
        if (expected && typeof expected === 'object' && '$exists' in expected) {
            return (doc[key] !== undefined) === (expected as { $exists: boolean }).$exists;
        }
        if (expected && typeof expected === 'object' && '$in' in expected) {
            return (expected as { $in: unknown[] }).$in.includes(doc[key]);
        }
        return doc[key] === expected;
    });

export class FakeCollection {
    docs: Doc[] = [];

    constructor(private readonly uniqueUsername = false) {}

    findOne = async (filter: Doc, options: { collation?: unknown } = {}) =>
        this.docs.find((doc) => matches(doc, filter, Boolean(options.collation))) ?? null;

    insertOne = async (doc: Doc) => {
        if (this.uniqueUsername && this.docs.some((existing) => matches(existing, { username: doc.username }, true))) {
            throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
        }
        this.docs.push(doc);
        return { insertedId: doc._id };
    };

    deleteOne = async (filter: Doc) => {
        const index = this.docs.findIndex((doc) => matches(doc, filter));
        if (index >= 0) this.docs.splice(index, 1);
        return { deletedCount: index >= 0 ? 1 : 0 };
    };

    deleteMany = async (filter: Doc) => {
        const before = this.docs.length;
        this.docs = this.docs.filter((doc) => !matches(doc, filter));
        return { deletedCount: before - this.docs.length };
    };

    updateOne = async (filter: Doc, update: { $set: Doc }) => {
        const doc = this.docs.find((candidate) => matches(candidate, filter));
        if (doc) Object.assign(doc, update.$set);
        return { modifiedCount: doc ? 1 : 0 };
    };

    find = (filter: Doc) => {
        const found = this.docs.filter((doc) => matches(doc, filter));
        const cursor = { project: () => cursor, toArray: async () => found };
        return cursor;
    };
}

export const TEST_SECRET = 'test-secret-test-secret-test-secret-01';

export interface TestEnvironment {
    users: FakeCollection;
    sessions: FakeCollection;
    logs: string[];
}

/** Replaces the container's Database, Logger and Config with in-memory fakes. */
export const installFakes = (overrides: Doc = {}): TestEnvironment => {
    const users = new FakeCollection(true);
    const sessions = new FakeCollection();
    const logs: string[] = [];
    const collections: Record<string, FakeCollection> = { users, sessions };
    const settings: Doc = {
        jwtSecret: TEST_SECRET,
        accessTokenExpiry: '15m',
        refreshTokenExpiry: '7d',
        secure: false,
        sameSite: 'Lax',
        ...overrides,
    };

    const logger = {
        info: (message: string) => logs.push(`info:${message}`),
        warn: (message: string) => logs.push(`warn:${message}`),
        error: (message: string) => logs.push(`error:${message}`),
    };

    const instances = (dependencyContainer as unknown as { instances: Record<string, unknown> }).instances;
    instances[DependencyToken.Database] = { getCollection: (name: string) => collections[name] };
    instances[DependencyToken.Logger] = logger;
    instances[DependencyToken.Config] = { get: (key: string) => settings[key] };

    return { users, sessions, logs };
};

export const newId = () => new ObjectId();
