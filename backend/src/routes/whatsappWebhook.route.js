import { Router } from "express";
import prisma from "../prisma.js";
import { getIO } from "../socket.js";
import { handleChatbotMessage } from "../utils/chatbotHelper.js";
import { decrypt } from "../utils/encryption.js";

const router = Router();

// Configuration token from environment
const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

/**
 * =====================================
 * WEBHOOK VERIFICATION (META GET)
 * =====================================
 */
router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("🔍 Webhook Verification Attempt:", { mode, token });

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified successfully");
    return res.status(200).send(challenge);
  }

  console.error("❌ Webhook verification failed. Token mismatch.");
  return res.sendStatus(403);
});

/**
 * =====================================
 * WEBHOOK EVENT RECEIVER (META POST)
 * =====================================
 */
router.post("/", async (req, res) => {
  const body = req.body;

  // Let Meta know we received the event immediately to avoid retries
  res.sendStatus(200);

  try {
    console.log("📥 Received Webhook Event Raw Body:", JSON.stringify(body, null, 2));

    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value) {
      console.log("ℹ️ Webhook payload ignored (no 'value' object found).");
      return;
    }

    // Resolve matching Gym tenant by Meta Phone Number ID
    const phoneNumberId = value.metadata?.phone_number_id;
    if (!phoneNumberId) {
      console.log("ℹ️ Webhook payload ignored (no 'phone_number_id' in metadata).");
      return;
    }

    // Find all gyms sharing this phone number ID
    const gyms = await prisma.gym.findMany({
      where: { whatsapp_phone_number_id: phoneNumberId },
    });

    if (gyms.length === 0) {
      console.warn(`⚠️ Received WhatsApp webhook for unregistered Phone ID: ${phoneNumberId}`);
      return;
    }

    // Determine the correct gym tenant
    let gym = gyms[0];
    if (gyms.length > 1) {
      let resolvedGym = null;

      if (value.messages?.length) {
        const phoneToMatch = value.messages[0].from;
        const matchingMember = await prisma.member.findFirst({
          where: {
            phone: phoneToMatch,
            gymId: { in: gyms.map(g => g.id) }
          }
        });
        if (matchingMember) {
          resolvedGym = gyms.find(g => g.id === matchingMember.gymId);
        }
      } else if (value.statuses?.length) {
        const messageId = value.statuses[0].id;
        const matchingMessage = await prisma.whatsAppMessage.findUnique({
          where: { messageId },
          select: { gymId: true }
        });
        if (matchingMessage) {
          resolvedGym = gyms.find(g => g.id === matchingMessage.gymId);
        }
      }

      if (resolvedGym) {
        gym = resolvedGym;
      }
    }

    console.log(`🏢 Resolved Gym Tenant: "${gym.name}" (Slug: ${gym.slug}) for Phone ID: ${phoneNumberId}`);

    /* =====================================================
       1. CUSTOMER MESSAGES (INBOUND)
       ===================================================== */
    if (value.messages?.length) {
      console.log(`💬 Processing ${value.messages.length} inbound message(s)...`);
      for (const msg of value.messages) {
        const messageId = msg.id;
        const senderPhone = msg.from;
        const recipientPhone = value.metadata.display_phone_number || "";

        // Extract message body text
        let text = "";
        if (msg.type === "text") {
          text = msg.text?.body || "";
        } else if (msg.type === "interactive") {
          const interactive = msg.interactive;
          text = interactive?.button_reply?.title || interactive?.list_reply?.title || "[interactive]";
        } else if (msg.type === "button") {
          text = msg.button?.text || "";
        } else {
          text = `[${msg.type} message]`;
        }

        console.log(`📥 Message: "${text}" from ${senderPhone} to display # ${recipientPhone} (ID: ${messageId})`);

        // Check for duplicate messages (idempotency check)
        const exists = await prisma.whatsAppMessage.findUnique({
          where: { messageId },
        });

        if (!exists) {
          let textPayload = text;

          // Handle incoming media files (image, video, audio, document, sticker)
          if (["image", "video", "audio", "document", "sticker"].includes(msg.type)) {
            const mediaObj = msg[msg.type];
            const mediaId = mediaObj?.id;
            const mimeType = mediaObj?.mime_type || "";
            const caption = mediaObj?.caption || "";

            if (mediaId) {
              const mediaUrl = `/api/media/${gym.slug}/${mediaId}`;
              
              textPayload = JSON.stringify({
                mediaUrl,
                mimeType,
                caption
              });

              console.log(`🔗 Mapped incoming media (Type: ${msg.type}) to public proxy URL: ${mediaUrl}`);
              
              // Update local display text for logs and console
              text = caption || `[${msg.type} message]`;
            }
          }

          // Extract WhatsApp profile name
          const contactObj = value.contacts?.find((c) => c.wa_id === senderPhone) || value.contacts?.[0];
          const profileName = contactObj?.profile?.name || null;

          // Find member
          let member = await prisma.member.findFirst({
            where: {
              gymId: gym.id,
              phone: senderPhone
            }
          });

          if (member) {
            // Update existing member's whatsappName and optionally memberName if it's currently a phone number
            const cleanMemberName = member.memberName.replace(/[+\-\s()]/g, "");
            const isPhoneOnly = /^\d+$/.test(cleanMemberName) || cleanMemberName === member.phone;

            const updateData = {};
            if (profileName && profileName !== member.whatsappName) {
              updateData.whatsappName = profileName;
            }
            if (profileName && isPhoneOnly && profileName !== member.memberName) {
              updateData.memberName = profileName;
            }

            if (Object.keys(updateData).length > 0) {
              member = await prisma.member.update({
                where: { id: member.id },
                data: updateData
              });
            }
          }

          // Log message to database
          const incomingMessage = await prisma.whatsAppMessage.create({
            data: {
              gymId: gym.id,
              messageId,
              senderPhone,
              recipientPhone,
              text: textPayload,
              direction: "INBOUND",
              status: "RECEIVED",
            },
          });
          console.log(`💾 Saved inbound message to database: ${messageId}`);

          // Trigger WebSocket realtime update (if active)
          try {
            const io = getIO();
            io.to(`gym:${gym.id}`).emit("whatsapp:message", incomingMessage);
            console.log(`🔌 Emitted websocket event "whatsapp:message" for Gym ID: ${gym.id}`);

            if (member) {
              // Parse message text if it is a media JSON payload
              let content = incomingMessage.text;
              let mediaUrl = undefined;
              let mimeType = undefined;
              let caption = undefined;

              if (content.startsWith("{")) {
                try {
                  const parsed = JSON.parse(content);
                  if (parsed.mediaUrl) {
                    content = parsed.caption || `[${msg.type} message]`;
                    mediaUrl = parsed.mediaUrl;
                    mimeType = parsed.mimeType;
                    caption = parsed.caption;
                  }
                } catch (e) {}
              }

              const mappedMsg = {
                id: incomingMessage.id,
                whatsappMessageId: incomingMessage.messageId,
                content,
                text: content,
                mediaUrl,
                mimeType,
                caption,
                direction: "inbound",
                status: "received",
                createdAt: incomingMessage.createdAt
              };
              io.to(`conversation:${member.id}`).emit("message:new", mappedMsg);
            }
            io.to(`gym:${gym.id}`).emit("inbox:update");
          } catch (wsErr) {
            console.error("❌ Failed to emit WhatsApp WebSocket event:", wsErr.message);
          }

          // Disabled live WhatsApp auto-chatbot responder to prevent loops or rate limit concerns on real phone numbers.
          // This keeps the live webhook in read-only sync (messages go to Inbox for manual staff reply) while the sandbox simulator remains active.
          if (false && member && !member.isBotDisabled && !member.blockedAt) {
            try {
              console.log(`🤖 Chatbot active for member "${member.memberName}". Processing...`);
              const botResponse = await handleChatbotMessage(gym, member, text);
              
              if (gym.whatsapp_connected && gym.whatsapp_access_token && gym.whatsapp_phone_number_id) {
                const base = process.env.META_GRAPH_BASE_URL || "https://graph.facebook.com";
                const version = process.env.META_API_VERSION || "v25.0";
                const accessToken = decrypt(gym.whatsapp_access_token);
                
                const response = await fetch(
                  `${base}/${version}/${gym.whatsapp_phone_number_id}/messages`,
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
                      text: { body: botResponse.text }
                    })
                  }
                );

                const resData = await response.json();
                if (response.ok) {
                  const replyMsgId = resData.messages?.[0]?.id || `bot-${Date.now()}`;
                  
                  const outMessage = await prisma.whatsAppMessage.create({
                    data: {
                      gymId: gym.id,
                      messageId: replyMsgId,
                      senderPhone: gym.whatsappDisplayPhoneNumber || "system",
                      recipientPhone: member.phone,
                      text: botResponse.text,
                      direction: "OUTBOUND",
                      status: "SENT"
                    }
                  });

                  try {
                    const io = getIO();
                    io.to(`gym:${gym.id}`).emit("whatsapp:message", outMessage);
                    
                    const mappedMsg = {
                      id: outMessage.id,
                      whatsappMessageId: outMessage.messageId,
                      content: outMessage.text,
                      direction: "outbound",
                      status: "sent",
                      createdAt: outMessage.createdAt
                    };
                    io.to(`conversation:${member.id}`).emit("message:new", mappedMsg);
                    io.to(`gym:${gym.id}`).emit("inbox:update");
                  } catch (e) {}
                } else {
                  console.error("❌ Meta send chatbot reply failed:", resData);
                }
              } else {
                console.log("ℹ️ Skipping live WhatsApp chatbot dispatch. Integration not connected.");
              }
            } catch (chatbotErr) {
              console.error("❌ Error in chatbot handler:", chatbotErr);
            }
          }
        } else {
          console.log(`ℹ️ Duplicate message detected (ID: ${messageId}), skipping database insert.`);
        }
      }
    }

    /* =====================================================
       2. STATUS UPDATES (OUTBOUND DELIVERIES)
       ===================================================== */
    if (value.statuses?.length) {
      console.log(`📊 Processing ${value.statuses.length} status update(s)...`);
      for (const statusObj of value.statuses) {
        const messageId = statusObj.id;
        const metaState = statusObj.status; // sent | delivered | read | failed
        const errorCode = statusObj.errors?.[0]?.code;
        const errorMessage = statusObj.errors?.[0]?.message || null;

        console.log(`📈 Outbound Status ID: ${messageId} -> State: "${metaState}" (ErrorCode: ${errorCode || "none"})`);

        // Try to update existing database message status
        const message = await prisma.whatsAppMessage.findUnique({
          where: { messageId },
        });

        if (message) {
          await prisma.whatsAppMessage.update({
            where: { messageId },
            data: {
              status: metaState.toUpperCase(),
              errorMessage: errorMessage || null,
            },
          });
          console.log(`💾 Updated status in DB for message ${messageId} to ${metaState.toUpperCase()}`);

          // Log raw event for auditing since the message exists
          await prisma.whatsAppEvent.create({
            data: {
              messageId,
              eventType: metaState.toUpperCase(),
              timestamp: new Date(Number(statusObj.timestamp) * 1000),
              rawPayload: statusObj,
            },
          });
          console.log(`💾 Logged raw WhatsApp event for message ID: ${messageId}`);
        } else {
          console.log(`⚠️ No matching outbound message found in DB for Status ID: ${messageId}. Skipping status update and event logging.`);
        }

        // Trigger WebSocket updates for status changes
        if (message) {
          try {
            const io = getIO();
            io.to(`gym:${gym.id}`).emit("whatsapp:status", {
              messageId,
              status: metaState.toUpperCase(),
              errorCode,
              errorMessage,
            });
            console.log(`🔌 Emitted websocket event "whatsapp:status" for Gym ID: ${gym.id}`);

            // Emit to inbox conversation and update lists
            const member = await prisma.member.findFirst({
              where: {
                gymId: gym.id,
                phone: message.recipientPhone
              }
            });
            if (member) {
              io.to(`conversation:${member.id}`).emit("message:status", {
                whatsappMessageId: messageId,
                status: metaState.toLowerCase()
              });
            }
            io.to(`gym:${gym.id}`).emit("inbox:update");
          } catch (wsErr) {
            console.error("❌ Failed to emit status update WebSocket event:", wsErr.message);
          }
        }
      }
    }
  } catch (err) {
    console.error("❌ Error processing WhatsApp webhook payload:", err);
  }
});

export default router;
