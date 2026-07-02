import { Router } from "express";
import prisma from "../prisma.js";
import { decrypt } from "../utils/encryption.js";
import { getIO } from "../socket.js";
import { processCompletedPayment } from "../utils/chatbotHelper.js";

const router = Router();

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
      console.error("⚠️ Socket emit failed on webhook approve msg:", wsErr);
    }
  } catch (err) {
    console.error("❌ Error sending WhatsApp message:", err);
  }
}

// POST /api/webhook/razorpay
router.post("/", async (req, res) => {
  const body = req.body;

  console.log("📥 Received Razorpay Webhook Event:", body.event);

  // Send immediate 200 OK to Razorpay to prevent retry timeouts
  res.status(200).json({ received: true });

  try {
    if (body.event === "payment.captured") {
      const paymentEntity = body.payload?.payment?.entity;
      const notes = paymentEntity?.notes || {};
      const transactionId = notes.transactionId;

      if (!transactionId) {
        console.warn("⚠️ Razorpay Webhook payload missing transactionId in notes.");
        return;
      }

      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: { gym: true, member: true, plan: true },
      });

      if (!transaction) {
        console.error(`❌ Transaction ID ${transactionId} not found from Razorpay Webhook.`);
        return;
      }

      if (transaction.status === "PAID") {
        console.log(`ℹ️ Transaction ${transactionId} is already marked as PAID. Skipping.`);
        return;
      }

      // Log webhook data to transaction details
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          referenceId: paymentEntity.id,
          paymentDetails: body,
        },
      });

      // Complete payment flow
      console.log(`⚡ Processing PAID status for Transaction ID: ${transactionId}...`);
      await processCompletedPayment(transactionId, async (phone, text) => {
        await sendWhatsAppMessage(transaction.gym, phone, text);
      });

      console.log(`✅ Razorpay Webhook Payment successfully resolved for txn ${transactionId}`);
    } else {
      console.log(`ℹ️ Unhandled Razorpay event type: "${body.event}". Ignored.`);
    }
  } catch (err) {
    console.error("❌ Error resolving Razorpay webhook callback event:", err);
  }
});

export default router;
