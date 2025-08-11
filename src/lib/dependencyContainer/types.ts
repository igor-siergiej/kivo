import { IConfig } from '../config/types';
import { IDatabase } from '../database/types';

export type ConstructorOfType<T> = new (...args: Array<unknown>) => T;

export enum DependencyToken {
    Database = 'Database',
    Config = 'Config'
}

export interface IInstances {
    [DependencyToken.Database]?: IDatabase;
    [DependencyToken.Config]?: IConfig;
}

export type IDependencies = {
    [key in keyof IInstances]?: ConstructorOfType<IInstances[key]>
};
