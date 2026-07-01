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
    console.log(
      "📥 Received Webhook Event Raw Body:",
      JSON.stringify(body, null, 2),
    );

    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const field = change?.field;

    // Silently ignore other Meta webhook fields (like flows health alerts, template state updates, etc.)
    if (field && field !== "messages") {
      return;
    }

    console.log("📥 Received Webhook Event Raw Body:", JSON.stringify(body, null, 2));

    if (!value) {
      console.log("ℹ️ Webhook payload ignored (no 'value' object found).");
      return;
    }

    const field = change?.field;

    /* =====================================================
       0. PHONE NUMBER NAME UPDATE
       ===================================================== */
    if (field === "phone_number_name_update") {
      console.log(`📝 Received phone_number_name_update webhook:`, value);
      const decision = value.decision; // APPROVED or REJECTED
      const rejectionReason = value.rejection_reason || null;

      // Find the active history request by looking at all active ones
      // (since the webhook might only have display_phone_number or WABA ID)
      // WABA ID is entry[0].id
      const wabaId = entry?.id;

      let gyms = [];
      if (wabaId) {
        gyms = await prisma.gym.findMany({
          where: { whatsapp_waba_id: wabaId },
        });
      }

      if (gyms.length > 0) {
        for (const g of gyms) {
          const activeRequest =
            await prisma.whatsAppDisplayNameHistory.findFirst({
              where: { gymId: g.id, isActive: true },
            });

          if (activeRequest) {
            if (
              activeRequest.status === "APPROVED" ||
              activeRequest.status === "DECLINED"
            ) {
              console.log(
                `ℹ️ Webhook idempotency: Request for gym ${g.id} already processed.`,
              );
              continue;
            }

            if (decision === "APPROVED") {
              await prisma.$transaction([
                prisma.gym.update({
                  where: { id: g.id },
                  data: {
                    pendingNameStatus: "REGISTERING",
                  },
                }),
                prisma.whatsAppDisplayNameHistory.update({
                  where: { id: activeRequest.id },
                  data: {
                    status: "APPROVED",
                    approvedAt: new Date(),
                  },
                }),
              ]);

              // Queue BullMQ job for registration
              const { whatsappQueue } = await import("../lib/queue.js");
              await whatsappQueue.add(
                "register-phone-number",
                {
                  gymId: g.id,
                  phoneNumberId: g.whatsapp_phone_number_id,
                  accessToken: (await import("../utils/encryption.js")).decrypt(
                    g.whatsapp_access_token,
                  ),
                },
                {
                  attempts: 4,
                  backoff: {
                    type: "exponential",
                    delay: 30000, // 30s, 60s, 120s
                  },
                },
              );
            } else if (decision === "REJECTED") {
              await prisma.$transaction([
                prisma.gym.update({
                  where: { id: g.id },
                  data: {
                    pendingNameStatus: "DECLINED",
                  },
                }),
                prisma.whatsAppDisplayNameHistory.update({
                  where: { id: activeRequest.id },
                  data: {
                    status: "DECLINED",
                    rejectionReason,
                    isActive: false,
                  },
                }),
              ]);
            }
          }
        }
      }
      return;
    }

    // Resolve matching Gym tenant by Meta Phone Number ID
    const phoneNumberId = value.metadata?.phone_number_id;
    if (!phoneNumberId) {
      console.log(
        "ℹ️ Webhook payload ignored (no 'phone_number_id' in metadata).",
      );
      return;
    }

    // Find all gyms sharing this phone number ID
    const gyms = await prisma.gym.findMany({
      where: { whatsapp_phone_number_id: phoneNumberId },
    });

    if (gyms.length === 0) {
      console.warn(
        `⚠️ Received WhatsApp webhook for unregistered Phone ID: ${phoneNumberId}`,
      );
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
            gymId: { in: gyms.map((g) => g.id) },
          },
        });
        if (matchingMember) {
          resolvedGym = gyms.find((g) => g.id === matchingMember.gymId);
        }
      } else if (value.statuses?.length) {
        const messageId = value.statuses[0].id;
        const matchingMessage = await prisma.whatsAppMessage.findUnique({
          where: { messageId },
          select: { gymId: true },
        });
        if (matchingMessage) {
          resolvedGym = gyms.find((g) => g.id === matchingMessage.gymId);
        }
      }

      if (resolvedGym) {
        gym = resolvedGym;
      }
    }

    console.log(
      `🏢 Resolved Gym Tenant: "${gym.name}" (Slug: ${gym.slug}) for Phone ID: ${phoneNumberId}`,
    );

    /* =====================================================
       1. CUSTOMER MESSAGES (INBOUND)
       ===================================================== */
    if (value.messages?.length) {
      console.log(
        `💬 Processing ${value.messages.length} inbound message(s)...`,
      );
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
          if (interactive?.type === "call_permission_reply") {
            const reply = interactive.call_permission_reply;
            text = reply.response === "accept"
              ? "✅ Call permission granted by customer"
              : "❌ Call permission denied by customer";
          } else {
            text =
              interactive?.button_reply?.title ||
              interactive?.list_reply?.title ||
              "[interactive]";
          }
        } else if (msg.type === "button") {
          text = msg.button?.text || "";
        } else {
          text = `[${msg.type} message]`;
        }

        console.log(
          `📥 Message: "${text}" from ${senderPhone} to display # ${recipientPhone} (ID: ${messageId})`,
        );

        // Check for duplicate messages (idempotency check)
        const exists = await prisma.whatsAppMessage.findUnique({
          where: { messageId },
        });

        if (!exists) {
          let textPayload = text;

          // Handle incoming media files (image, video, audio, document, sticker)
          if (
            ["image", "video", "audio", "document", "sticker"].includes(
              msg.type,
            )
          ) {
            const mediaObj = msg[msg.type];
            const mediaId = mediaObj?.id;
            const mimeType = mediaObj?.mime_type || "";
            const caption = mediaObj?.caption || "";

            if (mediaId) {
              const mediaUrl = `/api/media/${gym.slug}/${mediaId}`;

              textPayload = JSON.stringify({
                mediaUrl,
                mimeType,
                caption,
              });

              console.log(
                `🔗 Mapped incoming media (Type: ${msg.type}) to public proxy URL: ${mediaUrl}`,
              );

              // Update local display text for logs and console
              text = caption || `[${msg.type} message]`;
            }
          }

          // Extract WhatsApp profile name
          const contactObj =
            value.contacts?.find((c) => c.wa_id === senderPhone) ||
            value.contacts?.[0];
          const profileName = contactObj?.profile?.name || null;

          // Find member
          let member = await prisma.member.findFirst({
            where: {
              gymId: gym.id,
              phone: senderPhone,
            },
          });

          if (member) {
            // Update existing member's whatsappName and optionally memberName if it's currently a phone number
            const cleanMemberName = member.memberName.replace(/[+\-\s()]/g, "");
            const isPhoneOnly =
              /^\d+$/.test(cleanMemberName) || cleanMemberName === member.phone;

            const updateData = {};
            if (profileName && profileName !== member.whatsappName) {
              updateData.whatsappName = profileName;
            }
            if (
              profileName &&
              isPhoneOnly &&
              profileName !== member.memberName
            ) {
              updateData.memberName = profileName;
            }

            // Update Call Permission Status
            let shouldEmitMemberUpdate = false;
            if (msg.type === "interactive" && msg.interactive?.type === "call_permission_reply") {
              const reply = msg.interactive.call_permission_reply;
              if (reply.response === "accept") {
                updateData.callPermissionStatus = "GRANTED";
                updateData.callPermissionGrantedAt = new Date();
              } else if (reply.response === "deny") {
                updateData.callPermissionStatus = "DENIED";
                updateData.callPermissionRevokedAt = new Date(); // Using revoked/denied field
              }
              updateData.callPermissionUpdatedAt = new Date();
              shouldEmitMemberUpdate = true;
            }

            if (Object.keys(updateData).length > 0) {
              member = await prisma.member.update({
                where: { id: member.id },
                data: updateData,
              });

              if (shouldEmitMemberUpdate) {
                try {
                  const io = (await import("../socket.js")).getIO();
                  io.to(`gym:${gym.id}`).emit("member:updated", member);
                } catch (e) {
                  console.error("Failed to emit member:updated", e);
                }
              }
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
            console.log(
              `🔌 Emitted websocket event "whatsapp:message" for Gym ID: ${gym.id}`,
            );

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
                } catch (e) { }
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
                createdAt: incomingMessage.createdAt,
              };
              io.to(`conversation:${member.id}`).emit("message:new", mappedMsg);
            }
            io.to(`gym:${gym.id}`).emit("inbox:update");
          } catch (wsErr) {
            console.error(
              "❌ Failed to emit WhatsApp WebSocket event:",
              wsErr.message,
            );
          }
        } else {
          console.log(
            `ℹ️ Duplicate message detected (ID: ${messageId}), skipping database insert.`,
          );
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

        console.log(
          `📈 Outbound Status ID: ${messageId} -> State: "${metaState}" (ErrorCode: ${errorCode || "none"})`,
        );

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
          console.log(
            `💾 Updated status in DB for message ${messageId} to ${metaState.toUpperCase()}`,
          );

          // If this was a call permission request and it failed, reset the member's status
          if (metaState.toUpperCase() === "FAILED" && message.text === "📞 [Call Permission Request]") {
            const member = await prisma.member.findFirst({
              where: { gymId: gym.id, phone: message.recipientPhone },
            });
            if (member) {
              const updatedMember = await prisma.member.update({
                where: { id: member.id },
                data: {
                  callPermissionStatus: "UNKNOWN",
                  callPermissionUpdatedAt: new Date(),
                },
              });
              console.log(`💾 Reset callPermissionStatus to UNKNOWN for member ${member.id} due to failed template delivery`);

              // Broadcast updated member info
              try {
                const io = getIO();
                io.to(`gym:${gym.id}`).emit("member:updated", updatedMember);
              } catch (wsErr) {
                console.error("❌ Failed to emit member:updated status event:", wsErr.message);
              }
            }
          }

          // Log raw event for auditing since the message exists
          await prisma.whatsAppEvent.create({
            data: {
              messageId,
              eventType: metaState.toUpperCase(),
              timestamp: new Date(Number(statusObj.timestamp) * 1000),
              rawPayload: statusObj,
            },
          });
          console.log(
            `💾 Logged raw WhatsApp event for message ID: ${messageId}`,
          );
        } else {
          console.log(
            `⚠️ No matching outbound message found in DB for Status ID: ${messageId}. Skipping status update and event logging.`,
          );
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
            console.log(
              `🔌 Emitted websocket event "whatsapp:status" for Gym ID: ${gym.id}`,
            );

            // Emit to inbox conversation and update lists
            const member = await prisma.member.findFirst({
              where: {
                gymId: gym.id,
                phone: message.recipientPhone,
              },
            });
            if (member) {
              io.to(`conversation:${member.id}`).emit("message:status", {
                whatsappMessageId: messageId,
                status: metaState.toLowerCase(),
              });
            }
            io.to(`gym:${gym.id}`).emit("inbox:update");
          } catch (wsErr) {
            console.error(
              "❌ Failed to emit status update WebSocket event:",
              wsErr.message,
            );
          }
        }
      }
    }
    /* =====================================================
       3. WEBRTC CALLS (BUSINESS-INITIATED / TERMINATED)
       ===================================================== */
    if (value.calls?.length) {
      console.log(`📞 Processing ${value.calls.length} call event(s)...`);
      for (const callObj of value.calls) {
        const callId = callObj.id;
        const event = callObj.event || (callObj.session ? "connect" : "unknown");

        console.log(`📞 Call ID: ${callId} -> Event: "${event}"`);

        // Find the corresponding member based on the phone number
        // If from === gym's number, then it's an outbound call and the member is `to`.
        // If to === gym's number, then it's an inbound call and the member is `from`.
        const gymPhone = gym.whatsappDisplayPhoneNumber?.replace(/\D/g, '') || callObj.from;
        // Best effort: if 'from' is the gym's phone number (which we can check by matching metadata display_phone_number), then member is 'to'
        let memberPhone = callObj.from;

        // Use the metadata display_phone_number from the webhook if available to identify the gym's number
        const metadataDisplayPhone = value.metadata?.display_phone_number?.replace(/\D/g, '');
        if (metadataDisplayPhone && callObj.from === metadataDisplayPhone) {
          memberPhone = callObj.to;
        } else if (callObj.direction === "BUSINESS_INITIATED") {
          memberPhone = callObj.to;
        }

        let conversationId = null;
        let memberName = memberPhone;

        if (memberPhone && gym) {
          const member = await prisma.member.findFirst({
            where: { gymId: gym.id, phone: memberPhone },
          });
          if (member) {
            conversationId = member.id;
            memberName = member.memberName || member.name || memberPhone;
          }
        }

        if (conversationId) {
          try {
            const io = getIO();
            const payload = {
              callId,
              event,
              status: callObj.status?.[0] || null,
              sdp: callObj.session?.sdp || null,
              direction: callObj.direction || "BUSINESS_INITIATED",
              conversationId,
              memberName,
              memberPhone,
            };
            io.to(`conversation:${conversationId}`).emit("whatsapp_call_event", payload);
            io.to(`gym:${gym.id}`).emit("whatsapp_call_event", payload);
            console.log(`🔌 Emitted whatsapp_call_event to conversation:${conversationId} and gym:${gym.id}`);
          } catch (wsErr) {
            console.error("❌ Failed to emit whatsapp_call_event:", wsErr.message);
          }
        }
      }
    }

    // Call status webhooks arrive via `value.statuses` as well, with type='call'
    // Let's modify the statuses loop above to also handle call statuses!
    // But since I am inserting this block, I will let the above statuses block handle regular messages.
    // Wait, let's just parse call statuses here if present.
    if (value.statuses?.length) {
      for (const statusObj of value.statuses) {
        if (statusObj.type === "call") {
          const callId = statusObj.id;
          const metaState = statusObj.status; // RINGING | ACCEPTED | REJECTED

          console.log(`📞 Call Status ID: ${callId} -> State: "${metaState}"`);

          const recipientId = statusObj.recipient_id;
          let conversationId = null;
          if (recipientId && gym) {
            const member = await prisma.member.findFirst({
              where: { gymId: gym.id, phone: recipientId },
            });
            if (member) conversationId = member.id;
          }

          if (conversationId) {
            try {
              const io = getIO();
              io.to(`conversation:${conversationId}`).emit("whatsapp_call_event", {
                callId,
                event: "status",
                status: metaState
              });
            } catch (wsErr) {
              console.error("❌ Failed to emit call status:", wsErr.message);
            }
          }
        }
      }
    }

  } catch (err) {
    console.error("❌ Error processing WhatsApp webhook payload:", err);
  }
});

export default router;
