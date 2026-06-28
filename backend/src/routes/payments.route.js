import { Router } from "express";
import prisma from "../prisma.js";
import { decrypt } from "../utils/encryption.js";
import { getIO } from "../socket.js";
import { processCompletedPayment } from "../utils/chatbotHelper.js";

const router = Router({ mergeParams: true });

/**
 * Helper to dispatch live WhatsApp message via Meta API
 */
async function sendWhatsAppMessage(gym, recipientPhone, messageText) {
  if (
    !gym ||
    !gym.whatsapp_connected ||
    !gym.whatsapp_access_token ||
    !gym.whatsapp_phone_number_id
  ) {
    console.log(
      `ℹ️ [WhatsApp Alert] Skipping live message dispatch. WhatsApp not connected for gym: "${gym?.name}"`
    );
    return;
  }

  try {
    const accessToken = decrypt(gym.whatsapp_access_token);
    const phoneId = gym.whatsapp_phone_number_id;
    const version = process.env.META_API_VERSION || "v25.0";
    const base = process.env.META_GRAPH_BASE_URL || "https://graph.facebook.com";

    const response = await fetch(`${base}/${version}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipientPhone,
        type: "text",
        text: { body: messageText },
      }),
    });

    const resData = await response.json();

    if (!response.ok) {
      console.error("❌ Failed to send WhatsApp message via Meta:", resData);
      return;
    }

    const msgId = resData.messages?.[0]?.id || `out-${Date.now()}`;

    // Save outbound message to DB
    await prisma.whatsAppMessage.create({
      data: {
        gymId: gym.id,
        messageId: msgId,
        senderPhone: gym.whatsappDisplayPhoneNumber || "system",
        recipientPhone: recipientPhone,
        text: messageText,
        direction: "OUTBOUND",
        status: "SENT",
      },
    });

    // Emit live chat socket update
    try {
      const io = getIO();
      const member = await prisma.member.findFirst({
        where: { gymId: gym.id, phone: recipientPhone },
      });

      if (member) {
        io.to(`conversation:${member.id}`).emit("message:new", {
          id: msgId,
          whatsappMessageId: msgId,
          content: messageText,
          direction: "outbound",
          status: "sent",
          createdAt: new Date().toISOString(),
        });
      }
      io.to(`gym:${gym.id}`).emit("inbox:update");
    } catch (wsErr) {
      console.error("⚠️ Socket emit failed on manual approve msg:", wsErr);
    }
  } catch (err) {
    console.error("❌ Error sending WhatsApp message:", err);
  }
}

// GET /api/dashboard/:gymSlug/payments
router.get("/", async (req, res) => {
  const { gymSlug } = req.params;

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
      select: { id: true },
    });

    if (!gym) {
      return res.status(404).json({ error: "Gym not found" });
    }

    const transactions = await prisma.transaction.findMany({
      where: { gymId: gym.id },
      include: {
        member: {
          select: {
            memberName: true,
            phone: true,
          },
        },
        plan: {
          select: {
            name: true,
            durationDays: true,
          },
        },
        invoice: {
          select: {
            invoiceNumber: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Map memberName to name for frontend compatibility
    const mappedTransactions = transactions.map((t) => ({
      ...t,
      member: {
        name: t.member.memberName,
        phone: t.member.phone,
      },
    }));

    res.json({ transactions: mappedTransactions });
  } catch (err) {
    console.error("❌ [Payments GET] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/dashboard/:gymSlug/payments
router.post("/", async (req, res) => {
  const { gymSlug } = req.params;
  const { transactionId, action, reason } = req.body;

  if (!transactionId || !action) {
    return res.status(400).json({ error: "transactionId and action are required" });
  }

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
    });

    if (!gym) {
      return res.status(404).json({ error: "Gym not found" });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { member: true, plan: true },
    });

    if (!transaction || transaction.gymId !== gym.id) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    if (action === "APPROVE") {
      if (transaction.status === "PAID") {
        return res.status(400).json({ error: "Transaction is already paid" });
      }

      // Approve & Extend membership + invoice creation
      const result = await processCompletedPayment(transactionId, async (phone, text) => {
        await sendWhatsAppMessage(gym, phone, text);
      });

      await prisma.auditLog.create({
        data: {
          action: "TRANSACTION_APPROVE",
          details: `Approved manual UPI reference "${transaction.referenceId || "none"}" for member ${transaction.member.memberName} (Plan: ${transaction.plan.name})`,
          gymId: gym.id,
          userId: req.user?.userId || null,
        },
      });

      // Socket updates
      try {
        const io = getIO();
        io.to(`gym:${gym.id}`).emit("inbox:update");
      } catch (e) {}

      return res.json({ success: true, transaction: result.transaction });
    } else if (action === "REJECT") {
      if (transaction.status !== "AWAITING_VERIFICATION" && transaction.status !== "PENDING") {
        return res.status(400).json({ error: "Transaction cannot be rejected in this state" });
      }

      const rejectReason = reason || "Reference ID mismatch or not received";

      const updated = await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: "REJECTED",
          paymentDetails: {
            rejectionReason: rejectReason,
            rejectedAt: new Date().toISOString(),
          },
        },
      });

      await prisma.notification.create({
        data: {
          gymId: gym.id,
          memberId: transaction.memberId,
          recipientPhone: transaction.member.phone,
          title: `Payment Rejected - ${transaction.plan.name}`,
          message: `Payment validation of ₹${transaction.amount} rejected. Reason: ${rejectReason}`,
          type: "PAYMENT_REJECTED",
          status: "SENT",
        },
      });

      await prisma.auditLog.create({
        data: {
          action: "TRANSACTION_REJECT",
          details: `Rejected manual UPI reference "${transaction.referenceId || "none"}" for member ${transaction.member.memberName}. Reason: ${rejectReason}`,
          gymId: gym.id,
          userId: req.user?.userId || null,
        },
      });

      // Send rejection alert to WhatsApp
      const rejectText = `Hello ${transaction.member.memberName},\n\nWe were unable to verify your manual UPI payment of ₹${transaction.amount} for the *${transaction.plan.name}* membership at *${gym.name}*.\n\n⚠️ *Reason for Rejection*:\n${rejectReason}\n\nPlease verify your reference number and re-submit via WhatsApp or visit the gym reception to get active.`;
      await sendWhatsAppMessage(gym, transaction.member.phone, rejectText);

      return res.json({ success: true, transaction: updated });
    } else {
      return res.status(400).json({ error: "Invalid action. Must be APPROVE or REJECT" });
    }
  } catch (err) {
    console.error("❌ [Payments POST] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/dashboard/:gymSlug/payments/settings
router.get("/settings", async (req, res) => {
  const { gymSlug } = req.params;

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
      select: { id: true },
    });

    if (!gym) {
      return res.status(404).json({ error: "Gym not found" });
    }

    let settings = await prisma.paymentSettings.findUnique({
      where: { gymId: gym.id },
    });

    if (!settings) {
      settings = await prisma.paymentSettings.create({
        data: { gymId: gym.id },
      });
    }

    res.json({ settings });
  } catch (err) {
    console.error("❌ [Payments Settings GET] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/dashboard/:gymSlug/payments/settings
router.post("/settings", async (req, res) => {
  const { gymSlug } = req.params;
  const { upiId, upiName, razorpayKeyId, razorpayKeySecret, isRazorpayEnabled } = req.body;

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
      select: { id: true },
    });

    if (!gym) {
      return res.status(404).json({ error: "Gym not found" });
    }

    const updated = await prisma.paymentSettings.upsert({
      where: { gymId: gym.id },
      update: {
        upiId: upiId !== undefined ? upiId : undefined,
        upiName: upiName !== undefined ? upiName : undefined,
        razorpayKeyId: razorpayKeyId !== undefined ? razorpayKeyId : undefined,
        razorpayKeySecret: razorpayKeySecret !== undefined ? razorpayKeySecret : undefined,
        isRazorpayEnabled: isRazorpayEnabled !== undefined ? !!isRazorpayEnabled : undefined,
      },
      create: {
        gymId: gym.id,
        upiId: upiId || null,
        upiName: upiName || null,
        razorpayKeyId: razorpayKeyId || null,
        razorpayKeySecret: razorpayKeySecret || null,
        isRazorpayEnabled: !!isRazorpayEnabled,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "PAYMENT_SETTINGS_UPDATE",
        details: `Updated payment integration settings (Razorpay: ${updated.isRazorpayEnabled ? "ENABLED" : "DISABLED"})`,
        gymId: gym.id,
        userId: req.user?.userId || null,
      },
    });

    res.json({ success: true, settings: updated });
  } catch (err) {
    console.error("❌ [Payments Settings POST] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
