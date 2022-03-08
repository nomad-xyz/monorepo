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
    "internal_sender" VARCHAR(42) NOT NULL,
    "internal_recipient" VARCHAR(42) NOT NULL,
    "root" VARCHAR(66) NOT NULL,
    "state" INTEGER NOT NULL,
    "dispatchBlock" INTEGER NOT NULL,
    "dispatched_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    "relayed_at" INTEGER NOT NULL,
    "received_at" INTEGER NOT NULL,
    "processed_at" INTEGER NOT NULL,
    "sender" VARCHAR(42),
    "recipient" VARCHAR(42),
    "amount" VARCHAR(256),
    "allow_fast" BOOLEAN,
    "details_hash" VARCHAR(66),
    "token_domain" INTEGER,
    "token_id" VARCHAR(42),
    "body" VARCHAR NOT NULL,
    "leaf_index" VARCHAR(256) NOT NULL,
    "tx" VARCHAR(66),
    "gas_at_dispatch" VARCHAR(256),
    "gas_at_update" VARCHAR(256),
    "gas_at_relay" VARCHAR(256),
    "gas_at_receive" VARCHAR(256),
    "gas_at_process" VARCHAR(256),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kv_storage_id_index" ON "kv_storage"("id");

-- CreateIndex
CREATE UNIQUE INDEX "unique_namespace_key" ON "kv_storage"("namespace", "key");

-- CreateIndex
CREATE UNIQUE INDEX "messages_message_hash_key" ON "messages"("message_hash");

-- CreateIndex
CREATE INDEX "messages_id_index" ON "messages"("id");
