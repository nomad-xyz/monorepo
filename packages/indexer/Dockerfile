FROM node:16
ENV NODE_ENV=production

ARG GIT_COMMIT
ENV GIT_COMMIT=$GIT_COMMIT

WORKDIR /app

COPY package.json ./package.json
RUN yarn

ADD prisma /app/prisma
RUN yarn prisma:build

ADD src /app/

CMD [ "yarn", "start:all" ]