import { Router } from "express";
import prisma from "../prisma.js";

const router = Router({ mergeParams: true });

// GET /api/dashboard/:gymSlug/chatbot
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

    let chatbotSettings = await prisma.chatbotSettings.findUnique({
      where: { gymId: gym.id },
    });

    if (!chatbotSettings) {
      chatbotSettings = await prisma.chatbotSettings.create({
        data: {
          gymId: gym.id,
        },
      });
    }

    res.json({ chatbotSettings });
  } catch (err) {
    console.error("❌ [Chatbot GET] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/dashboard/:gymSlug/chatbot
router.post("/", async (req, res) => {
  const { gymSlug } = req.params;
  const { welcomeMessage, isAiModeEnabled, aiKnowledgeBase } = req.body;

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
      select: { id: true, name: true },
    });

    if (!gym) {
      return res.status(404).json({ error: "Gym not found" });
    }

    const updated = await prisma.chatbotSettings.upsert({
      where: { gymId: gym.id },
      update: {
        welcomeMessage: welcomeMessage !== undefined ? welcomeMessage : undefined,
        isAiModeEnabled: isAiModeEnabled !== undefined ? isAiModeEnabled : undefined,
        aiKnowledgeBase: aiKnowledgeBase !== undefined ? aiKnowledgeBase : undefined,
      },
      create: {
        gymId: gym.id,
        welcomeMessage: welcomeMessage || `Welcome to ${gym.name}!\n\n1. My Membership\n2. Renew Membership\n3. View Plans\n4. Contact Gym\n5. Offers`,
        isAiModeEnabled: !!isAiModeEnabled,
        aiKnowledgeBase: aiKnowledgeBase || "",
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CHATBOT_UPDATE",
        details: `Updated chatbot configurations (AI Mode: ${updated.isAiModeEnabled ? "ENABLED" : "DISABLED"})`,
        gymId: gym.id,
        userId: req.user?.userId || null,
      },
    });

    res.json({ success: true, chatbotSettings: updated });
  } catch (err) {
    console.error("❌ [Chatbot POST] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
