FROM node:16
# ENV NODE_ENV=production

ARG GIT_COMMIT
ENV GIT_COMMIT=$GIT_COMMIT

WORKDIR /app

COPY tsconfig.json ./tsconfig.json
COPY package.json ./package.json
RUN yarn install

# RUN yarn build

ADD src /app/src/
# ADD configs /app/configs/

CMD [ "yarn", "start" ]