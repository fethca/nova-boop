ARG DOCKER_REGISTRY=""

##### BASE NODE IMAGE #######

FROM node:20.9.0-slim as base

WORKDIR /usr/app

#####  Source stage ######

FROM base as source

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

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


# Install latest chrome dev package and fonts to support major charsets (Chinese, Japanese, Arabic, Hebrew, Thai and a few others)
# Note: this installs the necessary libs to make the bundled version of Chrome that Puppeteer
# installs, work.
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    && sh -c 'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-khmeros fonts-kacst fonts-freefont-ttf libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

COPY --from=source --chown=node:node /usr/app/package.json /usr/app/package.json
COPY --from=dependencies --chown=node:node /usr/app/node_modules/ /usr/app/node_modules/
COPY --from=build --chown=node:node /usr/app/dist/ /usr/app/dist/

USER node

CMD ["node", "/usr/app/dist/index.js"]
