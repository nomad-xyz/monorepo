FROM node:17.3.0
ENV NODE_ENV=production

WORKDIR /app

COPY package.json .

RUN yarn install 

COPY src ./src

CMD [ "yarn", "run", "start" ]