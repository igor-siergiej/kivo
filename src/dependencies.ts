import { Logger, MongoDbConnection } from '@imapps/api-utils';

import { type AppConfig, config } from './lib/config';
import { dependencyContainer } from './lib/dependencyContainer';
import { DependencyToken } from './lib/dependencyContainer/types';

// SAFETY: the container only constructs and returns it; this constructor hands back the already-built `config`, so the instance is exactly an AppConfig.
const ConfigInstance = class {
    constructor() {
        return config;
    }
} as new () => AppConfig;

export const registerDepdendencies = () => {
    dependencyContainer.registerSingleton(DependencyToken.Database, MongoDbConnection);
    dependencyContainer.registerSingleton(DependencyToken.Logger, Logger);
    // Register the config instance directly rather than the class
    dependencyContainer.registerSingleton(DependencyToken.Config, ConfigInstance);
};

export { dependencyContainer };
