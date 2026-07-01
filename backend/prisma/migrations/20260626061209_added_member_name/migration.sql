/*
  Warnings:

  - You are about to drop the column `name` on the `Member` table. All the data in the column will be lost.
  - Added the required column `memberName` to the `Member` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ChatbotSettings" ALTER COLUMN "welcomeMessage" SET DEFAULT 'Welcome to {{gym_name}}!

1. My Membership
2. Renew Membership
3. View Plans
4. Contact Gym
5. Offers';

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "memberName" TEXT;

-- Copy data
UPDATE "Member" SET "memberName" = "name";

-- Ensure not null
ALTER TABLE "Member" ALTER COLUMN "memberName" SET NOT NULL;

-- Drop old column and add whatsappName
ALTER TABLE "Member" DROP COLUMN "name",
ADD COLUMN     "whatsappName" TEXT;
