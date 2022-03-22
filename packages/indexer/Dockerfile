FROM node:16
ENV NODE_ENV=production

WORKDIR /app

COPY package.json ./package.json
# COPY package-lock.json ./package-lock.json
RUN yarn install


# START should delete later
COPY sdk.tgz ./sdk.tgz
COPY bridge.tgz ./bridge.tgz
COPY govern.tgz ./govern.tgz

RUN yarn add ./sdk.tgz
RUN yarn add ./bridge.tgz
RUN yarn add ./govern.tgz

RUN yarn install

# END should delete later

RUN rm -rf node_modules
RUN npm i

COPY api ./api
COPY main.ts ./main.ts

COPY prisma ./prisma
RUN yarn build

COPY core ./core

CMD [ "yarn", "start" ]