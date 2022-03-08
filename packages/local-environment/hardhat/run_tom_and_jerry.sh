docker run --rm --name tom_net -p 9546:8545 -d hardhat && \
docker run --rm --name jerry_net -p 9545:8545 -d hardhat
# docker network create mynet && \
# docker network connect mynet tom_net && \
# docker network connect mynet jerry_net
