import { dependencyContainer } from '../../dependencies';
import { DependencyToken } from '../dependencyContainer/types';

export const initializeDatabase = async () => {
    const database = dependencyContainer.resolve(DependencyToken.Database);
    const logger = dependencyContainer.resolve(DependencyToken.Logger);

    try {
        const usersCollection = database.getCollection('users');

        await usersCollection.createIndex(
            { username: 1 },
            {
                unique: true,
                collation: { locale: 'en', strength: 2 },
            }
        );

        await usersCollection.createIndex(
            { username: 'text' },
            {
                name: 'username_text_search',
                weights: { username: 1 },
            }
        );

        const sessionsCollection = database.getCollection('sessions');

        // /refresh and /logout look sessions up by token hash; /logout-all and reuse detection by username.
        // Not unique: older rows can contain duplicate hashes, and a failed build must not stop startup.
        for (const key of [{ tokenHash: 1 }, { username: 1 }]) {
            await sessionsCollection.createIndex(key).catch((error) => {
                logger.error('Error creating session index', error);
            });
        }

        logger.info('Database indexes created successfully');
    } catch (error) {
        logger.error('Error creating database indexes', error);
        throw error;
    }
};
