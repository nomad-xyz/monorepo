FROM node:16
ENV NODE_ENV=production

WORKDIR /app

COPY package.json ./package.json
COPY package-lock.json ./package-lock.json

RUN npm i

COPY api ./api
COPY main.ts ./main.ts

COPY prisma ./prisma
RUN npm run build

COPY core ./core

CMD [ "npm", "run", "start" ]