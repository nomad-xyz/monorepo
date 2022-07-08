FROM node:16
ENV NODE_ENV=production

ARG GIT_COMMIT="default value - should not see this"
ENV GIT_COMMIT=$GITHUB_SHA

WORKDIR /app

COPY package.json ./package.json
RUN yarn

ADD prisma /app/prisma
RUN yarn prisma:generate

ADD src /app/

CMD [ "yarn", "start" ]