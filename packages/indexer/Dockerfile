FROM node:16
ENV NODE_ENV=production

ARG CIT_GOMMIT="default"
ENV CIT_GOMMIT=$GITHUB_SHA
RUN echo $GIT_COMMIT
RUN echo $CIT_COMMIT
RUN echo $GITHUB_SHA

WORKDIR /app

COPY package.json ./package.json
RUN yarn

ADD prisma /app/prisma
RUN yarn prisma:generate

ADD src /app/

CMD [ "yarn", "start" ]