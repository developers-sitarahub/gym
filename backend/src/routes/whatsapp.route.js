import { Router } from "express";
import prisma from "../prisma.js";
import { authenticateToken } from "../middleware/auth.js";
import { requireRoles } from "../middleware/requireRole.middleware.js";
import { encrypt, decrypt } from "../utils/encryption.js";
import multer from "multer";
import { uploadTemplateMediaToMeta } from "../utils/uploadTemplateMediaToMeta.js";
import { handleChatbotMessage } from "../utils/chatbotHelper.js";
import { getIO } from "../socket.js";

const router = Router({ mergeParams: true });

// Configuration constants from environment variables
const META_API_VERSION = process.env.META_API_VERSION || "v20.0";
const DEFAULT_LANGUAGE = process.env.META_DEFAULT_LANGUAGE || "en_US";
const DEFAULT_CODE_METHOD = process.env.META_CODE_METHOD || "SMS";
const GRAPH_BASE_URL =
  process.env.META_GRAPH_BASE_URL || "https://graph.facebook.com";

const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
      cb(null, true);
    } else {
      cb(new Error("Only JPG and PNG images are allowed"), false);
    }
  },
});

/**
 * Helper → Generate PIN
 */
const generatePin = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

/**
 * Helper → Register Phone Number
 */
const registerPhoneNumber = async (phoneNumberId, token) => {
  const pin = generatePin();

  const resp = await fetch(
    `${GRAPH_BASE_URL}/${META_API_VERSION}/${phoneNumberId}/register`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        pin,
      }),
    },
  );

  const data = await resp.json();

  if (!resp.ok) {
    if (data?.error?.code === 131045 || data?.error?.code === 133005) {
      console.log(
        `✅ Number already active/registered (Meta Error Code: ${data?.error?.code})`,
      );
      return { success: true };
    }

    return { success: false, error: data };
  }

  console.log("✅ Number registered");
  return { success: true };
};

/**
 * Helper → Subscribe App
 */
const subscribeApp = async (whatsappBusinessId, token) => {
  const resp = await fetch(
    `${GRAPH_BASE_URL}/${META_API_VERSION}/${whatsappBusinessId}/subscribed_apps`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );

  const data = await resp.json();

  if (!resp.ok) {
    if (data?.error?.message?.includes("already subscribed")) {
      console.log("✅ App already subscribed");
      return { success: true };
    }

    return { success: false, error: data };
  }

  console.log("✅ App subscribed");
  return { success: true };
};

/**
 * Helper → Fetch Phone Details
 */
const fetchPhoneDetails = async (phoneNumberId, token) => {
  const resp = await fetch(
    `${GRAPH_BASE_URL}/${META_API_VERSION}/${phoneNumberId}?fields=display_phone_number,verified_name,code_verification_status,quality_rating,platform_type,status`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(
      err?.error?.message || "Failed to fetch phone number details from Meta",
    );
  }
  return await resp.json();
};

/**
 * Helper → Fetch Messaging limit tier
 */
const fetchMessagingTier = async (whatsappBusinessId, phoneNumberId, token) => {
  try {
    const resp = await fetch(
      `${GRAPH_BASE_URL}/${META_API_VERSION}/${whatsappBusinessId}/phone_numbers`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!resp.ok) return "UNKNOWN";
    const data = await resp.json();
    if (data?.data && Array.isArray(data.data)) {
      const numberObj = data.data.find((n) => n.id === phoneNumberId);
      if (numberObj) {
        return numberObj.messaging_limit_tier || "UNKNOWN";
      }
    }
    return "UNKNOWN";
  } catch (e) {
    console.error("Could not fetch tier", e);
    return "UNKNOWN";
  }
};

/**
 * =====================================
 * GET WHATSAPP STATUS (SAFE)
 * =====================================
 * Access: authenticated (GYM_OWNER, STAFF, SUPERADMIN)
 */
router.get("/status", authenticateToken, async (req, res) => {
  const { gymSlug } = req.params;

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
      select: {
        id: true,
        whatsapp_connected: true,
        whatsapp_phone_number_id: true,
        whatsapp_waba_id: true,
        whatsapp_business_id: true,
        whatsapp_access_token: true, // Need this to query Meta
        whatsappStatus: true,
        whatsappVerifiedAt: true,
        whatsappLastError: true,
        whatsappVerificationStatus: true,
        whatsappQualityRating: true,
        whatsappMessagingTier: true,
        whatsappVerifiedName: true,
        whatsappDisplayPhoneNumber: true,
        whatsappNameStatus: true,
        pendingDisplayName: true,
        pendingNameStatus: true,
        lastNameChangeRequestAt: true,
        lastNameApprovedAt: true,
        lastRegistrationAttemptAt: true,
        registrationError: true,
      },
    });

    if (!gym) {
      return res.status(404).json({ error: "Gym not found" });
    }

    // Check if user requested a forced sync from Meta
    if (
      req.query.forceMetaCheck === "true" &&
      gym.whatsapp_phone_number_id &&
      gym.whatsapp_access_token
    ) {
      try {
        const accessToken = decrypt(gym.whatsapp_access_token);
        const metaRes = await fetch(
          `${GRAPH_BASE_URL}/${META_API_VERSION}/${gym.whatsapp_phone_number_id}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          const updates = {};

          if (
            metaData.verified_name &&
            metaData.verified_name !== gym.whatsappVerifiedName
          ) {
            updates.whatsappVerifiedName = metaData.verified_name;
          }
          if (
            metaData.name_status &&
            metaData.name_status !== gym.whatsappNameStatus
          ) {
            updates.whatsappNameStatus = metaData.name_status;
          }

          const newNameStatus = metaData.new_name_status || null;

          // If Meta shows no pending request, but we have one pending review, it means it got processed
          if (
            gym.pendingNameStatus === "PENDING_REVIEW" &&
            newNameStatus !== "PENDING_REVIEW"
          ) {
            updates.pendingNameStatus = newNameStatus || "APPROVED"; // Could be approved or declined
            if (newNameStatus === "APPROVED" || !newNameStatus) {
              // If it's approved, update history and set to APPROVED so the queue picks it up
              updates.pendingNameStatus = "APPROVED";
              await prisma.whatsAppDisplayNameHistory.updateMany({
                where: {
                  gymId: gym.id,
                  status: "PENDING_REVIEW",
                  isActive: true,
                },
                data: { status: "APPROVED", approvedAt: new Date() },
              });
            } else if (
              newNameStatus === "DECLINED" ||
              newNameStatus === "REJECTED"
            ) {
              updates.pendingNameStatus = "DECLINED";
              await prisma.whatsAppDisplayNameHistory.updateMany({
                where: {
                  gymId: gym.id,
                  status: "PENDING_REVIEW",
                  isActive: true,
                },
                data: { status: "DECLINED", isActive: false },
              });
            }
          }

          if (Object.keys(updates).length > 0) {
            const updatedGym = await prisma.gym.update({
              where: { id: gym.id },
              data: updates,
            });
            Object.assign(gym, updates);
          }
        }
      } catch (syncErr) {
        console.error("Failed to sync from Meta:", syncErr);
      }
    }

    if (!gym) {
      return res.status(404).json({ error: "Gym not found" });
    }

    // Fetch message counts for analytics
    const messageStats = await prisma.whatsAppMessage.groupBy({
      by: ["status"],
      where: { gymId: gym.id },
      _count: { _all: true },
    });

    const analytics = {
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      total: 0,
    };

    messageStats.forEach((stat) => {
      const count = stat._count._all;
      analytics.total += count;
      if (stat.status === "SENT") analytics.sent += count;
      if (stat.status === "DELIVERED") analytics.delivered += count;
      if (stat.status === "READ") analytics.read += count;
      if (stat.status === "FAILED") analytics.failed += count;
    });

    // Fetch synced templates
    const templates = await prisma.whatsAppTemplate.findMany({
      where: { gymId: gym.id },
      select: {
        id: true,
        templateName: true,
        status: true,
        category: true,
        language: true,
      },
    });

    res.json({
      connected: gym.whatsapp_connected,
      phoneNumber: gym.whatsappDisplayPhoneNumber || null,
      phoneNumberId: gym.whatsapp_phone_number_id || null,
      wabaId: gym.whatsapp_waba_id || null,
      businessId: gym.whatsapp_business_id || null,
      facebookAppId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || null,
      facebookConfigId: process.env.NEXT_PUBLIC_FB_SIGNUP_CONFIG_ID || null,
      whatsappVerificationStatus:
        gym.whatsappVerificationStatus || "NOT_VERIFIED",
      whatsappQualityRating: gym.whatsappQualityRating || "UNKNOWN",
      whatsappMessagingTier: gym.whatsappMessagingTier || "UNKNOWN",
      whatsappVerifiedName: gym.whatsappVerifiedName || null,
      whatsappDisplayPhoneNumber: gym.whatsappDisplayPhoneNumber || null,
      whatsappNameStatus: gym.whatsappNameStatus || null,
      pendingDisplayName: gym.pendingDisplayName || null,
      pendingNameStatus: gym.pendingNameStatus || null,
      lastNameChangeRequestAt: gym.lastNameChangeRequestAt || null,
      lastNameApprovedAt: gym.lastNameApprovedAt || null,
      lastRegistrationAttemptAt: gym.lastRegistrationAttemptAt || null,
      registrationError: gym.registrationError || null,
      analytics,
      templates,
    });
  } catch (err) {
    console.error("Status check error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * =====================================
 * CONNECT WHATSAPP MANUALLY
 * =====================================
 * Access: GYM_OWNER, SUPERADMIN
 */
router.post(
  "/connect",
  authenticateToken,
  requireRoles(["GYM_OWNER", "SUPERADMIN"]),
  async (req, res) => {
    const { wabaId, phoneNumberId, accessToken, businessId } = req.body;
    const { gymSlug } = req.params;

    console.log(
      `🔌 [Manual Connect] Connection requested for Gym Slug: "${gymSlug}" | Phone ID: ${phoneNumberId} | WABA ID: ${wabaId}`,
    );

    if (!wabaId || !phoneNumberId || !accessToken) {
      console.warn(
        "⚠️ [Manual Connect] Request failed validation: missing WABA ID, Phone ID, or Access Token.",
      );
      return res.status(400).json({
        error: "WABA ID, Phone Number ID, and Access Token are required",
      });
    }

    try {
      const gym = await prisma.gym.findUnique({
        where: { slug: gymSlug.toLowerCase() },
      });

      if (!gym) {
        console.warn(`⚠️ [Manual Connect] Gym not found for slug: ${gymSlug}`);
        return res.status(404).json({ error: "Gym not found" });
      }

      // 1️⃣ Validate credentials with Meta API
      console.log(
        `🔌 [Manual Connect] Verifying credentials for Phone ID: ${phoneNumberId} on Meta...`,
      );
      const phoneData = await fetchPhoneDetails(phoneNumberId, accessToken);
      console.log(
        `🔌 [Manual Connect] Meta response phoneData:`,
        JSON.stringify(phoneData),
      );

      const whatsappVerificationStatus =
        phoneData?.code_verification_status || "NOT_VERIFIED";
      const whatsappQualityRating = phoneData?.quality_rating || "UNKNOWN";
      const whatsappVerifiedName = phoneData?.verified_name || null;
      const whatsappDisplayPhoneNumber =
        phoneData?.display_phone_number || null;

      // 2️⃣ Fetch Limit Tier
      console.log(
        `🔌 [Manual Connect] Fetching messaging tier for WABA: ${wabaId}...`,
      );
      const whatsappMessagingTier = await fetchMessagingTier(
        wabaId,
        phoneNumberId,
        accessToken,
      );
      console.log(
        `🔌 [Manual Connect] Messaging tier fetched: ${whatsappMessagingTier}`,
      );

      // 3️⃣ Attempt to Register Phone Number
      const isTestNumber =
        whatsappVerifiedName?.toLowerCase() === "test number" ||
        whatsappDisplayPhoneNumber?.replace(/\D/g, "").startsWith("1555");
      const isAlreadyCloudAPI = phoneData?.platform_type === "CLOUD_API";

      if (!isTestNumber && !isAlreadyCloudAPI) {
        console.log(
          `🔌 [Manual Connect] Attempting registerPhoneNumber for Phone ID: ${phoneNumberId}...`,
        );
        const registration = await registerPhoneNumber(
          phoneNumberId,
          accessToken,
        );
        if (!registration.success) {
          console.error(
            `❌ [Manual Connect] Phone number registration failed:`,
            registration.error,
          );
          return res.status(400).json({
            error: "Phone number registration failed",
            metaError: registration.error,
          });
        }
      } else {
        console.log(
          `🔌 [Manual Connect] Skipping line registration (Is Test: ${isTestNumber}, Is CloudAPI: ${isAlreadyCloudAPI})`,
        );
      }

      // 4️⃣ Attempt to Subscribe App
      console.log(
        `🔌 [Manual Connect] Subscribing Facebook App to WABA: ${wabaId}...`,
      );
      const subscription = await subscribeApp(wabaId, accessToken);
      if (!subscription.success) {
        console.error(
          `❌ [Manual Connect] Webhook subscription failed:`,
          subscription.error,
        );
        return res.status(400).json({
          error: "Webhook subscription failed",
          metaError: subscription.error,
        });
      }

      // 5️⃣ Encrypt token & save
      console.log(
        `💾 [Manual Connect] Encrypting access token & saving details to DB for Gym: "${gym.name}"`,
      );
      const encryptedToken = encrypt(accessToken);

      await prisma.gym.update({
        where: { id: gym.id },
        data: {
          whatsapp_connected: true,
          whatsapp_waba_id: wabaId,
          whatsapp_phone_number_id: phoneNumberId,
          whatsapp_business_id: businessId || wabaId,
          whatsapp_access_token: encryptedToken,
          whatsappStatus: "connected",
          whatsappVerifiedAt: new Date(),
          whatsappLastError: null,
          whatsappVerificationStatus,
          whatsappQualityRating,
          whatsappMessagingTier,
          whatsappVerifiedName,
          whatsappDisplayPhoneNumber,
        },
      });

      console.log(
        `✅ [Manual Connect] Successfully connected WhatsApp for gym: ${gymSlug}`,
      );
      res.json({
        success: true,
        message: "WhatsApp successfully connected manually",
      });
    } catch (err) {
      console.error("❌ [Manual Connect] Error:", err);
      res
        .status(400)
        .json({ error: err.message || "Manual setup connection failed" });
    }
  },
);

/**
 * =====================================
 * EMBEDDED SIGNUP CALLBACK
 * =====================================
 * Access: GYM_OWNER, SUPERADMIN
 */
router.post(
  "/embedded-setup",
  authenticateToken,
  requireRoles(["GYM_OWNER", "SUPERADMIN"]),
  async (req, res) => {
    const { code, wabaId, phoneNumberId, businessId } = req.body;
    const { gymSlug } = req.params;

    console.log(
      `🔌 [Embedded Setup] Request received for Gym Slug: "${gymSlug}" | Phone ID: ${phoneNumberId} | WABA ID: ${wabaId}`,
    );

    if (!code || !wabaId || !phoneNumberId) {
      console.warn(
        "⚠️ [Embedded Setup] Request failed validation: missing OAuth code, WABA ID, or Phone ID.",
      );
      return res
        .status(400)
        .json({ error: "Missing required embedded signup data" });
    }

    try {
      const gym = await prisma.gym.findUnique({
        where: { slug: gymSlug.toLowerCase() },
      });

      if (!gym) {
        console.warn(`⚠️ [Embedded Setup] Gym not found for slug: ${gymSlug}`);
        return res.status(404).json({ error: "Gym not found" });
      }

      const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
      const appSecret = process.env.FACEBOOK_APP_SECRET;

      if (!appId || !appSecret) {
        console.error(
          "❌ [Embedded Setup] Facebook App Credentials missing in environment variables!",
        );
        return res
          .status(500)
          .json({ error: "Meta App settings missing on backend server" });
      }

      // 1️⃣ Exchange code for token
      console.log(
        `🔌 [Embedded Setup] Exchanging OAuth code for Meta access token...`,
      );
      const qs = new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        code,
      });

      const tokenResp = await fetch(
        `${GRAPH_BASE_URL}/${META_API_VERSION}/oauth/access_token?${qs.toString()}`,
      );
      const tokenData = await tokenResp.json();

      if (!tokenResp.ok || !tokenData.access_token) {
        console.error(
          `❌ [Embedded Setup] OAuth token exchange failed:`,
          tokenData,
        );
        return res.status(400).json({
          error: "OAuth token exchange failed",
          metaError: tokenData,
        });
      }

      const accessToken = tokenData.access_token;
      console.log("🔌 [Embedded Setup] OAuth token exchange successful.");

      // 2️⃣ Fetch details
      console.log(
        `🔌 [Embedded Setup] Fetching phone details for Phone ID: ${phoneNumberId}...`,
      );
      const phoneData = await fetchPhoneDetails(phoneNumberId, accessToken);
      console.log(
        `🔌 [Embedded Setup] Phone details data:`,
        JSON.stringify(phoneData),
      );

      const whatsappVerificationStatus =
        phoneData?.code_verification_status || "NOT_VERIFIED";
      const whatsappQualityRating = phoneData?.quality_rating || "UNKNOWN";
      const whatsappVerifiedName = phoneData?.verified_name || null;
      const whatsappDisplayPhoneNumber =
        phoneData?.display_phone_number || null;

      // 3️⃣ Fetch Tier
      console.log(
        `🔌 [Embedded Setup] Fetching messaging limit tier for WABA: ${wabaId}...`,
      );
      const whatsappMessagingTier = await fetchMessagingTier(
        wabaId,
        phoneNumberId,
        accessToken,
      );
      console.log(
        `🔌 [Embedded Setup] Messaging tier fetched: ${whatsappMessagingTier}`,
      );

      // 4️⃣ Attempt to Register
      const isTestNumber =
        whatsappVerifiedName?.toLowerCase() === "test number" ||
        whatsappDisplayPhoneNumber?.replace(/\D/g, "").startsWith("1555");
      const isAlreadyCloudAPI = phoneData?.platform_type === "CLOUD_API";

      if (!isTestNumber && !isAlreadyCloudAPI) {
        console.log(
          `🔌 [Embedded Setup] Attempting registerPhoneNumber for Phone ID: ${phoneNumberId}...`,
        );
        const registration = await registerPhoneNumber(
          phoneNumberId,
          accessToken,
        );
        if (!registration.success) {
          console.error(
            "❌ [Embedded Setup] Phone number registration failed:",
            registration.error,
          );
          await prisma.gym.update({
            where: { id: gym.id },
            data: {
              whatsappStatus: "error",
              whatsappLastError: JSON.stringify(registration.error),
            },
          });

          return res.status(400).json({
            error: "Phone number registration failed",
            metaError: registration.error,
          });
        }
      } else {
        console.log(
          `🔌 [Embedded Setup] Skipping line registration (Is Test: ${isTestNumber}, Is CloudAPI: ${isAlreadyCloudAPI})`,
        );
      }

      // 5️⃣ Subscribe App
      console.log(
        `🔌 [Embedded Setup] Subscribing Facebook App to WABA: ${wabaId}...`,
      );
      const subscription = await subscribeApp(wabaId, accessToken);
      if (!subscription.success) {
        console.error(
          "❌ [Embedded Setup] Webhook app subscription failed:",
          subscription.error,
        );
        await prisma.gym.update({
          where: { id: gym.id },
          data: {
            whatsappStatus: "error",
            whatsappLastError: JSON.stringify(subscription.error),
          },
        });

        return res.status(400).json({
          error: "Webhook subscription failed",
          metaError: subscription.error,
        });
      }

      // 6️⃣ Encrypt token & save
      console.log(
        `💾 [Embedded Setup] Encrypting access token & saving connection details for Gym: "${gym.name}"`,
      );
      const encryptedToken = encrypt(accessToken);

      await prisma.gym.update({
        where: { id: gym.id },
        data: {
          whatsapp_connected: true,
          whatsapp_waba_id: wabaId,
          whatsapp_phone_number_id: phoneNumberId,
          whatsapp_business_id: businessId || wabaId,
          whatsapp_access_token: encryptedToken,
          whatsappStatus: "connected",
          whatsappVerifiedAt: new Date(),
          whatsappLastError: null,
          whatsappVerificationStatus,
          whatsappQualityRating,
          whatsappMessagingTier,
          whatsappVerifiedName,
          whatsappDisplayPhoneNumber,
        },
      });

      console.log(
        `✅ [Embedded Setup] Successfully completed embedded signup for Gym: ${gymSlug}`,
      );
      res.json({ success: true });
    } catch (err) {
      console.error("❌ [Embedded Setup] Error:", err);
      res.status(400).json({ error: err.message || "Embedded signup failed" });
    }
  },
);

/**
 * =====================================
 * DISCONNECT WHATSAPP
 * =====================================
 * Access: GYM_OWNER, SUPERADMIN
 */
router.post(
  "/disconnect",
  authenticateToken,
  requireRoles(["GYM_OWNER", "SUPERADMIN"]),
  async (req, res) => {
    const { gymSlug } = req.params;
    console.log(`🔌 [Disconnect] Request received for Gym Slug: "${gymSlug}"`);

    try {
      const gym = await prisma.gym.findUnique({
        where: { slug: gymSlug.toLowerCase() },
      });

      if (!gym) {
        console.warn(`⚠️ [Disconnect] Gym not found for slug: ${gymSlug}`);
        return res.status(404).json({ error: "Gym not found" });
      }

      console.log(
        `💾 [Disconnect] Clearing WhatsApp configuration for Gym: "${gym.name}"`,
      );
      await prisma.gym.update({
        where: { id: gym.id },
        data: {
          whatsapp_connected: false,
          whatsapp_waba_id: null,
          whatsapp_phone_number_id: null,
          whatsapp_business_id: null,
          whatsapp_access_token: null,
          whatsappStatus: "disconnected",
          whatsappVerifiedAt: null,
          whatsappLastError: null,
          whatsappVerificationStatus: "NOT_VERIFIED",
          whatsappQualityRating: "UNKNOWN",
          whatsappMessagingTier: "UNKNOWN",
          whatsappVerifiedName: null,
          whatsappDisplayPhoneNumber: null,
        },
      });

      console.log(
        `✅ [Disconnect] Successfully disconnected WhatsApp for Gym: "${gym.slug}"`,
      );
      res.json({
        success: true,
        message: "WhatsApp successfully disconnected",
      });
    } catch (err) {
      console.error("❌ [Disconnect] Error:", err);
      res.status(500).json({ error: "Failed to disconnect WhatsApp" });
    }
  },
);

/**
 * =====================================
 * REFRESH WHATSAPP STATUS
 * =====================================
 * Access: GYM_OWNER, SUPERADMIN
 */
router.post(
  "/refresh-status",
  authenticateToken,
  requireRoles(["GYM_OWNER", "SUPERADMIN"]),
  async (req, res) => {
    const { gymSlug } = req.params;
    console.log(`🔌 [Refresh Status] Refresh requested for Gym: "${gymSlug}"`);

    try {
      const gym = await prisma.gym.findUnique({
        where: { slug: gymSlug.toLowerCase() },
      });

      if (!gym || !gym.whatsapp_access_token || !gym.whatsapp_phone_number_id) {
        console.warn(
          `⚠️ [Refresh Status] Gym "${gymSlug}" is not fully configured for WhatsApp.`,
        );
        return res.status(400).json({ error: "WhatsApp not fully configured" });
      }

      const accessToken = decrypt(gym.whatsapp_access_token);
      const phoneNumberId = gym.whatsapp_phone_number_id;
      const wabaId = gym.whatsapp_waba_id || gym.whatsapp_business_id;

      // 1️⃣ Fetch Details
      console.log(
        `🔌 [Refresh Status] Fetching phone details from Meta for Phone ID: ${phoneNumberId}...`,
      );
      const phoneData = await fetchPhoneDetails(phoneNumberId, accessToken);
      console.log(
        `🔌 [Refresh Status] Phone details response:`,
        JSON.stringify(phoneData),
      );

      const whatsappVerificationStatus =
        phoneData?.code_verification_status || "NOT_VERIFIED";
      const whatsappQualityRating = phoneData?.quality_rating || "UNKNOWN";
      const whatsappVerifiedName = phoneData?.verified_name || null;
      const whatsappDisplayPhoneNumber =
        phoneData?.display_phone_number || null;

      // 2️⃣ Fetch Tier
      let whatsappMessagingTier = gym.whatsappMessagingTier || "UNKNOWN";
      if (wabaId) {
        console.log(
          `🔌 [Refresh Status] Fetching messaging limit tier for WABA: ${wabaId}...`,
        );
        whatsappMessagingTier = await fetchMessagingTier(
          wabaId,
          phoneNumberId,
          accessToken,
        );
        console.log(`🔌 [Refresh Status] Limit tier: ${whatsappMessagingTier}`);
      }

      console.log(
        `💾 [Refresh Status] Updating Gym details in DB for slug: ${gymSlug}`,
      );
      const updated = await prisma.gym.update({
        where: { id: gym.id },
        data: {
          whatsappVerificationStatus,
          whatsappQualityRating,
          whatsappMessagingTier,
          whatsappVerifiedName,
          whatsappDisplayPhoneNumber,
        },
        select: {
          whatsapp_connected: true,
          whatsappVerificationStatus: true,
          whatsappQualityRating: true,
          whatsappMessagingTier: true,
          whatsappVerifiedName: true,
          whatsappDisplayPhoneNumber: true,
        },
      });

      console.log(
        `✅ [Refresh Status] WhatsApp status refreshed successfully for Gym: "${gymSlug}"`,
      );
      res.json(updated);
    } catch (err) {
      console.error("❌ [Refresh Status] Error:", err);
      res
        .status(400)
        .json({ error: err.message || "Failed to refresh WhatsApp status" });
    }
  },
);

/**
 * =====================================
 * REVERIFY WHATSAPP REGISTRATION
 * =====================================
 * Access: GYM_OWNER, SUPERADMIN
 */
router.post(
  "/reverify",
  authenticateToken,
  requireRoles(["GYM_OWNER", "SUPERADMIN"]),
  async (req, res) => {
    const { gymSlug } = req.params;
    console.log(
      `🔌 [Reverify] Re-verification requested for Gym: "${gymSlug}"`,
    );

    try {
      const gym = await prisma.gym.findUnique({
        where: { slug: gymSlug.toLowerCase() },
      });

      if (!gym || !gym.whatsapp_access_token || !gym.whatsapp_phone_number_id) {
        console.warn(
          `⚠️ [Reverify] Gym "${gymSlug}" is not configured for WhatsApp.`,
        );
        return res.status(400).json({ error: "WhatsApp not fully configured" });
      }

      const accessToken = decrypt(gym.whatsapp_access_token);
      const phoneNumberId = gym.whatsapp_phone_number_id;

      // Retries registration
      console.log(
        `🔌 [Reverify] Retrying registerPhoneNumber for Phone ID: ${phoneNumberId}...`,
      );
      const registration = await registerPhoneNumber(
        phoneNumberId,
        accessToken,
      );

      if (!registration.success) {
        const errCode = registration.error?.error?.code;
        const isTokenExpired = errCode === 190 || errCode === 463;

        console.error(
          `❌ [Reverify] Phone line registration retry failed. Code: ${errCode}`,
          registration.error,
        );
        return res.status(400).json({
          error: isTokenExpired
            ? "Your Meta access token has expired. Please reconfigure the connection."
            : "Phone number registration failed",
          metaError: registration.error,
        });
      }

      // Sync Health Status
      console.log(`🔌 [Reverify] Fetching updated phone details from Meta...`);
      const phoneData = await fetchPhoneDetails(phoneNumberId, accessToken);
      console.log(`🔌 [Reverify] Phone details:`, JSON.stringify(phoneData));

      const whatsappVerificationStatus =
        phoneData?.code_verification_status || "NOT_VERIFIED";
      const whatsappQualityRating = phoneData?.quality_rating || "UNKNOWN";
      const whatsappVerifiedName = phoneData?.verified_name || null;
      const whatsappDisplayPhoneNumber =
        phoneData?.display_phone_number || null;

      console.log(
        `💾 [Reverify] Updating Gym details in DB for Gym: "${gymSlug}"`,
      );
      const updated = await prisma.gym.update({
        where: { id: gym.id },
        data: {
          whatsappVerificationStatus,
          whatsappQualityRating,
          whatsappVerifiedName,
          whatsappDisplayPhoneNumber,
        },
      });

      console.log(`✅ [Reverify] Reverify successful for Gym: "${gymSlug}"`);
      res.json(updated);
    } catch (err) {
      console.error("❌ [Reverify] Error:", err);
      res
        .status(400)
        .json({ error: err.message || "Reverify registration failed" });
    }
  },
);

/**
 * =====================================
 * REQUEST VERIFICATION CODE
 * =====================================
 * Access: GYM_OWNER, SUPERADMIN
 */
router.post(
  "/register",
  authenticateToken,
  requireRoles(["GYM_OWNER", "SUPERADMIN"]),
  async (req, res) => {
    const { gymSlug } = req.params;
    console.log(
      `🔌 [Register Code] Requesting registration code for Gym: "${gymSlug}" via ${DEFAULT_CODE_METHOD}`,
    );

    try {
      const gym = await prisma.gym.findUnique({
        where: { slug: gymSlug.toLowerCase() },
      });

      if (!gym || !gym.whatsapp_access_token || !gym.whatsapp_phone_number_id) {
        console.warn(
          `⚠️ [Register Code] Gym "${gymSlug}" lacks required configuration.`,
        );
        return res.status(400).json({ error: "WhatsApp not fully configured" });
      }

      const accessToken = decrypt(gym.whatsapp_access_token);
      const phoneNumberId = gym.whatsapp_phone_number_id;

      console.log(
        `🔌 [Register Code] Sending code request to Meta for Phone ID: ${phoneNumberId}...`,
      );
      const resp = await fetch(
        `${GRAPH_BASE_URL}/${META_API_VERSION}/${phoneNumberId}/request_code`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            code_method: DEFAULT_CODE_METHOD,
            language: DEFAULT_LANGUAGE,
          }),
        },
      );

      const data = await resp.json();

      if (!resp.ok) {
        console.error(`❌ [Register Code] Request failed:`, data);
        return res.status(400).json({
          error: "Failed to request verification code",
          metaError: data?.error || data,
        });
      }

      console.log(
        `✅ [Register Code] Successfully requested validation code from Meta.`,
      );
      res.json({
        success: true,
        message: `Verification code requested via ${DEFAULT_CODE_METHOD}`,
      });
    } catch (err) {
      console.error("❌ [Register Code] Error:", err);
      res
        .status(400)
        .json({ error: err.message || "Failed to request verification code" });
    }
  },
);

/**
 * =====================================
 * VERIFY CODE & REGISTER LINE
 * =====================================
 * Access: GYM_OWNER, SUPERADMIN
 */
router.post(
  "/verify",
  authenticateToken,
  requireRoles(["GYM_OWNER", "SUPERADMIN"]),
  async (req, res) => {
    const { code } = req.body;
    const { gymSlug } = req.params;

    console.log(
      `🔌 [Verify Code] Verification code validation submitted for Gym: "${gymSlug}"`,
    );

    if (!code) {
      console.warn("⚠️ [Verify Code] Validation code missing in request body.");
      return res.status(400).json({ error: "Verification code is required" });
    }

    try {
      const gym = await prisma.gym.findUnique({
        where: { slug: gymSlug.toLowerCase() },
      });

      if (!gym || !gym.whatsapp_access_token || !gym.whatsapp_phone_number_id) {
        console.warn(
          `⚠️ [Verify Code] Gym "${gymSlug}" lacks required configuration.`,
        );
        return res.status(400).json({ error: "WhatsApp not fully configured" });
      }

      const accessToken = decrypt(gym.whatsapp_access_token);
      const phoneNumberId = gym.whatsapp_phone_number_id;

      // 1️⃣ Verify the code
      console.log(
        `🔌 [Verify Code] Sending code verification request to Meta for Phone ID: ${phoneNumberId}...`,
      );
      const verifyResp = await fetch(
        `${GRAPH_BASE_URL}/${META_API_VERSION}/${phoneNumberId}/verify_code`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code,
          }),
        },
      );

      const verifyData = await verifyResp.json();

      if (!verifyResp.ok) {
        console.error(
          "❌ [Verify Code] Meta code verification failed:",
          verifyData,
        );
        return res.status(400).json({
          error: "Verification failed",
          metaError: verifyData?.error || verifyData,
        });
      }
      console.log("🔌 [Verify Code] Meta code verification succeeded.");

      // 2️⃣ Register phone line
      console.log(
        `🔌 [Verify Code] Attempting registerPhoneNumber for Phone ID: ${phoneNumberId}...`,
      );
      const registration = await registerPhoneNumber(
        phoneNumberId,
        accessToken,
      );
      if (!registration.success) {
        console.error(
          "❌ [Verify Code] Registration step failed:",
          registration.error,
        );
        return res.status(400).json({
          error: "Code verified but registration failed",
          metaError: registration.error,
        });
      }

      // 3️⃣ Refresh Gym record
      console.log("🔌 [Verify Code] Fetching final phone status from Meta...");
      const phoneData = await fetchPhoneDetails(phoneNumberId, accessToken);
      const whatsappVerificationStatus =
        phoneData?.code_verification_status || "VERIFIED";

      console.log(
        `💾 [Verify Code] Saving verified status to DB for Gym: "${gymSlug}"`,
      );
      const updated = await prisma.gym.update({
        where: { id: gym.id },
        data: {
          whatsappVerificationStatus,
          whatsapp_connected: true,
          whatsappStatus: "connected",
          whatsappVerifiedAt: new Date(),
        },
      });

      console.log(
        `✅ [Verify Code] Successfully verified and connected WhatsApp for Gym: "${gymSlug}"`,
      );
      res.json(updated);
    } catch (err) {
      console.error("❌ [Verify Code] Error:", err);
      res.status(400).json({ error: err.message || "Verification failed" });
    }
  },
);

/**
 * =====================================
 * SYNC TEMPLATES FROM META
 * =====================================
 * Access: GYM_OWNER, SUPERADMIN
 */
router.post(
  "/sync-templates",
  authenticateToken,
  requireRoles(["GYM_OWNER", "SUPERADMIN"]),
  async (req, res) => {
    const { gymSlug } = req.params;
    console.log(
      `🔌 [Sync Templates] Template synchronization requested for Gym: "${gymSlug}"`,
    );

    try {
      const gym = await prisma.gym.findUnique({
        where: { slug: gymSlug.toLowerCase() },
      });

      if (!gym || !gym.whatsapp_access_token || !gym.whatsapp_waba_id) {
        console.warn(
          `⚠️ [Sync Templates] Gym "${gymSlug}" is not configured for WhatsApp.`,
        );
        return res.status(400).json({ error: "WhatsApp not fully configured" });
      }

      const accessToken = decrypt(gym.whatsapp_access_token);
      const wabaId = gym.whatsapp_waba_id;

      console.log(
        `🔌 [Sync Templates] Fetching templates from Meta for WABA: ${wabaId}...`,
      );
      const resp = await fetch(
        `${GRAPH_BASE_URL}/${META_API_VERSION}/${wabaId}/message_templates?limit=100`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const data = await resp.json();

      if (!resp.ok) {
        console.error(
          `❌ [Sync Templates] Failed to fetch templates from Meta:`,
          data,
        );
        return res.status(400).json({
          error: "Failed to fetch templates from Meta",
          metaError: data,
        });
      }

      if (data && Array.isArray(data.data)) {
        console.log(
          `🔌 [Sync Templates] Fetched ${data.data.length} templates. Upserting to local database...`,
        );
        for (const metaTpl of data.data) {
          await prisma.whatsAppTemplate.upsert({
            where: {
              gymId_templateName: {
                gymId: gym.id,
                templateName: metaTpl.name,
              },
            },
            update: {
              metaTemplateId: metaTpl.id,
              language: metaTpl.language,
              category: metaTpl.category,
              status: metaTpl.status,
              components: metaTpl.components || [],
            },
            create: {
              gymId: gym.id,
              templateName: metaTpl.name,
              metaTemplateId: metaTpl.id,
              language: metaTpl.language,
              category: metaTpl.category,
              status: metaTpl.status,
              components: metaTpl.components || [],
            },
          });
        }
        console.log(
          `💾 [Sync Templates] Database synchronization of templates complete.`,
        );
      }

      res.json({
        success: true,
        message: "Templates synchronized successfully",
      });
    } catch (err) {
      console.error("❌ [Sync Templates] Error:", err);
      res
        .status(400)
        .json({ error: err.message || "Failed to synchronize templates" });
    }
  },
);

/**
 * =====================================
 * GET BUSINESS PROFILE
 * =====================================
 * Access: GYM_OWNER, SUPERADMIN
 */
router.get(
  "/business-profile",
  authenticateToken,
  requireRoles(["GYM_OWNER", "SUPERADMIN"]),
  async (req, res) => {
    const { gymSlug } = req.params;

    try {
      const gym = await prisma.gym.findUnique({
        where: { slug: gymSlug.toLowerCase() },
      });

      if (!gym || !gym.whatsapp_access_token || !gym.whatsapp_phone_number_id) {
        return res.status(400).json({ error: "WhatsApp not fully configured" });
      }

      const accessToken = decrypt(gym.whatsapp_access_token);
      const phoneNumberId = gym.whatsapp_phone_number_id;

      const resp = await fetch(
        `${GRAPH_BASE_URL}/${META_API_VERSION}/${phoneNumberId}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const data = await resp.json();

      if (!resp.ok) {
        return res.status(400).json({
          error: "Failed to fetch business profile",
          metaError: data?.error || data,
        });
      }

      res.json(data.data?.[0] || {});
    } catch (err) {
      console.error("❌ [Get Business Profile] Error:", err);
      res.status(500).json({ error: "Failed to fetch business profile" });
    }
  },
);

/**
 * =====================================
 * UPDATE BUSINESS PROFILE
 * =====================================
 * Access: GYM_OWNER, SUPERADMIN
 */
router.post(
  "/business-profile",
  authenticateToken,
  requireRoles(["GYM_OWNER", "SUPERADMIN"]),
  upload.single("profile_picture"),
  async (req, res) => {
    const { gymSlug } = req.params;

    try {
      const gym = await prisma.gym.findUnique({
        where: { slug: gymSlug.toLowerCase() },
      });

      if (!gym || !gym.whatsapp_access_token || !gym.whatsapp_phone_number_id) {
        return res.status(400).json({ error: "WhatsApp not fully configured" });
      }

      const accessToken = decrypt(gym.whatsapp_access_token);
      const phoneNumberId = gym.whatsapp_phone_number_id;

      let profile_picture_handle = undefined;

      if (req.file) {
        try {
          profile_picture_handle = await uploadTemplateMediaToMeta({
            accessToken,
            appId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID,
            buffer: req.file.buffer,
            mimeType: req.file.mimetype,
            fileName: req.file.originalname,
          });
        } catch (err) {
          console.error("Failed to upload profile picture to Meta:", err);
          return res.status(400).json({
            error: "Failed to upload profile picture to Meta",
            metaError: err.message,
          });
        }
      }

      let websites = [];
      if (req.body.websites) {
        try {
          websites = JSON.parse(req.body.websites);
        } catch (e) {
          websites =
            typeof req.body.websites === "string"
              ? [req.body.websites]
              : req.body.websites;
        }
      }

      const payload = {
        messaging_product: "whatsapp",
        about: req.body.about || "",
        address: req.body.address || "",
        description: req.body.description || "",
        email: req.body.email || "",
        vertical: req.body.vertical || "",
        websites: websites,
      };

      if (profile_picture_handle) {
        payload.profile_picture_handle = profile_picture_handle;
      }

      const resp = await fetch(
        `${GRAPH_BASE_URL}/${META_API_VERSION}/${phoneNumberId}/whatsapp_business_profile`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await resp.json();

      if (!resp.ok) {
        return res.status(400).json({
          error: "Failed to update business profile",
          metaError: data?.error || data,
        });
      }

      res.json({
        success: true,
        message: "Business profile updated successfully",
      });
    } catch (err) {
      console.error("❌ [Update Business Profile] Error:", err);
      res.status(500).json({ error: "Failed to update business profile" });
    }
  },
);

/**
 * =====================================
 * REQUEST DISPLAY NAME CHANGE
 * =====================================
 * Access: GYM_OWNER, SUPERADMIN
 */
router.post(
  "/display-name",
  authenticateToken,
  requireRoles(["GYM_OWNER", "SUPERADMIN"]),
  async (req, res) => {
    const { gymSlug } = req.params;
    const { displayName } = req.body;
    const idempotencyKey = req.headers["idempotency-key"] || null;

    try {
      const gym = await prisma.gym.findUnique({
        where: { slug: gymSlug.toLowerCase() },
      });

      if (!gym || !gym.whatsapp_access_token || !gym.whatsapp_phone_number_id) {
        return res.status(400).json({ error: "WhatsApp not fully configured" });
      }

      const accessToken = decrypt(gym.whatsapp_access_token);
      const phoneNumberId = gym.whatsapp_phone_number_id;

      // Duplicate prevention constraint check
      const activeRequest = await prisma.whatsAppDisplayNameHistory.findFirst({
        where: { gymId: gym.id, isActive: true },
      });

      if (activeRequest) {
        return res.status(400).json({
          error: "A display name change is already under review or active.",
        });
      }

      // Rate limit check: max 10 requests per 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentRequestsCount = await prisma.whatsAppDisplayNameHistory.count(
        {
          where: {
            gymId: gym.id,
            requestedAt: { gte: thirtyDaysAgo },
          },
        },
      );

      if (recentRequestsCount >= 10) {
        return res.status(429).json({
          error: "Display name limit reached (10 changes every 30 days).",
        });
      }

      // API request to Meta
      const resp = await fetch(
        `${GRAPH_BASE_URL}/${META_API_VERSION}/${phoneNumberId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            new_display_name: displayName,
          }),
        },
      );

      const data = await resp.json();

      if (!resp.ok) {
        return res.status(400).json({
          error: "Failed to request display name change",
          metaError: data?.error || data,
        });
      }

      // Transactional DB update
      await prisma.$transaction([
        prisma.whatsAppDisplayNameHistory.create({
          data: {
            gymId: gym.id,
            requestedByUserId: req.user?.id || null, // from authenticateToken middleware
            phoneNumberId,
            graphApiVersion: META_API_VERSION,
            oldName: gym.whatsappVerifiedName,
            newName: displayName,
            status: "PENDING_REVIEW",
            isActive: true,
            metaResponse: data,
          },
        }),
        prisma.gym.update({
          where: { id: gym.id },
          data: {
            pendingDisplayName: displayName,
            pendingNameStatus: "PENDING_REVIEW",
            lastNameChangeRequestAt: new Date(),
          },
        }),
      ]);

      res.json({
        success: true,
        message: "Display name change requested successfully.",
      });
    } catch (err) {
      console.error("❌ [Update Display Name] Error:", err);
      res.status(500).json({ error: "Failed to request display name change" });
    }
  },
);

/**
 * =====================================
 * GET DISPLAY NAME HISTORY
 * =====================================
 * Access: GYM_OWNER, SUPERADMIN
 */
router.get(
  "/display-name/history",
  authenticateToken,
  requireRoles(["GYM_OWNER", "SUPERADMIN"]),
  async (req, res) => {
    const { gymSlug } = req.params;

    try {
      const gym = await prisma.gym.findUnique({
        where: { slug: gymSlug.toLowerCase() },
      });

      if (!gym) {
        return res.status(404).json({ error: "Gym not found" });
      }

      const history = await prisma.whatsAppDisplayNameHistory.findMany({
        where: { gymId: gym.id },
        orderBy: { requestedAt: "desc" },
      });

      res.json(history);
    } catch (err) {
      console.error("❌ [Get Display Name History] Error:", err);
      res.status(500).json({ error: "Failed to fetch history" });
    }
  },
);

/**
 * =====================================
 * INITIATE WHATSAPP AUDIO CALL (WEBRTC)
 * =====================================
 * Access: STAFF, GYM_OWNER, SUPERADMIN
 */
router.post(
  "/call/initiate",
  authenticateToken,
  requireRoles(["STAFF", "GYM_OWNER", "SUPERADMIN"]),
  async (req, res) => {
    const { gymSlug } = req.params;
    const { to, sdp } = req.body;

    if (!to || !sdp) {
      return res.status(400).json({ error: "Missing 'to' or 'sdp' in request body" });
    }

    try {
      const gym = await prisma.gym.findUnique({
        where: { slug: gymSlug.toLowerCase() },
      });

      if (!gym || !gym.whatsapp_connected || !gym.whatsapp_access_token || !gym.whatsapp_phone_number_id) {
        return res.status(400).json({ error: "Gym WhatsApp not connected" });
      }

      const token = decrypt(gym.whatsapp_access_token);

      const payload = {
        messaging_product: "whatsapp",
        to,
        action: "connect",
        session: {
          sdp_type: "offer",
          sdp
        },
        biz_opaque_callback_data: gym.id // Send gym ID to route webhooks back
      };

      const resp = await fetch(
        `${GRAPH_BASE_URL}/${META_API_VERSION}/${gym.whatsapp_phone_number_id}/calls`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await resp.json();

      if (!resp.ok) {
        console.error("❌ [Call Initiate] Meta Error:", data);
        return res.status(400).json({ error: "Failed to initiate call", details: data });
      }

      const callId = data.calls?.[0]?.id;

      res.json({
        success: true,
        callId
      });
    } catch (err) {
      console.error("❌ [Call Initiate] Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * =====================================
 * TERMINATE WHATSAPP AUDIO CALL (WEBRTC)
 * =====================================
 * Access: STAFF, GYM_OWNER, SUPERADMIN
 */
router.post(
  "/call/terminate",
  authenticateToken,
  requireRoles(["STAFF", "GYM_OWNER", "SUPERADMIN"]),
  async (req, res) => {
    const { gymSlug } = req.params;
    const { callId } = req.body;

    if (!callId) {
      return res.status(400).json({ error: "Missing 'callId' in request body" });
    }

    try {
      const gym = await prisma.gym.findUnique({
        where: { slug: gymSlug.toLowerCase() },
      });

      if (!gym || !gym.whatsapp_connected || !gym.whatsapp_access_token || !gym.whatsapp_phone_number_id) {
        return res.status(400).json({ error: "Gym WhatsApp not connected" });
      }

      const token = decrypt(gym.whatsapp_access_token);

      const payload = {
        messaging_product: "whatsapp",
        call_id: callId,
        action: "terminate"
      };

      const resp = await fetch(
        `${GRAPH_BASE_URL}/${META_API_VERSION}/${gym.whatsapp_phone_number_id}/calls`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await resp.json();

      if (!resp.ok) {
        console.error("❌ [Call Terminate] Meta Error:", data);
        return res.status(400).json({ error: "Failed to terminate call", details: data });
      }

      res.json({ success: true });
    } catch (err) {
      console.error("❌ [Call Terminate] Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * =====================================
 * ACCEPT INBOUND WHATSAPP AUDIO CALL (WEBRTC)
 * =====================================
 * Access: STAFF, GYM_OWNER, SUPERADMIN
 */
router.post(
  "/call/accept",
  authenticateToken,
  requireRoles(["STAFF", "GYM_OWNER", "SUPERADMIN"]),
  async (req, res) => {
    const { gymSlug } = req.params;
    const { callId, sdp } = req.body;

    if (!callId || !sdp) {
      return res.status(400).json({ error: "Missing 'callId' or 'sdp' in request body" });
    }

    try {
      const gym = await prisma.gym.findUnique({
        where: { slug: gymSlug.toLowerCase() },
      });

      if (!gym || !gym.whatsapp_connected || !gym.whatsapp_access_token || !gym.whatsapp_phone_number_id) {
        return res.status(400).json({ error: "Gym WhatsApp not connected" });
      }

      const token = decrypt(gym.whatsapp_access_token);

      const payload = {
        messaging_product: "whatsapp",
        call_id: callId,
        action: "accept",
        session: {
          sdp_type: "answer",
          sdp
        }
      };

      const resp = await fetch(
        `${GRAPH_BASE_URL}/${META_API_VERSION}/${gym.whatsapp_phone_number_id}/calls`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await resp.json();

      if (!resp.ok) {
        console.error("❌ [Call Accept] Meta Error:", data);
        return res.status(400).json({ error: "Failed to accept call", details: data });
      }

      res.json({ success: true });
    } catch (err) {
      console.error("❌ [Call Accept] Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * =====================================
 * REQUEST WHATSAPP AUDIO CALL PERMISSION
 * =====================================
 * Access: STAFF, GYM_OWNER, SUPERADMIN
 */
router.post(
  "/call/request-permission",
  authenticateToken,
  requireRoles(["STAFF", "GYM_OWNER", "SUPERADMIN"]),
  async (req, res) => {
    const { gymSlug } = req.params;
    const { memberId } = req.body;

    if (!memberId) {
      return res.status(400).json({ error: "Missing 'memberId' in request body" });
    }

    try {
      const gym = await prisma.gym.findUnique({
        where: { slug: gymSlug.toLowerCase() },
      });

      if (!gym || !gym.whatsapp_connected || !gym.whatsapp_access_token || !gym.whatsapp_phone_number_id) {
        return res.status(400).json({ error: "Gym WhatsApp not connected" });
      }

      const member = await prisma.member.findUnique({
        where: { id: memberId },
      });

      if (!member || member.gymId !== gym.id) {
        return res.status(404).json({ error: "Member not found" });
      }

      const token = decrypt(gym.whatsapp_access_token);

      const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: member.phone,
        type: "interactive",
        interactive: {
          type: "call_permission_request",
          action: {
            name: "call_permission_request"
          }
        }
      };

      const resp = await fetch(
        `${GRAPH_BASE_URL}/${META_API_VERSION}/${gym.whatsapp_phone_number_id}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await resp.json();

      if (!resp.ok) {
        console.error("❌ [Call Request Permission] Meta Error:", data);
        return res.status(400).json({ error: "Failed to request call permission", details: data });
      }

      // Update Database Cache
      const updatedMember = await prisma.member.update({
        where: { id: memberId },
        data: {
          callPermissionStatus: "PENDING",
          callPermissionRequestedAt: new Date(),
          callPermissionUpdatedAt: new Date(),
          callPermissionRequestCount: { increment: 1 }
        }
      });

      // Log the outbound call permission request message in the database
      const requestMsgId = data.messages?.[0]?.id;
      if (requestMsgId) {
        try {
          const savedMessage = await prisma.whatsAppMessage.create({
            data: {
              gymId: gym.id,
              messageId: requestMsgId,
              senderPhone: gym.whatsappDisplayPhoneNumber || "",
              recipientPhone: member.phone,
              text: "📞 [Call Permission Request]",
              direction: "OUTBOUND",
              status: "SENT",
            }
          });

          const io = await import("../socket.js").then(m => m.getIO());
          io.to(`gym:${gym.id}`).emit("whatsapp:message", savedMessage);

          io.to(`conversation:${member.id}`).emit("message:new", {
            id: savedMessage.id,
            whatsappMessageId: savedMessage.messageId,
            content: savedMessage.text,
            text: savedMessage.text,
            direction: "outbound",
            status: "sent",
            createdAt: savedMessage.createdAt
          });
          io.to(`gym:${gym.id}`).emit("inbox:update");
        } catch (dbErr) {
          console.error("❌ Failed to log call permission request message to DB:", dbErr.message);
        }
      }

      // Broadcast to socket clients
      import("../socket.js").then(({ getIO }) => {
        try {
          const io = getIO();
          io.to(`gym:${gym.id}`).emit("member:updated", {
            memberId: updatedMember.id,
            callPermissionStatus: updatedMember.callPermissionStatus,
            callPermissionUpdatedAt: updatedMember.callPermissionUpdatedAt
          });
        } catch (e) {
          console.error("Failed to emit member:updated", e);
        }
      });

      res.json({ success: true, messageId: data.messages?.[0]?.id });
    } catch (err) {
      console.error("❌ [Call Request Permission] Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * =====================================
 * SIMULATE INBOUND WHATSAPP MESSAGE
 * =====================================
 */
router.post(
  "/simulate",
  async (req, res) => {
    const { gymSlug } = req.params;
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ error: "Phone and message are required" });
    }

    try {
      const gym = await prisma.gym.findUnique({
        where: { slug: gymSlug.toLowerCase() },
      });

      if (!gym) {
        return res.status(404).json({ error: "Gym not found" });
      }

      const member = await prisma.member.findFirst({
        where: {
          gymId: gym.id,
          phone: phone,
        },
      });

      if (!member) {
        return res.status(404).json({ error: "Member not found" });
      }

      const msgId = `sim-${Date.now()}`;

      // 1. Log inbound message in Notification table (for Simulator UI)
      await prisma.notification.create({
        data: {
          gymId: gym.id,
          memberId: member.id,
          recipientPhone: phone,
          title: "Inbound Simulator Message",
          message: message,
          type: "INBOUND",
          status: "SENT",
        },
      });

      // 2. Log inbound message in WhatsAppMessages table (for Inbox Live Chat UI)
      await prisma.whatsAppMessage.create({
        data: {
          gymId: gym.id,
          messageId: msgId,
          senderPhone: phone,
          recipientPhone: gym.whatsappDisplayPhoneNumber || "system",
          text: message,
          direction: "INBOUND",
          status: "RECEIVED",
        },
      });

      // Emit realtime websocket updates for inbound message
      try {
        const io = getIO();
        io.to(`conversation:${member.id}`).emit("message:new", {
          id: msgId,
          whatsappMessageId: msgId,
          content: message,
          direction: "inbound",
          status: "received",
          createdAt: new Date().toISOString(),
        });
        io.to(`gym:${gym.id}`).emit("inbox:update");
      } catch (wsErr) {}

      // 3. Trigger chatbot auto-responder if bot is active
      if (!member.isBotDisabled && !member.blockedAt) {
        console.log(`🤖 [Simulator] Chatbot resolving for member "${member.memberName}": "${message}"`);
        const botResponse = await handleChatbotMessage(gym, member, message);

        const replyId = `sim-reply-${Date.now()}`;

        // Save bot response to Notification table
        await prisma.notification.create({
          data: {
            gymId: gym.id,
            memberId: member.id,
            recipientPhone: phone,
            title: "Chatbot Simulator Reply",
            message: botResponse.text,
            type: "CHATBOT",
            status: "SENT",
          },
        });

        // Save bot response to WhatsAppMessages table
        await prisma.whatsAppMessage.create({
          data: {
            gymId: gym.id,
            messageId: replyId,
            senderPhone: gym.whatsappDisplayPhoneNumber || "system",
            recipientPhone: phone,
            text: botResponse.text,
            direction: "OUTBOUND",
            status: "SENT",
          },
        });

        // Emit realtime websocket updates for chatbot reply
        try {
          const io = getIO();
          io.to(`conversation:${member.id}`).emit("message:new", {
            id: replyId,
            whatsappMessageId: replyId,
            content: botResponse.text,
            direction: "outbound",
            status: "sent",
            createdAt: new Date().toISOString(),
          });
          io.to(`gym:${gym.id}`).emit("inbox:update");
        } catch (wsErr) {}
      }

      res.json({ success: true });
    } catch (err) {
      console.error("❌ [Simulator POST] Error:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

export default router;
