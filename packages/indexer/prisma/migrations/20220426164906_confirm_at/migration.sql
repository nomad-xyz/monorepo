/*
  Warnings:

  - Added the required column `confirm_at` to the `messages` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "confirm_at" INTEGER NOT NULL DEFAULT 0;
