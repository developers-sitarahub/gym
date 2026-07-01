import { Router } from "express";
import prisma from "../prisma.js";
import { decrypt } from "../utils/encryption.js";
import { getIO } from "../socket.js";
import { authenticateToken } from "../middleware/auth.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = "uploads/media";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

const parseMessageText = (rawText) => {
  if (rawText && rawText.startsWith("{")) {
    try {
      const parsed = JSON.parse(rawText);
      if (parsed.mediaUrl) {
        return {
          content: parsed.caption || `[media]`,
          mediaUrl: parsed.mediaUrl,
          mimeType: parsed.mimeType,
          caption: parsed.caption
        };
      }
    } catch (e) {
      // Not JSON or parse failed
    }
  }
  return { content: rawText };
};


const router = Router({ mergeParams: true });

/**
 * =====================================
 * GET ALL CONVERSATIONS (INBOX LIST)
 * =====================================
 */
router.get("/", async (req, res) => {
  const { gymSlug } = req.params;

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
      select: { id: true }
    });

    if (!gym) {
      return res.status(404).json({ error: "Gym not found" });
    }

    // Auto-reset stuck PENDING call permissions (older than 5 minutes)
    await prisma.member.updateMany({
      where: {
        gymId: gym.id,
        callPermissionStatus: "PENDING",
        callPermissionRequestedAt: {
          lt: new Date(Date.now() - 5 * 60 * 1000)
        }
      },
      data: {
        callPermissionStatus: "UNKNOWN",
        callPermissionUpdatedAt: new Date(),
      }
    });

    const members = await prisma.member.findMany({
      where: { gymId: gym.id }
    });

    const conversations = await Promise.all(
      members.map(async (member) => {
        // Fetch the latest message
        const lastMessage = await prisma.whatsAppMessage.findFirst({
          where: {
            gymId: gym.id,
            OR: [
              { senderPhone: member.phone },
              { recipientPhone: member.phone }
            ]
          },
          orderBy: { createdAt: "desc" }
        });

        // Count unread inbound messages
        const unreadCount = await prisma.whatsAppMessage.count({
          where: {
            gymId: gym.id,
            direction: "INBOUND",
            senderPhone: member.phone,
            status: { not: "READ" }
          }
        });

        // Check for active membership
        const activeMembership = await prisma.membership.findFirst({
          where: {
            memberId: member.id,
            status: "ACTIVE",
            endDate: { gte: new Date() }
          },
          include: {
            plan: true
          }
        });

        const parsedText = lastMessage ? parseMessageText(lastMessage.text) : null;

        // Compute WhatsApp 24-hour session window details
        const lastInbound = await prisma.whatsAppMessage.findFirst({
          where: {
            gymId: gym.id,
            direction: "INBOUND",
            senderPhone: member.phone
          },
          orderBy: { createdAt: "desc" }
        });

        const now = new Date();
        const sessionStarted = !!lastInbound;
        const sessionExpiresAt = lastInbound
          ? new Date(new Date(lastInbound.createdAt).getTime() + 24 * 60 * 60 * 1000)
          : null;
        const sessionActive = sessionExpiresAt ? sessionExpiresAt > now : false;

        return {
          id: member.id,
          name: member.memberName,
          whatsappName: member.whatsappName,
          phone: member.phone,
          isBotDisabled: member.isBotDisabled,
          notes: member.notes,
          isBlocked: !!member.blockedAt,
          isMember: !!activeMembership,
          planName: activeMembership ? activeMembership.plan.name : null,
          lastMessage: lastMessage
            ? {
              id: lastMessage.id,
              content: parsedText.mediaUrl ? (parsedText.mimeType?.startsWith("image/") ? "📷 Photo" : parsedText.mimeType?.startsWith("video/") ? "🎥 Video" : "📄 Document") : parsedText.content,
              direction: lastMessage.direction.toLowerCase(),
              status: lastMessage.status.toLowerCase(),
              createdAt: lastMessage.createdAt
            }
            : null,
          lastMessageAt: lastMessage ? lastMessage.createdAt : member.updatedAt,
          unreadCount,
          sessionStarted,
          sessionActive,
          sessionExpiresAt,
          callPermissionStatus: member.callPermissionStatus
        };
      })
    );

    // Sort by last message date descending
    conversations.sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );

    res.json(conversations);
  } catch (err) {
    console.error("❌ [Inbox GET All] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * =====================================
 * GET FULL CONVERSATION (THREAD)
 * =====================================
 */
router.get("/:memberId", async (req, res) => {
  const { gymSlug, memberId } = req.params;

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
      select: { id: true }
    });

    if (!gym) {
      return res.status(404).json({ error: "Gym not found" });
    }

    // Auto-reset stuck PENDING call permissions (older than 5 minutes)
    await prisma.member.updateMany({
      where: {
        gymId: gym.id,
        callPermissionStatus: "PENDING",
        callPermissionRequestedAt: {
          lt: new Date(Date.now() - 5 * 60 * 1000)
        }
      },
      data: {
        callPermissionStatus: "UNKNOWN",
        callPermissionUpdatedAt: new Date(),
      }
    });

    const member = await prisma.member.findUnique({
      where: { id: memberId }
    });

    if (!member || member.gymId !== gym.id) {
      return res.status(404).json({ error: "Member not found" });
    }

    const activeMembership = await prisma.membership.findFirst({
      where: {
        memberId: member.id,
        status: "ACTIVE",
        endDate: { gte: new Date() }
      },
      include: {
        plan: true
      }
    });

    const messages = await prisma.whatsAppMessage.findMany({
      where: {
        gymId: gym.id,
        OR: [
          { senderPhone: member.phone },
          { recipientPhone: member.phone }
        ]
      },
      orderBy: { createdAt: "asc" }
    });

    const mappedMessages = messages.map((m) => {
      const parsed = parseMessageText(m.text);
      return {
        id: m.id,
        whatsappMessageId: m.messageId,
        content: parsed.content,
        text: parsed.content,
        mediaUrl: parsed.mediaUrl,
        mimeType: parsed.mimeType,
        caption: parsed.caption,
        direction: m.direction.toLowerCase(),
        status: m.status.toLowerCase(),
        createdAt: m.createdAt
      };
    });

    // Compute WhatsApp 24-hour session window details
    const lastInbound = await prisma.whatsAppMessage.findFirst({
      where: {
        gymId: gym.id,
        direction: "INBOUND",
        senderPhone: member.phone
      },
      orderBy: { createdAt: "desc" }
    });

    const now = new Date();
    const sessionStarted = !!lastInbound;
    const sessionExpiresAt = lastInbound
      ? new Date(new Date(lastInbound.createdAt).getTime() + 24 * 60 * 60 * 1000)
      : null;
    const sessionActive = sessionExpiresAt ? sessionExpiresAt > now : false;

    res.json({
      conversationId: member.id,
      member: {
        id: member.id,
        name: member.memberName,
        whatsappName: member.whatsappName,
        phone: member.phone,
        isBotDisabled: member.isBotDisabled,
        notes: member.notes,
        blockedAt: member.blockedAt,
        isMember: !!activeMembership,
        planName: activeMembership ? activeMembership.plan.name : null,
        callPermissionStatus: member.callPermissionStatus
      },
      sessionStarted,
      sessionActive,
      sessionExpiresAt,
      messages: mappedMessages
    });
  } catch (err) {
    console.error(`❌ [Inbox GET Thread] Error for member ${memberId}:`, err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * =====================================
 * MARK CONVERSATION AS READ
 * =====================================
 */
router.post("/:memberId/mark-read", async (req, res) => {
  const { gymSlug, memberId } = req.params;

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() }
    });

    if (!gym) {
      return res.status(404).json({ error: "Gym not found" });
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId }
    });

    if (!member || member.gymId !== gym.id) {
      return res.status(404).json({ error: "Member not found" });
    }

    // Update in DB
    await prisma.whatsAppMessage.updateMany({
      where: {
        gymId: gym.id,
        senderPhone: member.phone,
        direction: "INBOUND",
        status: { not: "READ" }
      },
      data: {
        status: "READ"
      }
    });

    // Send Meta read receipt if we have tokens and a last inbound messageId
    const lastInbound = await prisma.whatsAppMessage.findFirst({
      where: {
        gymId: gym.id,
        senderPhone: member.phone,
        direction: "INBOUND"
      },
      orderBy: { createdAt: "desc" }
    });

    if (
      lastInbound &&
      lastInbound.messageId &&
      gym.whatsapp_access_token &&
      gym.whatsapp_phone_number_id
    ) {
      try {
        const accessToken = decrypt(gym.whatsapp_access_token);
        const payload = {
          messaging_product: "whatsapp",
          status: "read",
          message_id: lastInbound.messageId
        };

        const GRAPH_BASE_URL = process.env.META_GRAPH_BASE_URL || "https://graph.facebook.com";
        const META_API_VERSION = process.env.META_API_VERSION || "v20.0";

        await fetch(
          `${GRAPH_BASE_URL}/${META_API_VERSION}/${gym.whatsapp_phone_number_id}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
          }
        );
      } catch (err) {
        console.error("⚠️ Failed to send Meta read receipt:", err.message);
      }
    }

    // Emit socket updates to refresh conversation lists
    try {
      const io = getIO();
      io.to(`gym:${gym.id}`).emit("inbox:update");
    } catch (err) {
      console.error("⚠️ Socket emit failed on mark-read:", err);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("❌ [Inbox mark-read] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * =====================================
 * SEND MESSAGE TO MEMBER
 * =====================================
 */
router.post("/:memberId/send", async (req, res) => {
  const { gymSlug, memberId } = req.params;
  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: "Message content is required" });
  }

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() }
    });

    if (!gym) {
      return res.status(404).json({ error: "Gym not found" });
    }

    if (!gym.whatsapp_access_token || !gym.whatsapp_phone_number_id) {
      return res.status(400).json({ error: "WhatsApp integration is not connected/configured." });
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId }
    });

    if (!member || member.gymId !== gym.id) {
      return res.status(404).json({ error: "Member not found" });
    }

    if (member.blockedAt) {
      return res.status(400).json({ error: "This contact is blocked. Unblock them first to send messages." });
    }

    let messageId = `temp-${Date.now()}`;
    let status = "SENT";

    try {
      const accessToken = decrypt(gym.whatsapp_access_token);
      const GRAPH_BASE_URL = process.env.META_GRAPH_BASE_URL || "https://graph.facebook.com";
      const META_API_VERSION = process.env.META_API_VERSION || "v20.0";

      const response = await fetch(
        `${GRAPH_BASE_URL}/${META_API_VERSION}/${gym.whatsapp_phone_number_id}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: member.phone,
            type: "text",
            text: {
              preview_url: false,
              body: text
            }
          })
        }
      );

      const data = await response.json();
      if (response.ok && data.messages?.[0]?.id) {
        messageId = data.messages[0].id;
      } else {
        console.error("Meta API error details:", data);
        throw new Error(data.error?.message || "Failed to send message via Meta API");
      }
    } catch (err) {
      console.error("Error sending WhatsApp message via Meta:", err);
      status = "FAILED";
      return res.status(500).json({ error: err.message || "Failed to dispatch message to Meta" });
    }

    // Save message to DB
    const savedMessage = await prisma.whatsAppMessage.create({
      data: {
        gymId: gym.id,
        messageId,
        senderPhone: gym.whatsappDisplayPhoneNumber || "system",
        recipientPhone: member.phone,
        text,
        direction: "OUTBOUND",
        status
      }
    });

    const mappedMsg = {
      id: savedMessage.id,
      whatsappMessageId: savedMessage.messageId,
      content: savedMessage.text,
      direction: "outbound",
      status: status.toLowerCase(),
      createdAt: savedMessage.createdAt
    };

    // Emit socket updates
    try {
      const io = getIO();
      io.to(`conversation:${member.id}`).emit("message:new", mappedMsg);
      io.to(`gym:${gym.id}`).emit("inbox:update");
    } catch (err) {
      console.error("⚠️ Socket emit failed on send message:", err);
    }

    res.json({ success: true, message: mappedMsg });
  } catch (err) {
    console.error("❌ [Inbox Send] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * =====================================
 * TOGGLE BOT MODE FOR MEMBER (TAKEOVER)
 * =====================================
 */
router.post("/:memberId/toggle-bot", async (req, res) => {
  const { gymSlug, memberId } = req.params;
  const { isBotDisabled } = req.body;

  if (typeof isBotDisabled !== "boolean") {
    return res.status(400).json({ error: "isBotDisabled must be a boolean" });
  }

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
      select: { id: true }
    });

    if (!gym) {
      return res.status(404).json({ error: "Gym not found" });
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId }
    });

    if (!member || member.gymId !== gym.id) {
      return res.status(404).json({ error: "Member not found" });
    }

    // Update member
    const updatedMember = await prisma.member.update({
      where: { id: memberId },
      data: { isBotDisabled }
    });

    // Log to AuditLog
    await prisma.auditLog.create({
      data: {
        action: isBotDisabled ? "BOT_TAKEOVER_START" : "BOT_TAKEOVER_STOP",
        details: isBotDisabled
          ? `Human took over conversation with member ${member.memberName} (${member.phone}). Bot paused.`
          : `Chatbot resumed control for member ${member.memberName} (${member.phone}).`,
        gymId: gym.id,
        userId: req.user?.userId || null
      }
    });

    // Emit socket updates
    try {
      const io = getIO();
      io.to(`conversation:${member.id}`).emit("conversation:blocked_status", {
        isBlocked: isBotDisabled
      });
      io.to(`conversation:${member.id}`).emit("bot:toggled", {
        memberId,
        isBotDisabled
      });
      io.to(`gym:${gym.id}`).emit("inbox:update");
    } catch (err) {
      console.error("⚠️ Socket emit failed on toggle bot:", err);
    }

    res.json({ success: true, isBotDisabled: updatedMember.isBotDisabled });
  } catch (err) {
    console.error("❌ [Inbox toggle-bot] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * =====================================
 * DELETE A MESSAGE
 * =====================================
 */
router.delete("/messages/:messageId", async (req, res) => {
  const { gymSlug, messageId } = req.params;

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
      select: { id: true }
    });

    if (!gym) {
      return res.status(404).json({ error: "Gym not found" });
    }

    const message = await prisma.whatsAppMessage.findUnique({
      where: { id: messageId }
    });

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (message.gymId !== gym.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await prisma.whatsAppMessage.delete({
      where: { id: messageId }
    });

    // Emit socket updates
    try {
      const io = getIO();
      const member = await prisma.member.findFirst({
        where: {
          gymId: gym.id,
          phone: message.direction === "INBOUND" ? message.senderPhone : message.recipientPhone
        }
      });

      if (member) {
        io.to(`conversation:${member.id}`).emit("message:deleted", { messageId });
      }
      io.to(`gym:${gym.id}`).emit("inbox:update");
    } catch (err) {
      console.error("⚠️ Socket emit failed on delete message:", err);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("❌ [Inbox Delete message] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


/**
 * =====================================
 * CHECK IF NUMBER IS ON WHATSAPP
 * =====================================
 */
router.post("/check-number", async (req, res) => {
  const { gymSlug } = req.params;
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ error: "Phone number is required" });
  }

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
      select: { id: true }
    });

    if (!gym) {
      return res.status(404).json({ error: "Gym not found" });
    }

    const formattedNumber = phoneNumber.replace(/\D/g, "");

    const existingMember = await prisma.member.findUnique({
      where: {
        gymId_phone: {
          gymId: gym.id,
          phone: formattedNumber
        }
      }
    });

    if (existingMember) {
      return res.json({
        isOnWhatsApp: true,
        phoneNumber: formattedNumber,
        conversationExists: true,
        conversationId: existingMember.id,
        lead: {
          id: existingMember.id,
          phoneNumber: existingMember.phone,
          memberName: existingMember.memberName
        }
      });
    }

    return res.json({
      isOnWhatsApp: true,
      phoneNumber: formattedNumber,
      conversationExists: false
    });
  } catch (err) {
    console.error("❌ [Inbox check-number] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * =====================================
 * CREATE NEW CONVERSATION
 * =====================================
 */
router.post("/create-conversation", async (req, res) => {
  const { gymSlug } = req.params;
  const { phoneNumber, memberName } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ error: "Phone number is required" });
  }

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
      select: { id: true }
    });

    if (!gym) {
      return res.status(404).json({ error: "Gym not found" });
    }

    const formattedNumber = phoneNumber.replace(/\D/g, "");

    let member = await prisma.member.findUnique({
      where: {
        gymId_phone: {
          gymId: gym.id,
          phone: formattedNumber
        }
      }
    });

    if (!member) {
      member = await prisma.member.create({
        data: {
          gymId: gym.id,
          phone: formattedNumber,
          memberName: memberName || formattedNumber
        }
      });

      await prisma.auditLog.create({
        data: {
          action: "MEMBER_CREATE",
          details: `Member ${member.memberName} (${formattedNumber}) created via start conversation in inbox.`,
          gymId: gym.id,
          userId: req.user?.userId || null
        }
      });

      // Emit list update
      try {
        const io = getIO();
        io.to(`gym:${gym.id}`).emit("inbox:update");
      } catch (wsErr) {
        console.error("⚠️ Socket emit failed on create-conversation:", wsErr.message);
      }
    }

    return res.json({
      conversationId: member.id,
      lead: {
        id: member.id,
        phoneNumber: member.phone,
        memberName: member.memberName
      }
    });
  } catch (err) {
    console.error("❌ [Inbox create-conversation] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * =====================================
 * GET BLOCKED WHATSAPP USERS
 * =====================================
 */
router.get("/blocked", async (req, res) => {
  const { gymSlug } = req.params;

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
      select: { whatsapp_access_token: true, whatsapp_phone_number_id: true }
    });

    if (!gym || !gym.whatsapp_access_token || !gym.whatsapp_phone_number_id) {
      return res.status(400).json({ error: "WhatsApp integration is not connected/configured." });
    }

    const accessToken = decrypt(gym.whatsapp_access_token);
    const phoneId = gym.whatsapp_phone_number_id;

    const limit = req.query.limit || 100;
    const after = req.query.after || "";
    const version = process.env.META_API_VERSION || "v20.0";
    const base = process.env.META_GRAPH_BASE_URL || "https://graph.facebook.com";

    let url = `${base}/${version}/${phoneId}/block_users?limit=${limit}`;
    if (after) {
      url += `&after=${after}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const resData = await response.json();

    if (!response.ok) {
      console.error("Meta Get Blocked Users API failed:", resData);
      return res.status(response.status).json({
        error: "Failed to retrieve blocked users list from WhatsApp",
        metaError: resData,
      });
    }

    res.json(resData);
  } catch (err) {
    console.error("❌ [Inbox GET Blocked] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * =====================================
 * BLOCK A MEMBER
 * =====================================
 */
router.post("/:memberId/block", async (req, res) => {
  const { gymSlug, memberId } = req.params;

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() }
    });

    if (!gym || !gym.whatsapp_access_token || !gym.whatsapp_phone_number_id) {
      return res.status(400).json({ error: "WhatsApp integration is not connected/configured." });
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId }
    });

    if (!member || member.gymId !== gym.id) {
      return res.status(404).json({ error: "Member not found" });
    }

    const userPhoneNumber = member.phone;
    const accessToken = decrypt(gym.whatsapp_access_token);
    const phoneId = gym.whatsapp_phone_number_id;
    const version = process.env.META_API_VERSION || "v20.0";
    const base = process.env.META_GRAPH_BASE_URL || "https://graph.facebook.com";

    // Call Meta API to block user
    const url = `${base}/${version}/${phoneId}/block_users`;
    const payload = {
      messaging_product: "whatsapp",
      block_users: [
        {
          user: userPhoneNumber,
        },
      ],
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const resData = await response.json();

    if (!response.ok) {
      console.error("Meta Block Users API failed:", resData);
      return res.status(response.status).json({
        error: "Failed to block user on WhatsApp",
        metaError: resData,
      });
    }

    const failed = resData.block_users?.failed_users || [];
    if (failed.length > 0) {
      return res.status(400).json({
        error: failed[0].errors?.[0]?.message || "Failed to block user",
      });
    }

    // Update member blocked status in DB
    const updatedMember = await prisma.member.update({
      where: { id: memberId },
      data: { blockedAt: new Date() }
    });

    // Send real-time socket events
    try {
      const io = getIO();
      io.to(`conversation:${memberId}`).emit("conversation:blocked_status", {
        conversationId: memberId,
        isBlocked: true,
        blockedAt: updatedMember.blockedAt,
      });
      io.to(`gym:${gym.id}`).emit("inbox:update");
    } catch (wsErr) {
      console.error("Socket emit failed on block:", wsErr);
    }

    res.json({ success: true, message: "User blocked successfully", data: resData });
  } catch (err) {
    console.error("❌ [Inbox block] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * =====================================
 * UNBLOCK A MEMBER
 * =====================================
 */
router.post("/:memberId/unblock", async (req, res) => {
  const { gymSlug, memberId } = req.params;

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() }
    });

    if (!gym || !gym.whatsapp_access_token || !gym.whatsapp_phone_number_id) {
      return res.status(400).json({ error: "WhatsApp integration is not connected/configured." });
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId }
    });

    if (!member || member.gymId !== gym.id) {
      return res.status(404).json({ error: "Member not found" });
    }

    const userPhoneNumber = member.phone;
    const accessToken = decrypt(gym.whatsapp_access_token);
    const phoneId = gym.whatsapp_phone_number_id;
    const version = process.env.META_API_VERSION || "v20.0";
    const base = process.env.META_GRAPH_BASE_URL || "https://graph.facebook.com";

    // Call Meta API to unblock user
    const url = `${base}/${version}/${phoneId}/block_users`;
    const payload = {
      messaging_product: "whatsapp",
      block_users: [
        {
          user: userPhoneNumber,
        },
      ],
    };

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const resData = await response.json();

    if (!response.ok) {
      console.error("Meta Unblock Users API failed:", resData);
      return res.status(response.status).json({
        error: "Failed to unblock user on WhatsApp",
        metaError: resData,
      });
    }

    const failed = resData.block_users?.failed_users || [];
    if (failed.length > 0) {
      return res.status(400).json({
        error: failed[0].errors?.[0]?.message || "Failed to unblock user",
      });
    }

    // Update member blocked status in DB (blockedAt = null)
    await prisma.member.update({
      where: { id: memberId },
      data: { blockedAt: null }
    });

    // Send real-time socket events
    try {
      const io = getIO();
      io.to(`conversation:${memberId}`).emit("conversation:blocked_status", {
        conversationId: memberId,
        isBlocked: false,
        blockedAt: null,
      });
      io.to(`gym:${gym.id}`).emit("inbox:update");
    } catch (wsErr) {
      console.error("Socket emit failed on unblock:", wsErr);
    }

    res.json({ success: true, message: "User unblocked successfully", data: resData });
  } catch (err) {
    console.error("❌ [Inbox unblock] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * =====================================
 * SEND TEMPLATE TO MEMBER
 * =====================================
 */
router.post("/:memberId/send-template", async (req, res) => {
  const { gymSlug, memberId } = req.params;
  const { templateId, bodyVariables = [] } = req.body;

  if (!templateId) {
    return res.status(400).json({ error: "Template ID is required" });
  }

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() }
    });

    if (!gym || !gym.whatsapp_access_token || !gym.whatsapp_phone_number_id) {
      return res.status(400).json({ error: "WhatsApp integration is not connected/configured." });
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId }
    });

    if (!member || member.gymId !== gym.id) {
      return res.status(404).json({ error: "Member not found" });
    }

    if (member.blockedAt) {
      return res.status(400).json({ error: "This contact is blocked. Unblock them first to send messages." });
    }

    const template = await prisma.whatsAppTemplate.findUnique({
      where: { id: templateId }
    });

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    const accessToken = decrypt(gym.whatsapp_access_token);
    const GRAPH_BASE_URL = process.env.META_GRAPH_BASE_URL || "https://graph.facebook.com";
    const META_API_VERSION = process.env.META_API_VERSION || "v20.0";

    const components = [];

    // 🔹 Build Header parameters if template has media header
    const componentsRaw = Array.isArray(template.components) ? template.components : [];
    const headerComp = componentsRaw.find((c) => c.type === "HEADER");

    if (headerComp && ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerComp.format)) {
      const fileInfo = headerComp.example;
      if (fileInfo && fileInfo.local_filename) {
        const templatesUploadDir = "uploads/templates";
        const filePath = path.join(templatesUploadDir, fileInfo.local_filename);
        if (fs.existsSync(filePath)) {
          console.log(`🔌 [Send Template] Uploading header media "${fileInfo.local_filename}" to Meta...`);
          const fileBuffer = fs.readFileSync(filePath);
          const blob = new Blob([fileBuffer], { type: fileInfo.local_mimetype || "image/jpeg" });

          const waForm = new FormData();
          waForm.append("messaging_product", "whatsapp");
          waForm.append("file", blob, fileInfo.local_originalname || "header-file");

          const uploadRes = await fetch(
            `${GRAPH_BASE_URL}/${META_API_VERSION}/${gym.whatsapp_phone_number_id}/media`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`
              },
              body: waForm
            }
          );

          if (!uploadRes.ok) {
            const errData = await uploadRes.json();
            console.error("❌ Failed to upload template header media to Meta:", errData);
            return res.status(400).json({
              error: errData?.error?.message || "Failed to upload template header media to Meta"
            });
          }

          const uploadData = await uploadRes.json();
          const mediaId = uploadData.id;

          if (mediaId) {
            const formatLower = headerComp.format.toLowerCase();
            components.push({
              type: "header",
              parameters: [
                {
                  type: formatLower,
                  [formatLower]: {
                    id: mediaId
                  }
                }
              ]
            });
            console.log(`✅ [Send Template] Header media uploaded. ID: ${mediaId}`);
          }
        }
      } else if (fileInfo && Array.isArray(fileInfo.header_handle) && fileInfo.header_handle.length > 0) {
        const handleUrl = fileInfo.header_handle[0];
        console.log(`🔌 [Send Template] Fetching header media from Meta CDN: ${handleUrl}`);
        try {
          const fetchRes = await fetch(handleUrl);
          if (fetchRes.ok) {
            const fileBuffer = Buffer.from(await fetchRes.arrayBuffer());
            const mimeType = fetchRes.headers.get("content-type") || "image/jpeg";
            const blob = new Blob([fileBuffer], { type: mimeType });

            const waForm = new FormData();
            waForm.append("messaging_product", "whatsapp");
            waForm.append("file", blob, "header-file");

            const uploadRes = await fetch(
              `${GRAPH_BASE_URL}/${META_API_VERSION}/${gym.whatsapp_phone_number_id}/media`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`
                },
                body: waForm
              }
            );

            if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              const mediaId = uploadData.id;
              if (mediaId) {
                const formatLower = headerComp.format.toLowerCase();
                components.push({
                  type: "header",
                  parameters: [
                    {
                      type: formatLower,
                      [formatLower]: {
                        id: mediaId
                      }
                    }
                  ]
                });
                console.log(`✅ [Send Template] Synced header media uploaded to Meta. ID: ${mediaId}`);
              }
            } else {
              const errData = await uploadRes.json();
              console.error("❌ Failed to upload template header media to Meta from CDN handle:", errData);
            }
          } else {
            console.error(`❌ Failed to fetch header media from CDN handle, status: ${fetchRes.status}`);
          }
        } catch (fetchErr) {
          console.error("❌ Error fetching/uploading header media from CDN handle:", fetchErr);
        }
      }
    }

    // 🔹 Build Body parameters
    if (bodyVariables && bodyVariables.length > 0) {
      components.push({
        type: "body",
        parameters: bodyVariables.map((v) => ({
          type: "text",
          text: String(v)
        }))
      });
    }

    // 🔹 Send template to Meta API
    const response = await fetch(
      `${GRAPH_BASE_URL}/${META_API_VERSION}/${gym.whatsapp_phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: member.phone,
          type: "template",
          template: {
            name: template.templateName,
            language: { code: template.language },
            ...(components.length > 0 && { components })
          }
        })
      }
    );

    const resData = await response.json();
    if (!response.ok) {
      console.error("Meta send template failed:", resData);
      return res.status(400).json({
        error: resData?.error?.message || "Failed to send template message via Meta API"
      });
    }

    const messageId = resData.messages?.[0]?.id || `temp-${Date.now()}`;

    // Reconstruct message body text for database/inbox log
    const bodyComp = componentsRaw.find((c) => c.type === "BODY");
    let content = bodyComp ? bodyComp.text : "";
    if (bodyVariables && bodyVariables.length > 0) {
      bodyVariables.forEach((v, i) => {
        content = content.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, "g"), String(v));
      });
    }

    // Save message to DB
    const savedMessage = await prisma.whatsAppMessage.create({
      data: {
        gymId: gym.id,
        messageId,
        senderPhone: gym.whatsappDisplayPhoneNumber || "system",
        recipientPhone: member.phone,
        text: content,
        direction: "OUTBOUND",
        status: "SENT"
      }
    });

    const mappedMsg = {
      id: savedMessage.id,
      whatsappMessageId: savedMessage.messageId,
      content: savedMessage.text,
      direction: "outbound",
      status: "sent",
      createdAt: savedMessage.createdAt
    };

    // Emit socket updates
    try {
      const io = getIO();
      io.to(`conversation:${member.id}`).emit("message:new", mappedMsg);
      io.to(`gym:${gym.id}`).emit("inbox:update");
    } catch (err) {
      console.error("⚠️ Socket emit failed on send template message:", err);
    }

    res.json({ success: true, message: mappedMsg });
  } catch (err) {
    console.error("❌ [Inbox Send Template] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * =====================================
 * SEND MEDIA TO MEMBER
 * =====================================
 */
router.post("/:memberId/send-media", upload.single("file"), async (req, res) => {
  const { gymSlug, memberId } = req.params;
  const { caption } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "File is required" });
  }

  // Security check: Block executable/script files that could harm the platform or recipient
  const harmfulExtensions = [
    ".exe", ".msi", ".bat", ".cmd", ".sh", ".vbs", ".js", ".scr", ".pif", ".cpl",
    ".wsf", ".jar", ".com", ".gadget", ".vb", ".vbe", ".jse", ".lnk", ".reg"
  ];
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (harmfulExtensions.includes(ext)) {
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    return res.status(400).json({ error: "File type not allowed for security reasons." });
  }

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() }
    });

    if (!gym || !gym.whatsapp_access_token || !gym.whatsapp_phone_number_id) {
      return res.status(400).json({ error: "WhatsApp integration is not connected/configured." });
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId }
    });

    if (!member || member.gymId !== gym.id) {
      return res.status(404).json({ error: "Member not found" });
    }

    if (member.blockedAt) {
      return res.status(400).json({ error: "This contact is blocked. Unblock them first to send messages." });
    }

    const accessToken = decrypt(gym.whatsapp_access_token);
    const phoneId = gym.whatsapp_phone_number_id;
    const GRAPH_BASE_URL = process.env.META_GRAPH_BASE_URL || "https://graph.facebook.com";
    const META_API_VERSION = process.env.META_API_VERSION || "v20.0";

    // 1️⃣ Upload media file to Meta Graph API
    const fileBuffer = fs.readFileSync(file.path);
    const blob = new Blob([fileBuffer], { type: file.mimetype });

    const waForm = new FormData();
    waForm.append("messaging_product", "whatsapp");
    waForm.append("file", blob, file.originalname);

    const uploadRes = await fetch(
      `${GRAPH_BASE_URL}/${META_API_VERSION}/${phoneId}/media`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        body: waForm
      }
    );

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok || !uploadData.id) {
      console.error("Meta media upload failed:", uploadData);
      return res.status(400).json({
        error: uploadData?.error?.message || "Failed to upload media to WhatsApp"
      });
    }

    const mediaId = uploadData.id;

    // 2️⃣ Send media message to recipient
    const mediaType = file.mimetype.startsWith("image/")
      ? "image"
      : file.mimetype.startsWith("video/")
        ? "video"
        : file.mimetype.startsWith("audio/")
          ? "audio"
          : "document";

    const sendPayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: member.phone,
      type: mediaType,
      [mediaType]: {
        id: mediaId,
        ...(caption && { caption }),
        ...(mediaType === "document" && { filename: file.originalname })
      }
    };

    const sendRes = await fetch(
      `${GRAPH_BASE_URL}/${META_API_VERSION}/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(sendPayload)
      }
    );

    const sendData = await sendRes.json();
    if (!sendRes.ok || !sendData.messages?.[0]?.id) {
      console.error("Meta media message send failed:", sendData);
      return res.status(400).json({
        error: sendData?.error?.message || "Failed to dispatch media message via Meta API"
      });
    }

    const messageId = sendData.messages[0].id;

    // 3️⃣ Save outbound media details to database
    const backendUrl = process.env.BACKEND_URL || "http://localhost:5000";
    const mediaUrl = `${backendUrl}/uploads/media/${file.filename}`;

    const textPayload = JSON.stringify({
      mediaUrl,
      mimeType: file.mimetype,
      caption: caption || ""
    });

    const savedMessage = await prisma.whatsAppMessage.create({
      data: {
        gymId: gym.id,
        messageId,
        senderPhone: gym.whatsappDisplayPhoneNumber || "system",
        recipientPhone: member.phone,
        text: textPayload,
        direction: "OUTBOUND",
        status: "SENT"
      }
    });

    const mappedMsg = {
      id: savedMessage.id,
      whatsappMessageId: savedMessage.messageId,
      content: caption || `[${mediaType}]`,
      text: caption || `[${mediaType}]`,
      mediaUrl,
      mimeType: file.mimetype,
      caption,
      direction: "outbound",
      status: "sent",
      createdAt: savedMessage.createdAt
    };

    // Emit socket updates
    try {
      const io = getIO();
      io.to(`conversation:${member.id}`).emit("message:new", mappedMsg);
      io.to(`gym:${gym.id}`).emit("inbox:update");
    } catch (err) {
      console.error("⚠️ Socket emit failed on send media message:", err);
    }

    res.json({ success: true, message: mappedMsg });
  } catch (err) {
    console.error("❌ [Inbox Send Media] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
