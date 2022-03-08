docker run --name pg1 -p 5432:5432 -e POSTGRES_PASSWORD=postgres -d postgres
docker run --name core --rm --env-file .env --link pg1 -e PROGRAM=core -d indexer
docker run --name api --rm -p 3000:3000 --env-file .env --link pg1  -e PROGRAM=api -d indexer