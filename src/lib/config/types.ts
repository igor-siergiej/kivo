export interface IConfig {
    port: number;
    connectionUri: string;
    databaseName: string;
    jwtSecret: string;
    accessTokenExpiry: string;
    refreshTokenExpiry: string;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
}
