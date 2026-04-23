# [1.8.0](https://github.com/igor-siergiej/kivo/compare/v1.7.12...v1.8.0) (2026-04-23)


### Features

* add Prometheus metrics, deploy stage, and lint fixes ([a735405](https://github.com/igor-siergiej/kivo/commit/a7354054485bbbba6217f7eeb31582b0d4355848))

## [1.7.12](https://github.com/igor-siergiej/kivo/compare/v1.7.11...v1.7.12) (2026-03-12)


### Bug Fixes

* use GH_TOKEN for Docker build node_auth_token ([fbbd5ee](https://github.com/igor-siergiej/kivo/commit/fbbd5ee198f50a80fe737875b7e290e3d78142ba))

## [1.7.11](https://github.com/igor-siergiej/kivo/compare/v1.7.10...v1.7.11) (2026-03-12)


### Bug Fixes

* use Docker Hub credentials for image push ([982d166](https://github.com/igor-siergiej/kivo/commit/982d1667ecafa89a8fde5b35e8a6ab40e3065d7e))

## [1.7.10](https://github.com/igor-siergiej/kivo/compare/v1.7.9...v1.7.10) (2026-03-12)


### Bug Fixes

* set build-publish job permissions to packages: write for Docker push ([4d5cdf7](https://github.com/igor-siergiej/kivo/commit/4d5cdf73a28a56cd3f409185565eb2664c3004b7))

## [1.7.9](https://github.com/igor-siergiej/kivo/compare/v1.7.8...v1.7.9) (2026-03-12)


### Bug Fixes

* substitute NODE_AUTH_TOKEN in .npmrc at build time using sed ([6193a06](https://github.com/igor-siergiej/kivo/commit/6193a06b9e477ecf9dc6b5c479818a4cc18b4a1f))
* update Dockerfile to use .npmrc for authentication and remove non-existent lock file copy ([c53374c](https://github.com/igor-siergiej/kivo/commit/c53374cd63b83c6c84fe9f4421c348a97882e778))

## [1.7.8](https://github.com/igor-siergiej/kivo/compare/v1.7.7...v1.7.8) (2026-03-12)


### Bug Fixes

* add .yarnrc.yml with proper npm registry auth configuration ([1613df3](https://github.com/igor-siergiej/kivo/commit/1613df3deef5e58978a76031f49383c81397f61b))
* add GH_TOKEN to bun install steps for private package authentication ([a8aa1d0](https://github.com/igor-siergiej/kivo/commit/a8aa1d02373eb71aabb93df675c13a2c248e3d53))
* remove bunfig.toml scoped registry configuration for GitHub Packages ([33fad8a](https://github.com/igor-siergiej/kivo/commit/33fad8a6436052ecb0d192e41433a0239e52846b))
* restore GitHub Packages configuration with GH_TOKEN authentication ([59e374f](https://github.com/igor-siergiej/kivo/commit/59e374f9c4156e82466a82c44c1f35ad5a5eba32))
* update package names from [@imapps](https://github.com/imapps) to [@igor-siergiej](https://github.com/igor-siergiej) ([9fce37f](https://github.com/igor-siergiej/kivo/commit/9fce37f62e32cb03434e2cff6e6d7c702267c965))
* use .npmrc for GitHub Packages authentication instead of bunfig.toml ([a1777d8](https://github.com/igor-siergiej/kivo/commit/a1777d8c2bd9cd040706e03fc426826e6c51719d))
* use correct [@igor-siergiej](https://github.com/igor-siergiej) scope with proper npm registry configuration ([7f77c21](https://github.com/igor-siergiej/kivo/commit/7f77c21804b5f302a84b7ca188b348b4df5dd0fb))
* use correct package versions (0.4.8) and NODE_AUTH_TOKEN for npm ([7d5f539](https://github.com/igor-siergiej/kivo/commit/7d5f539eb4b62ba47129ef767c245790c8bcc0b3))
* use GH_TOKEN for npm package authentication in all jobs ([f933b20](https://github.com/igor-siergiej/kivo/commit/f933b20d5d244fa81705a84e169025c93652a27b))
* use GITHUB_TOKEN and add package read permissions to workflow jobs ([56b406c](https://github.com/igor-siergiej/kivo/commit/56b406cf71e2a634772ba12db0668d68cc84de4b))
* use GITHUB_TOKEN instead of GH_TOKEN for package authentication ([4caafcb](https://github.com/igor-siergiej/kivo/commit/4caafcb45b6f6f99b417afacf9761e84908f649d))
* use GITHUB_TOKEN instead of GH_TOKEN for package authentication ([0f3b3ac](https://github.com/igor-siergiej/kivo/commit/0f3b3ac93ecbe473391007ce03a4da4c4c29567a))
* use public npm registry for packages and remove GITHUB_TOKEN from package installs ([1fc90cc](https://github.com/igor-siergiej/kivo/commit/1fc90cc76c6da8f76c1f27a8e73b296e0032ca02))

## [1.7.7](https://github.com/igor-siergiej/kivo/compare/v1.7.6...v1.7.7) (2026-03-12)


### Bug Fixes

* add biome-ignore comments to suppress expected any types and fix formatting ([f56a571](https://github.com/igor-siergiej/kivo/commit/f56a571fa36a9749666855feb25f2bc2bffcb397))
* add type casts for config.get() calls in src/index.ts ([71bc075](https://github.com/igor-siergiej/kivo/commit/71bc075d55dc2a081fbaaac80f6046c03aef0c06))

## [1.7.6](https://github.com/igor-siergiej/kivo/compare/v1.7.5...v1.7.6) (2026-03-12)


### Bug Fixes

* use GITHUB_TOKEN instead of GH_TOKEN for Docker build npm authentication ([1f091b5](https://github.com/igor-siergiej/kivo/commit/1f091b578a597fe7ec4f7fbbcb2198a4f06a90b2))

## [1.7.5](https://github.com/igor-siergiej/kivo/compare/v1.7.4...v1.7.5) (2026-03-12)


### Bug Fixes

* add biome-ignore comments and cast ConfigService.get() to suppress type warnings ([c371839](https://github.com/igor-siergiej/kivo/commit/c371839dc605cadf922055618633341c466e945c))

## [1.7.4](https://github.com/igor-siergiej/kivo/compare/v1.7.3...v1.7.4) (2026-03-12)


### Bug Fixes

* resolve linting errors - add proper types and fix imports ([d5fd823](https://github.com/igor-siergiej/kivo/commit/d5fd82348e89daa52120b89efcda8c38f737749f))
* resolve remaining TypeScript compilation errors ([892c5fa](https://github.com/igor-siergiej/kivo/commit/892c5fa9e733bfa8b37d25deab8c53fe6c704a79))

## [1.7.3](https://github.com/igor-siergiej/kivo/compare/v1.7.2...v1.7.3) (2026-03-12)


### Bug Fixes

* remove koa-based code incompatible with Elysia framework ([7c9bc63](https://github.com/igor-siergiej/kivo/commit/7c9bc63db824d7a0767a8d36b275dc108d631f69))

## [1.7.2](https://github.com/igor-siergiej/kivo/compare/v1.7.1...v1.7.2) (2026-03-12)


### Bug Fixes

* use bash explicitly to run pipeline script ([0514970](https://github.com/igor-siergiej/kivo/commit/0514970f90ce348ca76b338d6cb04518bc8c73eb))

## [1.7.1](https://github.com/igor-siergiej/kivo/compare/v1.7.0...v1.7.1) (2026-03-12)


### Bug Fixes

* correct config service typing and add missing CORS properties ([1025d24](https://github.com/igor-siergiej/kivo/commit/1025d24c0173fc05ce44582086ebd12194fb7f2a))

# [1.7.0](https://github.com/igor-siergiej/kivo/compare/v1.6.3...v1.7.0) (2026-03-12)


### Bug Fixes

* **ci-cd:** correct version extraction for GitHub Actions ([641abcc](https://github.com/igor-siergiej/kivo/commit/641abccbca7e4477078ad8b3d78d5b0e93778fe1))
* **ci-cd:** use correct bun setup action (oven-sh/setup-bun@v2) ([c932bc2](https://github.com/igor-siergiej/kivo/commit/c932bc2d539c525b1cc89ee0a834c93af985b002))
* **ci-cd:** use GITHUB_TOKEN instead of GH_TOKEN ([81e7ecb](https://github.com/igor-siergiej/kivo/commit/81e7ecba7452d79046c9dc8b32542d85b722cf14))
* correct repository URL to igor-siergiej org ([001daac](https://github.com/igor-siergiej/kivo/commit/001daac624b34e5634bb6eac2bb504940beed88a))
* correct reusable workflow org reference ([7343c0e](https://github.com/igor-siergiej/kivo/commit/7343c0ea8d733adef28dc1562e4916f0c2e12f6c))
* CORS configuration for production and staging environments ([6875d9b](https://github.com/igor-siergiej/kivo/commit/6875d9bf15827cff600c475133d4084ff8b9362d))
* Override PRIVATE_REGISTRY to use external IP for CI runner ([7a69ed6](https://github.com/igor-siergiej/kivo/commit/7a69ed6ed024e59eed6b0227b3716389462d7a6d))
* remove hardcoded token reference from bunfig ([71fdcda](https://github.com/igor-siergiej/kivo/commit/71fdcda3cfece295bf90b2708e1640e0a0ed513e))
* Update Docker registry IP from 192.168.68.59 to 192.168.68.54 ([d78a6b0](https://github.com/igor-siergiej/kivo/commit/d78a6b0c4a2554714580f757281c8e2f15dd8e31))
* use bun for release job (not npm) ([3a3f920](https://github.com/igor-siergiej/kivo/commit/3a3f920c6627b6f16aa040540337af2a9fe7e377))
* use GitHub Container Registry (ghcr.io) instead of Docker Hub ([83fc937](https://github.com/igor-siergiej/kivo/commit/83fc937a7ca8ce282a26406c03ddca3eb8fa8fd0))


### Features

* add utils submodule for shared CI/CD pipelines ([6e355b9](https://github.com/igor-siergiej/kivo/commit/6e355b9b6ca05e688cffe5e5c76da382ce025bfa))
* **ci-cd:** add GitHub Actions workflow with shared pipelines ([c400182](https://github.com/igor-siergiej/kivo/commit/c40018281ef05e3fa79e2999af3cdcf4df8ec9df))
* Migrate from Koa to Elysia framework ([77cf469](https://github.com/igor-siergiej/kivo/commit/77cf46967b11f8fbf39cde547ce64a199c47b950))

## [1.7.1](https://gitlab.com/imapps/kivo/compare/v1.7.0...v1.7.1) (2026-02-12)


### Bug Fixes

* CORS configuration for production and staging environments ([6875d9b](https://gitlab.com/imapps/kivo/commit/6875d9bf15827cff600c475133d4084ff8b9362d))

# [1.7.0](https://gitlab.com/imapps/kivo/compare/v1.6.4...v1.7.0) (2026-02-12)


### Features

* Migrate from Koa to Elysia framework ([77cf469](https://gitlab.com/imapps/kivo/commit/77cf46967b11f8fbf39cde547ce64a199c47b950))

## [1.6.4](https://gitlab.com/imapps/kivo/compare/v1.6.3...v1.6.4) (2026-02-11)


### Bug Fixes

* Override PRIVATE_REGISTRY to use external IP for CI runner ([7a69ed6](https://gitlab.com/imapps/kivo/commit/7a69ed6ed024e59eed6b0227b3716389462d7a6d))

## [1.6.3](https://gitlab.com/imapps/kivo/compare/v1.6.2...v1.6.3) (2026-02-11)


### Bug Fixes

* Set proper status codes in users endpoint ([947a012](https://gitlab.com/imapps/kivo/commit/947a0127edad1911826a3f13070f3cbd890fb6b1))

## [1.6.2](https://gitlab.com/imapps/kivo/compare/v1.6.1...v1.6.2) (2026-02-09)


### Bug Fixes

* improve error handling in user registration and user lookup ([f5f9b9c](https://gitlab.com/imapps/kivo/commit/f5f9b9c7ba0b52f0b30e8308737436830e260685))

## [1.6.1](https://gitlab.com/imapps/kivo/compare/v1.6.0...v1.6.1) (2026-01-03)


### Bug Fixes

* remove authentication requirement from /users endpoint ([aa9244d](https://gitlab.com/imapps/kivo/commit/aa9244d4f0b1e0e34761fd208cefad4e52e799f6))
* remove authentication requirement from logout endpoint ([9825f79](https://gitlab.com/imapps/kivo/commit/9825f798ff73b79e5097f6b6a0df1b8414576953))

# [1.6.0](https://gitlab.com/imapps/kivo/compare/v1.5.1...v1.6.0) (2026-01-03)


### Bug Fixes

* ensure user ID is consistently formatted as string across authentication flow ([6af813e](https://gitlab.com/imapps/kivo/commit/6af813e120d1c304d262f2518c901b9be751a099))
* resolve Kivo route 404 errors and make CORS configuration dynamic ([14c63d6](https://gitlab.com/imapps/kivo/commit/14c63d6da51ba57f2b77ead5fbdfab87e1bcceac))


### Features

* make CORS no-origin request behavior configurable ([b498f3b](https://gitlab.com/imapps/kivo/commit/b498f3b44fa2802631ac222c78d860af4ce598e1))

## [1.5.1](https://gitlab.com/imapps/kivo/compare/v1.5.0...v1.5.1) (2026-01-02)


### Bug Fixes

* add diagnostic logging for route registration ([590160d](https://gitlab.com/imapps/kivo/commit/590160d3389221a8ba90fa84dfbaef075db5108f))

# [1.5.0](https://gitlab.com/imapps/kivo/compare/v1.4.1...v1.5.0) (2026-01-02)


### Features

* fix linting in security updates ([ccd7319](https://gitlab.com/imapps/kivo/commit/ccd73191f7f534cff1c66023d4877566cf08a452))

## [1.4.1](https://gitlab.com/imapps/kivo/compare/v1.4.0...v1.4.1) (2025-12-29)


### Bug Fixes

* add .env to .gitignore to prevent credential leaks ([98131d4](https://gitlab.com/imapps/kivo/commit/98131d4115bbbf3f73ac7b35e5c6dd997bd31c57))

# [1.4.0](https://gitlab.com/imapps/kivo/compare/v1.3.0...v1.4.0) (2025-12-18)


### Features

* add comprehensive audit logging to kivo authentication service ([fabd3d5](https://gitlab.com/imapps/kivo/commit/fabd3d510ab660905dcb007241f8eef9ee58fbfe))

# [1.3.0](https://gitlab.com/imapps/kivo/compare/v1.2.0...v1.3.0) (2025-11-18)


### Bug Fixes

* just commit .env ([f4d37c8](https://gitlab.com/imapps/kivo/commit/f4d37c87db126ba171a9af82b4cfd1bfd7ee7ef2))


### Features

* publish new version ([a82a9b6](https://gitlab.com/imapps/kivo/commit/a82a9b6aae82132a1cec93170016245280e67d4a))

# [1.2.0](https://gitlab.com/imapps/kivo/compare/v1.1.0...v1.2.0) (2025-11-03)


### Features

* add updated pipelines with tags script ([6303a50](https://gitlab.com/imapps/kivo/commit/6303a503982ead06cf2c98dc68a7f06e65d6a3cd))

# [1.1.0](https://gitlab.com/imapps/kivo/compare/v1.0.4...v1.1.0) (2025-10-16)


### Features

* handle token expiration properly ([2e01fd1](https://gitlab.com/imapps/kivo/commit/2e01fd1c1c2cc1adaf48eaf63693b91d724268f5))

## [1.0.4](https://gitlab.com/imapps/kivo/compare/v1.0.3...v1.0.4) (2025-10-14)


### Bug Fixes

* add build tools for bcrypt native compilation in Docker ([84ff82f](https://gitlab.com/imapps/kivo/commit/84ff82f2e54ff60f55540aae2d18e6b01be064cd))
* use named export for koa-body ([3f60115](https://gitlab.com/imapps/kivo/commit/3f60115c8f826d6c80dfbef4e3c88d44e0fc244b))

## [1.0.3](https://gitlab.com/imapps/kivo/compare/v1.0.2...v1.0.3) (2025-10-14)


### Bug Fixes

* handle koa-body CommonJS export in bundled code ([0778773](https://gitlab.com/imapps/kivo/commit/07787737c25306941ad9523712d67b33a47632de))

## [1.0.2](https://gitlab.com/imapps/kivo/compare/v1.0.1...v1.0.2) (2025-10-14)


### Bug Fixes

* register dependencies before setting up error handler ([7f6c97d](https://gitlab.com/imapps/kivo/commit/7f6c97d782aa9ff9a8836fca1d50c6a6ea0c2217))

## [1.0.1](https://gitlab.com/imapps/kivo/compare/v1.0.0...v1.0.1) (2025-10-14)


### Bug Fixes

* allow bcrypt native binding compilation in Docker ([98c35a8](https://gitlab.com/imapps/kivo/commit/98c35a8c4a0c39d7b1bcf5fde8eb310db5760b17))
* make husky prepare script fail gracefully ([783742e](https://gitlab.com/imapps/kivo/commit/783742edf692d1a58ac500a061a1e0d97a1c23d5))

# 1.0.0 (2025-10-14)


### Bug Fixes

* copy over bunfig.toml to find utils packages ([81268c5](https://gitlab.com/imapps/kivo/commit/81268c5e4caf74bd864819fdb290d95495beeebf))
* ignore husky scripts when building ([0091a0c](https://gitlab.com/imapps/kivo/commit/0091a0c92315a979db776ee101b20ef4799bc707))


### Features

* add semantic-release dependencies and fix configuration ([aae3618](https://gitlab.com/imapps/kivo/commit/aae36183ab342d7645a3a2938d933dacbf628bbd))
* move over to gitlab and bun ([6e033c5](https://gitlab.com/imapps/kivo/commit/6e033c543c3d84e227f9f4d721121d66768ccc79))
* update dockerfile and fix build ([d124f13](https://gitlab.com/imapps/kivo/commit/d124f1382626e4139c6728a373e085049b2a85a0))
