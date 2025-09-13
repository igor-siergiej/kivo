# Kivo - Authentication Service - Claude Code Context

## Project Overview
Kivo is a dedicated authentication service built with Node.js and TypeScript that handles user authentication for the shoppingo e-commerce platform and other applications. It provides JWT-based authentication with secure token management.

## Architecture
- **Backend**: Node.js + Koa + TypeScript + MongoDB
- **Authentication**: JWT with access/refresh token pattern
- **Security**: bcrypt password hashing, rate limiting, CORS, helmet
- **Database**: MongoDB with session management and TTL indexes

## Project Structure
```
kivo/
├── src/
│   ├── routes/           # API route handlers
│   │   ├── login/        # User login endpoint
│   │   ├── register/     # User registration endpoint
│   │   ├── refresh/      # Token refresh endpoint
│   │   ├── verify/       # Token verification endpoint
│   │   ├── logout/       # User logout endpoint
│   │   ├── search/       # User search functionality
│   │   └── users/        # User management endpoints
│   ├── lib/
│   │   ├── config/       # Environment and app configuration
│   │   ├── database/     # MongoDB connection and utilities
│   │   └── dependencyContainer/  # Dependency injection container
│   ├── types/            # TypeScript type definitions
│   ├── dependencies.ts   # Dependency registration
│   └── index.ts          # Main application entry point
├── .env                  # Environment variables
├── Dockerfile           # Multi-stage Docker build
├── package.json         # Dependencies and scripts
└── tsconfig.json        # TypeScript configuration
```

## Key Scripts
Run these from the kivo directory:

### Development
- `yarn start` - Start development server with hot reload (port 3008)
- `yarn build` - Build production bundle with tsup
- `yarn lint` - Run ESLint
- `yarn lint:fix` - Auto-fix ESLint issues

## Environment Configuration (.env)
```
# Database
CONNECTION_URI=mongodb://localhost:27017/?directConnection=true
DATABASE_NAME=auth
PORT=3008

# JWT Security
JWT_SECRET=staging-jwt-secret-change-for-production
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Cookie Security
SECURE=false
SAME_SITE=Lax
```

## API Endpoints

### Core Authentication
- `POST /login` - User authentication with credentials
- `POST /register` - New user registration
- `POST /refresh` - Refresh access tokens using refresh token
- `GET /verify` - Verify token validity
- `POST /logout` - User logout and session cleanup

### User Management
- `GET /search` - Search users (rate-limited and secured)
- `POST /users` - Get users by usernames

### Health Check
- `GET /health` - Service health status

## Security Features

### Rate Limiting
- 50 requests per minute per IP
- Special rate limiting for search endpoints
- Memory-based rate limiting store

### CORS Configuration
Allowed origins:
- `http://localhost:3000` (development)
- `http://localhost:4000` (shoppingo web)
- `http://shoppingo.imapps.staging`
- `http://jewellerycatalogue.imapps.staging`
- `https://jewellerycatalogue.imapps.co.uk`
- `https://shoppingo.imapps.co.uk`

### Security Middleware
- Helmet for security headers
- bcrypt for password hashing
- JWT token validation
- Session TTL management (30 days)
- Cloudflare visitor header processing

## Key Dependencies

### Production
- `koa` + `koa-router` - HTTP server framework
- `mongodb` - Database driver
- `jsonwebtoken` - JWT token management
- `bcrypt` - Password hashing
- `koa-helmet`, `koa-cors`, `koa-ratelimit` - Security middleware

### Development
- `tsx` - TypeScript execution with hot reload
- `tsup` - Build tool for TypeScript
- `eslint` - Code linting with TypeScript support
- `dotenv-cli` - Environment variable management

## Database Schema
Uses MongoDB collections:
- **Users**: User account information with hashed passwords
- **Sessions**: JWT refresh tokens with TTL (30 days auto-expire)

## Docker Support
Multi-stage Dockerfile with:
- Builder stage: Install dependencies and build
- Runner stage: Optimized production image
- Exposes port 3008
- Uses Yarn 4.9.2 with node-modules linker

## Development Workflow
1. **Starting development**: Run `yarn start` (connects to local MongoDB)
2. **Code style**: ESLint with TypeScript and import sorting rules
3. **Building**: Use `yarn build` for production bundle
4. **Dependencies**: Uses Yarn 4 with PnP disabled (node-modules linker)

## Integration with Shoppingo
Kivo serves as the authentication provider for:
- Shoppingo web application (port 4000)
- Shoppingo API (port 4001)
- Other applications in the ecosystem

The service validates tokens and provides user authentication data to consuming applications.

## Shared Utilities Potential
Kivo could benefit from **im-apps-utils** shared utilities:
- `@igor-siergiej/api-utils` for standardized database connections and dependency injection
- Configuration management utilities for environment variable handling
- Structured logging utilities for better observability
- See `../im-apps-utils/CLAUDE.md` for available shared utilities

## Deployment & Infrastructure
The service is deployed using **GitOps** with Kubernetes:
- **Staging**: Internal service in `kivo-staging` namespace
- **Production**: Internal service in `kivo-production` namespace
- **Container Registry**: `192.168.68.54:31834/kivo:tag`
- **Orchestration**: Kubernetes with ArgoCD for GitOps deployment
- **Access**: Internal-only service, accessed by other services in cluster
- **Database**: Dedicated MongoDB deployment with persistent storage
- See `../argonaut/CLAUDE.md` for complete deployment infrastructure documentation

## Related Services
- **Main Consumer**: `shoppingo` e-commerce application
- **Shared Utilities**: Could integrate `im-apps-utils` for common patterns
- **GitOps Deployment**: Managed via `argonaut` Kubernetes GitOps repository
- See `../shoppingo/CLAUDE.md`, `../im-apps-utils/CLAUDE.md`, and `../argonaut/CLAUDE.md` for ecosystem documentation

## Useful Commands for Claude
- **Start service**: `yarn start`
- **Health check**: `curl http://localhost:3008/health`
- **Code quality**: `yarn lint`
- **Production build**: `yarn build`
- **Main source**: All logic in `src/` directory
- **Route handlers**: Individual route logic in `src/routes/*`
- **Configuration**: Environment variables in `.env`