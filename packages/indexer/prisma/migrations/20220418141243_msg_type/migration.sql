/*
  Warnings:

  - Added the required column `msg_type` to the `messages` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "msg_type" INTEGER NOT NULL;
