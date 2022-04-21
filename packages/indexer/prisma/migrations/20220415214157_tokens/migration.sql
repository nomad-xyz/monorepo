-- CreateTable
CREATE TABLE "kv_storage" (
    "id" SERIAL NOT NULL,
    "namespace" VARCHAR NOT NULL,
    "key" VARCHAR NOT NULL,
    "value" VARCHAR NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kv_storage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" SERIAL NOT NULL,
    "message_hash" VARCHAR(66) NOT NULL,
    "origin" INTEGER NOT NULL,
    "destination" INTEGER NOT NULL,
    "nonce" INTEGER NOT NULL,
    "internal_sender" VARCHAR(66) NOT NULL,
    "internal_recipient" VARCHAR(66) NOT NULL,
    "root" VARCHAR(66) NOT NULL,
    "state" INTEGER NOT NULL,
    "dispatchBlock" INTEGER NOT NULL,
    "dispatched_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    "relayed_at" INTEGER NOT NULL,
    "received_at" INTEGER NOT NULL,
    "processed_at" INTEGER NOT NULL,
    "sender" VARCHAR(66),
    "recipient" VARCHAR(66),
    "amount" VARCHAR(256),
    "allow_fast" BOOLEAN NOT NULL,
    "details_hash" VARCHAR(66),
    "token_domain" INTEGER,
    "token_id" VARCHAR(66),
    "body" VARCHAR NOT NULL,
    "leaf_index" VARCHAR(256) NOT NULL,
    "tx" VARCHAR(66),
    "gas_at_dispatch" VARCHAR(256) NOT NULL,
    "gas_at_update" VARCHAR(256) NOT NULL,
    "gas_at_relay" VARCHAR(256) NOT NULL,
    "gas_at_receive" VARCHAR(256) NOT NULL,
    "gas_at_process" VARCHAR(256) NOT NULL,
    "sent" BOOLEAN NOT NULL,
    "updated" BOOLEAN NOT NULL,
    "relayed" BOOLEAN NOT NULL,
    "received" BOOLEAN NOT NULL,
    "processed" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Token" (
    "id" VARCHAR NOT NULL,
    "domain" INTEGER NOT NULL,
    "name" VARCHAR NOT NULL,
    "decimals" INTEGER NOT NULL,
    "symbol" VARCHAR NOT NULL,
    "total_supply_hex" VARCHAR NOT NULL,
    "balance_hex" VARCHAR NOT NULL
);

-- CreateTable
CREATE TABLE "Replica" (
    "id" VARCHAR NOT NULL,
    "domain" INTEGER NOT NULL,
    "total_supply_hex" VARCHAR NOT NULL,
    "token_id" VARCHAR NOT NULL,
    "token_domain" INTEGER NOT NULL
);

-- CreateIndex
CREATE INDEX "kv_storage_id_index" ON "kv_storage"("id");

-- CreateIndex
CREATE UNIQUE INDEX "unique_namespace_key" ON "kv_storage"("namespace", "key");

-- CreateIndex
CREATE UNIQUE INDEX "messages_message_hash_key" ON "messages"("message_hash");

-- CreateIndex
CREATE INDEX "messages_id_index" ON "messages"("id");

-- CreateIndex
CREATE UNIQUE INDEX "token_id" ON "Token"("id", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "replica_id" ON "Replica"("id", "domain");

-- AddForeignKey
ALTER TABLE "Replica" ADD CONSTRAINT "Replica_token_id_token_domain_fkey" FOREIGN KEY ("token_id", "token_domain") REFERENCES "Token"("id", "domain") ON DELETE RESTRICT ON UPDATE CASCADE;
