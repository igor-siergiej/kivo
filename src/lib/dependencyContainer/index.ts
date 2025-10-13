import { DependencyContainer as BaseDependencyContainer } from '@imapps/api-utils';
import type { Dependencies } from './types';

// Export a typed version of the DependencyContainer
export const dependencyContainer = BaseDependencyContainer.getInstance<Dependencies>();
