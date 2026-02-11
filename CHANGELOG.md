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
