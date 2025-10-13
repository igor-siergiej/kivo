import type { BSON, ObjectId } from 'mongodb';

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
