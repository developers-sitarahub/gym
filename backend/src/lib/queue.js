import cron from "node-cron";
import prisma from "../prisma.js";

// 1. Worker to process APPROVED/REGISTERING gyms (every 1 minute)
cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();
    // Find gyms that are APPROVED or REGISTERING
    const gymsToProcess = await prisma.gym.findMany({
      where: {
        pendingNameStatus: { in: ["APPROVED", "REGISTERING"] },
        OR: [
          { displayNameLockedUntil: null },
          { displayNameLockedUntil: { lte: now } }
        ]
      },
    });

    if (gymsToProcess.length === 0) return;

    for (const gym of gymsToProcess) {
      // 1. Try to lock the job (avoid double processing if multiple servers run cron)
      const locked = await prisma.gym.updateMany({
        where: {
          id: gym.id,
          pendingNameStatus: { in: ["APPROVED", "REGISTERING"] },
          OR: [
            { displayNameLockedUntil: null },
            { displayNameLockedUntil: { lte: now } }
          ]
        },
        data: {
          pendingNameStatus: "REGISTERING",
          displayNameLockedUntil: new Date(Date.now() + 5 * 60 * 1000), // Lock for 5 mins
        }
      });

      if (locked.count === 1) {
        await processRegistrationForGym(gym);
      }
    }
  } catch (err) {
    console.error("❌ [Cron] Error scanning for registrations:", err);
  }
});

// 2. Auto-checker to sync PENDING_REVIEW gyms with Meta (every 15 minutes)
cron.schedule("*/15 * * * *", async () => {
  try {
    const pendingGyms = await prisma.gym.findMany({
      where: { pendingNameStatus: "PENDING_REVIEW", whatsapp_access_token: { not: null }, whatsapp_phone_number_id: { not: null } }
    });

    if (pendingGyms.length === 0) return;
    
    console.log(`🔄 [Auto-Check] Verifying ${pendingGyms.length} pending name changes with Meta...`);
    const META_API_VERSION = process.env.META_API_VERSION || "v20.0";
    const GRAPH_BASE_URL = process.env.META_GRAPH_BASE_URL || "https://graph.facebook.com";
    const { decrypt } = await import("../utils/encryption.js");

    for (const gym of pendingGyms) {
      try {
        const accessToken = decrypt(gym.whatsapp_access_token);
        const metaRes = await fetch(`${GRAPH_BASE_URL}/${META_API_VERSION}/${gym.whatsapp_phone_number_id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (metaRes.ok) {
          const metaData = await metaRes.json();
          const newNameStatus = metaData.new_name_status || null;

          // If newNameStatus is "APPROVED" or explicitly dropped (and not PENDING_REVIEW)
          if (newNameStatus !== "PENDING_REVIEW") {
             if (newNameStatus === "APPROVED" || !newNameStatus) {
               console.log(`✅ [Auto-Check] Name approved for gym ${gym.id}`);
               await prisma.$transaction([
                  prisma.gym.update({ where: { id: gym.id }, data: { pendingNameStatus: "APPROVED" } }),
                  prisma.whatsAppDisplayNameHistory.updateMany({
                     where: { gymId: gym.id, status: "PENDING_REVIEW", isActive: true },
                     data: { status: "APPROVED", approvedAt: new Date() }
                  })
               ]);
             } else if (newNameStatus === "DECLINED" || newNameStatus === "REJECTED") {
               console.log(`❌ [Auto-Check] Name declined for gym ${gym.id}`);
               await prisma.$transaction([
                  prisma.gym.update({ where: { id: gym.id }, data: { pendingNameStatus: "DECLINED" } }),
                  prisma.whatsAppDisplayNameHistory.updateMany({
                     where: { gymId: gym.id, status: "PENDING_REVIEW", isActive: true },
                     data: { status: "DECLINED", isActive: false }
                  })
               ]);
             }
          }
        }
      } catch (e) {
        console.error(`Error auto-checking gym ${gym.id}:`, e.message);
      }
    }
  } catch (err) {
    console.error("❌ [Auto-Check] Error:", err);
  }
});


export async function processRegistrationForGym(gym) {
  try {
    console.log(`[Cron] Attempting to register phone number ${gym.whatsapp_phone_number_id} for gym ${gym.id}...`);

    const META_API_VERSION = process.env.META_API_VERSION || "v20.0";
    const GRAPH_BASE_URL = process.env.META_GRAPH_BASE_URL || "https://graph.facebook.com";

    const { decrypt } = await import("../utils/encryption.js");
    const accessToken = decrypt(gym.whatsapp_access_token);

    // Record attempt
    await prisma.gym.update({
      where: { id: gym.id },
      data: {
        lastRegistrationAttemptAt: new Date(),
        registrationError: null,
      },
    });

    const activeHistory = await prisma.whatsAppDisplayNameHistory.findFirst({
        where: { gymId: gym.id, status: { in: ['APPROVED', 'REGISTERING'] }, isActive: true }
    });

    if (activeHistory) {
      await prisma.whatsAppDisplayNameHistory.update({
        where: { id: activeHistory.id },
        data: { workerAttempts: { increment: 1 } }
      });
    }

    const pin = Math.floor(100000 + Math.random() * 900000).toString();

    const resp = await fetch(
      `${GRAPH_BASE_URL}/${META_API_VERSION}/${gym.whatsapp_phone_number_id}/register`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messaging_product: "whatsapp", pin }),
      }
    );

    const result = await resp.json();

    if (!resp.ok) {
      // Idempotency: if it's already active/registered, treat it as a success!
      if (result?.error?.code === 131045 || result?.error?.code === 133005) {
        console.log(`[Cron] Number already active/registered for gym ${gym.id}.`);
      } else {
        throw new Error(JSON.stringify(result.error));
      }
    } else {
        console.log(`[Cron] Successfully registered phone number for gym ${gym.id}`);
    }

    // Update DB to complete the flow
    await prisma.$transaction(async (tx) => {
      await tx.gym.update({
        where: { id: gym.id },
        data: {
          whatsappVerifiedName: gym.pendingDisplayName || gym.whatsappVerifiedName,
          whatsappNameStatus: "REGISTERED",
          pendingDisplayName: null,
          pendingNameStatus: null,
          displayNameLockedUntil: null,
          displayNameRetryCount: 0,
          lastNameApprovedAt: new Date(),
        },
      });

      await tx.whatsAppDisplayNameHistory.updateMany({
        where: { gymId: gym.id, status: { in: ["APPROVED", "REGISTERING"] }, isActive: true },
        data: {
          status: "REGISTERED",
          registeredAt: new Date(),
          processedByWorker: true,
          isActive: false,
        },
      });
    });

  } catch (err) {
    console.error(`[Cron] Error processing job for gym ${gym.id}:`, err.message);

    const newRetryCount = (gym.displayNameRetryCount || 0) + 1;
    const activeHistory = await prisma.whatsAppDisplayNameHistory.findFirst({
        where: { gymId: gym.id, isActive: true }
    });

    if (newRetryCount >= 3) {
      console.error(`[Cron] Marking as REGISTRATION_FAILED for gym ${gym.id}. Max retries exceeded.`);
      await prisma.$transaction([
        prisma.gym.update({
          where: { id: gym.id },
          data: {
            pendingNameStatus: "REGISTRATION_FAILED",
            registrationError: err.message,
            displayNameLockedUntil: null,
          },
        }),
        prisma.whatsAppDisplayNameHistory.updateMany({
          where: { gymId: gym.id, status: { in: ["APPROVED", "REGISTERING"] }, isActive: true },
          data: {
            status: "REGISTRATION_FAILED",
            rejectionReason: err.message,
            processedByWorker: true,
            isActive: false,
          },
        }),
      ]);
    } else {
      // Exponential backoff: 2^retryCount minutes (1m, 2m, 4m)
      const backoffMins = Math.pow(2, newRetryCount - 1);
      console.log(`[Cron] Retrying registration for gym ${gym.id} in ${backoffMins} minutes (Attempt ${newRetryCount}/3)`);
      
      await prisma.gym.update({
        where: { id: gym.id },
        data: {
          pendingNameStatus: "APPROVED", // Revert back to APPROVED to be picked up again
          displayNameRetryCount: newRetryCount,
          registrationError: err.message,
          displayNameLockedUntil: new Date(Date.now() + backoffMins * 60 * 1000),
        },
      });
    }
  }
}
