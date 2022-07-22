FROM node:16
ENV NODE_ENV=production

ARG GITHUB_SHA="default"
ENV GIT_COMMIT=$GITHUB_SHA
RUN echo $GIT_COMMIT

WORKDIR /app

COPY package.json ./package.json
RUN yarn

ADD prisma /app/prisma
RUN yarn prisma:generate

ADD src /app/

CMD [ "yarn", "start" ]