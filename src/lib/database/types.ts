import type { BSON, ObjectId } from 'mongodb';

export interface Session extends BSON.Document {
    _id: ObjectId;
    username: string;
    tokenHash: string;
    createdAt: Date;
    /** Sessions descended from one login share a family so reuse of a rotated token can revoke them all. */
    familyId?: string;
    /** Set when the token was exchanged for a new one; a second use after the grace period means theft. */
    rotatedAt?: Date;
}

export interface User extends BSON.Document {
    _id: ObjectId;
    username: string;
    passwordHash: string;
}
