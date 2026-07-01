-- AlterTable
ALTER TABLE "ChatbotSettings" ALTER COLUMN "welcomeMessage" SET DEFAULT 'Welcome to {{gym_name}}!

1. My Membership
2. Renew Membership
3. View Plans
4. Contact Gym
5. Offers';

-- AlterTable
ALTER TABLE "Member" ALTER COLUMN "memberName" DROP NOT NULL;
