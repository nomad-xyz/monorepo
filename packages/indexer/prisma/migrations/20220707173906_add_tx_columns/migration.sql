-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "process_tx" VARCHAR(66),
ADD COLUMN     "relay_tx" VARCHAR(66),
ADD COLUMN     "update_tx" VARCHAR(66);
