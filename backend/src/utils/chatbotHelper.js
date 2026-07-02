import prisma from "../prisma.js";
import { GoogleGenAI } from "@google/genai";

let ai = null;
if (
  process.env.GEMINI_API_KEY &&
  process.env.GEMINI_API_KEY !== "AIzaSyYourActualGeminiApiKeyGoesHere"
) {
  try {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  } catch (err) {
    console.error("❌ Failed to initialize GoogleGenAI:", err);
  }
}

/**
 * Main chatbot handler. Resolves message and returns response text and optional details.
 * Also side-effects transaction creation and payment setup when plans are selected.
 * 
 * @param {object} gym - The Gym model instance
 * @param {object} member - The Member model instance
 * @param {string} messageText - Inbound raw text
 * @returns {Promise<{text: string}>} - The chatbot response payload
 */
export async function handleChatbotMessage(gym, member, messageText) {
  const cleanMsg = messageText.trim().toLowerCase();

  // Fetch settings & payment configs
  const chatbotSettings = await prisma.chatbotSettings.findUnique({
    where: { gymId: gym.id },
  });

  const paymentSettings = await prisma.paymentSettings.findUnique({
    where: { gymId: gym.id },
  });

  const welcomeMessage = (chatbotSettings?.welcomeMessage || 
    "Welcome to {{gym_name}}!\n\n1. My Membership\n2. Renew Membership\n3. View Plans\n4. Contact Gym\n5. Offers"
  ).replace(/\{\{gym_name\}\}/g, gym.name);

  // --- 1. My Membership Details Route ---
  if (cleanMsg === "1" || cleanMsg === "membership") {
    const activeMembership = await prisma.membership.findFirst({
      where: {
        memberId: member.id,
        status: "ACTIVE",
      },
      include: { plan: true },
      orderBy: { endDate: "desc" },
    });

    if (activeMembership) {
      const start = new Date(activeMembership.startDate).toLocaleDateString("en-IN");
      const end = new Date(activeMembership.endDate).toLocaleDateString("en-IN");
      return {
        text: `🏋️‍♂️ *Your Membership Details*:\n\n*Plan:* ${activeMembership.plan.name}\n*Start Date:* ${start}\n*Expiry Date:* ${end}\n*Status:* ACTIVE\n\nNeed to extend? Reply with *2* to see renewal plans.`,
      };
    } else {
      return {
        text: `❌ You do not have an active membership plan.\n\nReply with *2* to view plans & buy a membership.`,
      };
    }
  }

  // --- 2. View Plans & Initiate Renewal / 3. View Plans Route ---
  if (cleanMsg === "2" || cleanMsg === "3" || cleanMsg === "renew" || cleanMsg === "plans") {
    const plans = await prisma.membershipPlan.findMany({
      where: { gymId: gym.id },
      orderBy: { createdAt: "desc" },
    });

    if (plans.length === 0) {
      return {
        text: `We do not have any membership plans configured at this time. Please contact the front desk.`,
      };
    }

    const plansText = plans
      .map((p, idx) => `*P${idx + 1}*: ${p.name} - ₹${p.price} (${p.durationDays} days)`)
      .join("\n");

    return {
      text: `💪 *Our Membership Plans*:\n\n${plansText}\n\n👉 Reply with the plan code (e.g. *P1*, *P2*) to select a plan and generate your payment checkout link.`,
    };
  }

  // --- 4. Contact Gym ---
  if (cleanMsg === "4" || cleanMsg === "contact") {
    return {
      text: `📞 *Contact ${gym.name}*:\n\n📍 Address: ${gym.address || "Contact front desk for address"}\n💬 WhatsApp Support: ${gym.whatsappDisplayPhoneNumber || "Check business profile"}\n📧 Email: ${gym.email || "Not configured"}\n\nReply with *menu* to see other choices.`,
    };
  }

  // --- 5. Offers ---
  if (cleanMsg === "5" || cleanMsg === "offers") {
    return {
      text: `🏷️ *Current Offers at ${gym.name}*:\n\n🔥 referral discount: Bring a friend and get 15% off your next month!\n⚡ Annual Saver: Subscribe to our yearly plan and save over ₹3,000.\n\nReply with *menu* to see other choices.`,
    };
  }

  // --- P1, P2 Plan selection ---
  const planMatch = cleanMsg.match(/^p(\d+)$/);
  if (planMatch) {
    const planIndex = parseInt(planMatch[1], 10) - 1;
    const plans = await prisma.membershipPlan.findMany({
      where: { gymId: gym.id },
      orderBy: { createdAt: "desc" },
    });

    if (planIndex >= 0 && planIndex < plans.length) {
      const selectedPlan = plans[planIndex];

      // Create a pending transaction
      const transaction = await prisma.transaction.create({
        data: {
          gymId: gym.id,
          memberId: member.id,
          planId: selectedPlan.id,
          amount: selectedPlan.price,
          status: "PENDING",
          paymentMode: paymentSettings?.isRazorpayEnabled ? "RAZORPAY" : "MANUAL_UPI",
        },
      });

      // Construct payment link relative to the frontend origin for simulator compatibility
      if (paymentSettings?.isRazorpayEnabled) {
        const checkoutUrl = `/dashboard/${gym.slug}/payments/mock-gateway?transactionId=${transaction.id}&amount=${selectedPlan.price}&member=${encodeURIComponent(member.memberName)}`;
        return {
          text: `You selected the *${selectedPlan.name}* plan (₹${selectedPlan.price} for ${selectedPlan.durationDays} days).\n\n💳 Complete your secure online payment via Razorpay here:\n👉 ${checkoutUrl}\n\nYour membership will activate automatically upon payment.`,
        };
      } else if (paymentSettings?.upiId) {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
          `upi://pay?pa=${paymentSettings.upiId}&pn=${paymentSettings.upiName || gym.name}&am=${selectedPlan.price}&tr=${transaction.id}`
        )}`;
        return {
          text: `${qrUrl}\n\nScan the QR code above to pay ₹${selectedPlan.price} to *${paymentSettings.upiName || gym.name}* via manual UPI.\n\nAfter completing payment, reply to us with your transaction reference number in this exact format:\n*PAID <reference_id>*`,
        };
      } else {
        return {
          text: `Selected *${selectedPlan.name}* (₹${selectedPlan.price}).\n\n⚠️ However, payment options are not fully set up for this gym yet. Please contact the front desk to pay manually and activate.`,
        };
      }
    } else {
      return {
        text: `Invalid plan selection. Please reply with *2* to view the available plans list again.`,
      };
    }
  }

  // --- PAID reference_id Manual UPI verification ---
  if (cleanMsg.startsWith("paid ")) {
    const referenceId = messageText.substring(5).trim();
    if (!referenceId) {
      return {
        text: `Please provide a valid reference number. Format: *PAID <reference_id>*`,
      };
    }

    // Find the latest pending transaction for this member
    const pendingTx = await prisma.transaction.findFirst({
      where: {
        memberId: member.id,
        status: "PENDING",
      },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });

    if (pendingTx) {
      await prisma.transaction.update({
        where: { id: pendingTx.id },
        data: {
          status: "AWAITING_VERIFICATION",
          referenceId: referenceId,
          paymentMode: "MANUAL_UPI",
        },
      });

      return {
        text: `✅ Reference number *${referenceId}* submitted successfully!\n\nOur team at *${gym.name}* will verify the receipt and activate your *${pendingTx.plan.name}* subscription shortly. You will get a receipt message once approved!`,
      };
    } else {
      return {
        text: `No pending subscription request was found. Please select a plan first by replying with *2*.`,
      };
    }
  }

  // --- 3. AI Assistant Mode fallback ---
  if (chatbotSettings?.isAiModeEnabled && ai) {
    try {
      const prompt = `You are a friendly and professional chatbot named "FitFlow Assistant" for the gym "${gym.name}".
Your task is to answer user queries using ONLY the context provided below.

=== Gym Knowledge Base ===
${chatbotSettings.aiKnowledgeBase || "No details configured yet."}
=========================

=== User Information ===
Name: ${member.memberName}
Phone: ${member.phone}

=== Guidelines ===
1. Keep your reply concise (1-3 sentences maximum), warm, and suitable for WhatsApp.
2. If the user's question can be answered using the Gym Knowledge Base, answer it directly.
3. If the user asks about membership renewals, active status, viewing plans, or paying, politely guide them to use our option numbers:
   - Reply '1' to check active membership details.
   - Reply '2' to renew/view subscription plans.
   - Reply '4' to get gym contact details.
4. If the user's query is completely unrelated to the gym or CANNOT be answered by the Knowledge Base, reply exactly with the following greeting message:
"${welcomeMessage}"

Inbound query: "${messageText}"
AI Response:`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const replyText = response.text?.trim() || welcomeMessage;
      return { text: replyText };
    } catch (err) {
      console.error("❌ Gemini AI generation error:", err);
      // Fall back to welcome menu on error
      return { text: welcomeMessage };
    }
  }

  // --- 4. Default Fallback ---
  return { text: welcomeMessage };
}

/**
 * Executes a successful transaction payment.
 * Activates/extends the membership, generates a tax invoice, and triggers WhatsApp confirmation.
 * 
 * @param {string} transactionId - The transaction ID to complete
 * @param {function} sendMessageFn - Function to send WhatsApp message (takes recipientPhone, text)
 * @returns {Promise<object>} - The processed objects
 */
export async function processCompletedPayment(transactionId, sendMessageFn) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { member: true, plan: true, gym: true },
  });

  if (!transaction) throw new Error("Transaction not found");
  if (transaction.status === "PAID") return { transaction };

  // Calculate membership dates
  const activeMembership = await prisma.membership.findFirst({
    where: {
      memberId: transaction.memberId,
      status: "ACTIVE",
    },
    orderBy: { endDate: "desc" },
  });

  let startDate = new Date();
  // If they have a membership that expires in the future, extend it from the expiry date
  if (activeMembership && new Date(activeMembership.endDate) > new Date()) {
    startDate = new Date(activeMembership.endDate);
  }

  const endDate = new Date(startDate.getTime() + transaction.plan.durationDays * 24 * 60 * 60 * 1000);

  // Perform database updates in a Prisma transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Mark transaction as PAID
    const updatedTx = await tx.transaction.update({
      where: { id: transactionId },
      data: { status: "PAID" },
    });

    // 2. Create or extend membership
    let membership;
    if (activeMembership) {
      membership = await tx.membership.update({
        where: { id: activeMembership.id },
        data: {
          planId: transaction.planId,
          startDate: startDate,
          endDate: endDate,
          status: "ACTIVE",
        },
      });
    } else {
      membership = await tx.membership.create({
        data: {
          gymId: transaction.gymId,
          memberId: transaction.memberId,
          planId: transaction.planId,
          startDate: startDate,
          endDate: endDate,
          status: "ACTIVE",
        },
      });
    }

    // 3. Generate Invoice number
    const count = await tx.invoice.count({
      where: { gymId: transaction.gymId },
    });
    const prefix = transaction.gym.slug.toUpperCase().slice(0, 4);
    const invoiceNumber = `INV-${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const invoice = await tx.invoice.create({
      data: {
        gymId: transaction.gymId,
        transactionId: transactionId,
        invoiceNumber: invoiceNumber,
      },
    });

    // 4. Create Activation/Payment notification log
    await tx.notification.create({
      data: {
        gymId: transaction.gymId,
        memberId: transaction.memberId,
        recipientPhone: transaction.member.phone,
        title: `Payment Received - ${transaction.plan.name}`,
        message: `Success! Payment of ₹${transaction.amount} received. Active till ${endDate.toLocaleDateString("en-IN")}. Link: /receipt/${transactionId}`,
        type: "PAYMENT_RECEIVED",
        status: "SENT",
      },
    });

    return { transaction: updatedTx, membership, invoice };
  });

  // 5. Send automated confirmation via WhatsApp
  const startStr = startDate.toLocaleDateString("en-IN");
  const endStr = endDate.toLocaleDateString("en-IN");
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const receiptUrl = `${frontendUrl}/receipt/${transactionId}`;

  const messageText = `Hello ${transaction.member.memberName}! 🏋️‍♂️\n\nYour payment of ₹${transaction.amount} for the *${transaction.plan.name}* membership at *${transaction.gym.name}* was successful!\n\n📅 *New Membership Period*:\nStart: ${startStr}\nExpiry: ${endStr}\n\n📄 View & download your digital tax invoice/receipt here:\n👉 ${receiptUrl}\n\nThank you for choosing ${transaction.gym.name}! Keep crushing your fitness goals! 💪`;

  try {
    await sendMessageFn(transaction.member.phone, messageText);
  } catch (err) {
    console.error("⚠️ Failed to dispatch WhatsApp receipt alert:", err.message);
  }

  return result;
}
