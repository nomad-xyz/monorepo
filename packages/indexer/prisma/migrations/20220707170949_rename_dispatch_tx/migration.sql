/*
  Warnings:

  - You are about to rename the column `tx` to `dispatchTx` on the `messages` table.

*/
-- AlterTable
ALTER TABLE "messages"
RENAME COLUMN "tx" TO "dispatch_tx";