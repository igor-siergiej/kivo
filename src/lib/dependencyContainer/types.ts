import type { ConfigService, Logger, MongoDbConnection } from '@igor-siergiej/api-utils';
import type { Session, User } from '../database/types';

// Collection type mapping for MongoDB
export type Collections = {
    sessions: Session;
    users: User;
};

export enum DependencyToken {
    Database = 'Database',
    Logger = 'Logger',
    Config = 'Config',
}

export type Dependencies = {
    [DependencyToken.Database]: MongoDbConnection<Collections>;
    [DependencyToken.Logger]: Logger;
    // biome-ignore lint/suspicious/noExplicitAny: ConfigService requires generic type parameter for schema
    [DependencyToken.Config]: ConfigService<any>;
};
