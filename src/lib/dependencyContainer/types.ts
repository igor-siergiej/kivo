import type { Logger, MongoDbConnection } from '@imapps/api-utils';
import { ConfigService } from '@imapps/api-utils';
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
    [DependencyToken.Config]: ConfigService;
};
