ARG DOCKER_REGISTRY=""

##### BASE NODE IMAGE #######

FROM node:20.9.0-slim as base

WORKDIR /usr/app

#####  Source stage ######

FROM base as source

COPY yarn.lock ./
COPY package.json ./
RUN yarn install --frozen-lockfile --production=false
COPY types ./types
COPY src ./src

#####  Dependencies stage ######

FROM source as dependencies

RUN yarn install --frozen-lockfile --force --production --ignore-scripts --prefer-offline

### Test stage #####

FROM source as test

COPY tsconfig.json ./
COPY vitest.config.ts ./
COPY tests ./tests
RUN yarn vitest run --coverage

#### Build stage ####

FROM source as build

COPY tsconfig.json ./
COPY tsconfig.build.json ./
RUN NODE_OPTIONS="--max-old-space-size=4096" yarn build

###### Release stage #####

FROM base as release

COPY --from=source --chown=node:node /usr/app/package.json /usr/app/package.json
COPY --from=dependencies --chown=node:node /usr/app/node_modules/ /usr/app/node_modules/
COPY --from=build --chown=node:node /usr/app/dist/ /usr/app/dist/

USER node

CMD ["node", "/usr/app/dist/index.js"]
