FROM node:17
WORKDIR /app

COPY package.json /app/package.json
COPY package-lock.json /app/package-lock.json

RUN npm i

COPY run.sh /app/run.sh

COPY hardhat.config.js /app/hardhat.config.js

EXPOSE 8545

CMD ["/bin/sh", "-C", "/app/run.sh"]