// biome-ignore-all lint/correctness/noConstructorReturn: I need to figure out a better way to do this
import { Logger, MongoDbConnection } from '@imapps/api-utils';
import { config } from './lib/config';
import { dependencyContainer } from './lib/dependencyContainer';
import { DependencyToken } from './lib/dependencyContainer/types';

export const registerDepdendencies = () => {
    dependencyContainer.registerSingleton(DependencyToken.Database, MongoDbConnection);
    dependencyContainer.registerSingleton(DependencyToken.Logger, Logger);
    // Register the config instance directly rather than the class
    dependencyContainer.registerSingleton(
        DependencyToken.Config,
        class {
            constructor() {
                return config as any;
            }
        } as any
    );
};

export { dependencyContainer };
