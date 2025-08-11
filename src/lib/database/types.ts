import { BSON, Collection, ObjectId } from 'mongodb';

export enum CollectionName {
    Sessions = 'sessions',
    Users = 'users'
}

export interface IDatabase {
    connect: () => Promise<void>;
    getCollection<T extends BSON.Document>(collectionName: CollectionName): Collection<T>;
}

export interface Session extends BSON.Document {
    _id: ObjectId;
    username: string;
    tokenHash: string;
    createdAt: Date;
}

export interface User extends BSON.Document {
    _id: ObjectId;
    username: string;
    passwordHash: string;
}
