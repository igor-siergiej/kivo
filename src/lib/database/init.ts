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

        logger.info('Database user indexes created successfully');
    } catch (error) {
        logger.error('Error creating database indexes', error);
        throw error;
    }
};
