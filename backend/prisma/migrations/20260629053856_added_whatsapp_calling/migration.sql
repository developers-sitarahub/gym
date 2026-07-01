-- CreateEnum
CREATE TYPE "CallPermissionStatus" AS ENUM ('UNKNOWN', 'PENDING', 'GRANTED', 'DENIED', 'REVOKED');

-- AlterTable
ALTER TABLE "ChatbotSettings" ALTER COLUMN "welcomeMessage" SET DEFAULT 'Welcome to {{gym_name}}!

1. My Membership
2. Renew Membership
3. View Plans
4. Contact Gym
5. Offers';

-- AlterTable
ALTER TABLE "Gym" ADD COLUMN     "displayNameLockedUntil" TIMESTAMP(3),
ADD COLUMN     "displayNameRetryCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "callPermissionGrantedAt" TIMESTAMP(3),
ADD COLUMN     "callPermissionRequestCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "callPermissionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "callPermissionRevokedAt" TIMESTAMP(3),
ADD COLUMN     "callPermissionStatus" "CallPermissionStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "callPermissionUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "callPermissionVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WhatsAppDisplayNameHistory" ADD COLUMN     "processedByWorker" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "workerAttempts" INTEGER NOT NULL DEFAULT 0;
