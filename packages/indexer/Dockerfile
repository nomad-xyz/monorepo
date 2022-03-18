FROM node:16
ENV NODE_ENV=production

WORKDIR /app

COPY package.json ./package.json
# COPY package-lock.json ./package-lock.json


# START should delete later
COPY sdk.tgz ./sdk.tgz
COPY bridge.tgz ./bridge.tgz
COPY govern.tgz ./govern.tgz
RUN npm i


RUN npm i ./sdk.tgz
RUN npm i ./bridge.tgz
RUN npm i ./govern.tgz

# RUN rm ./nomad-xyz-sdk-1.3.5.tgz
# END should delete later


COPY api ./api
COPY main.ts ./main.ts

COPY prisma ./prisma
RUN npm run build

COPY core ./core

CMD [ "npm", "run", "start" ]