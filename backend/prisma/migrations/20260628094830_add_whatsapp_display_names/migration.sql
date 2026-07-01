-- CreateEnum
CREATE TYPE "WhatsAppDisplayNameStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'DECLINED', 'REGISTERING', 'REGISTERED', 'REGISTRATION_FAILED');

-- AlterTable
ALTER TABLE "Gym" ADD COLUMN     "lastNameApprovedAt" TIMESTAMP(3),
ADD COLUMN     "lastNameChangeRequestAt" TIMESTAMP(3),
ADD COLUMN     "lastRegistrationAttemptAt" TIMESTAMP(3),
ADD COLUMN     "pendingDisplayName" TEXT,
ADD COLUMN     "pendingNameStatus" "WhatsAppDisplayNameStatus",
ADD COLUMN     "registrationError" TEXT,
ADD COLUMN     "whatsappNameStatus" "WhatsAppDisplayNameStatus";

-- CreateTable
CREATE TABLE "WhatsAppDisplayNameHistory" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "phoneNumberId" TEXT NOT NULL,
    "graphApiVersion" TEXT NOT NULL,
    "oldName" TEXT,
    "newName" TEXT NOT NULL,
    "status" "WhatsAppDisplayNameStatus" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metaResponse" JSONB,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "registeredAt" TIMESTAMP(3),
    "rejectionReason" TEXT,

    CONSTRAINT "WhatsAppDisplayNameHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WhatsAppDisplayNameHistory" ADD CONSTRAINT "WhatsAppDisplayNameHistory_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;
