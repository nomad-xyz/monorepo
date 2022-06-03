FROM node:16
ENV NODE_ENV=production

ARG GIT_COMMIT
ENV GIT_COMMIT=$GIT_COMMIT

WORKDIR /app

COPY package.json ./package.json
# COPY package-lock.json ./package-lock.json
RUN yarn install

RUN rm -rf node_modules
RUN npm i

ADD src /app/
ADD prisma /app/prisma

<<<<<<< HEAD
=======
RUN yarn build

>>>>>>> efc79e8 (sync with main)
CMD [ "yarn", "start" ]