import { CollectionName } from './types';
import { DependencyContainer } from '../dependencyContainer';
import { DependencyToken } from '../dependencyContainer/types';

export const initializeDatabase = async () => {
    const container = DependencyContainer.getInstance();
    const database = container.resolve(DependencyToken.Database)!;

    try {
        const usersCollection = database.getCollection(CollectionName.Users);
        
        await usersCollection.createIndex(
            { username: 1 },
            { 
                unique: true,
                collation: { locale: 'en', strength: 2 }
            }
        );

        await usersCollection.createIndex(
            { username: 'text' },
            { 
                name: 'username_text_search',
                weights: { username: 1 }
            }
        );

        console.log('✅ Database indexes created successfully');
    } catch (error) {
        console.error('❌ Error creating database indexes:', error);
        throw error;
    }
};
