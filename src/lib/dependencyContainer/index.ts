import { DependencyContainer as BaseDependencyContainer } from '@igor-siergiej/api-utils';
import type { Dependencies } from './types';

// Export a typed version of the DependencyContainer
export const dependencyContainer = BaseDependencyContainer.getInstance<Dependencies>();
