/*
  Warnings:

  - Made the column `allow_fast` on table `messages` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tx` on table `messages` required. This step will fail if there are existing NULL values in that column.
  - Made the column `gas_at_dispatch` on table `messages` required. This step will fail if there are existing NULL values in that column.
  - Made the column `gas_at_update` on table `messages` required. This step will fail if there are existing NULL values in that column.
  - Made the column `gas_at_relay` on table `messages` required. This step will fail if there are existing NULL values in that column.
  - Made the column `gas_at_receive` on table `messages` required. This step will fail if there are existing NULL values in that column.
  - Made the column `gas_at_process` on table `messages` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "messages" ALTER COLUMN "allow_fast" SET NOT NULL,
ALTER COLUMN "tx" SET NOT NULL,
ALTER COLUMN "gas_at_dispatch" SET NOT NULL,
ALTER COLUMN "gas_at_update" SET NOT NULL,
ALTER COLUMN "gas_at_relay" SET NOT NULL,
ALTER COLUMN "gas_at_receive" SET NOT NULL,
ALTER COLUMN "gas_at_process" SET NOT NULL;
