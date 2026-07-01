import { Router } from "express";
import prisma from "../prisma.js";

const router = Router({ mergeParams: true });

/**
 * =====================================
 * GET ALL PLANS
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

    const plans = await prisma.membershipPlan.findMany({
      where: { gymId: gym.id },
      include: {
        memberships: {
          include: {
            member: {
              select: {
                id: true,
                memberName: true,
                phone: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // Map memberName to name for frontend compatibility in plans
    const mappedPlans = plans.map(p => ({
      ...p,
      memberships: p.memberships.map(m => ({
        ...m,
        member: {
          ...m.member,
          name: m.member.memberName || ''
        }
      }))
    }));


    res.json({ plans: mappedPlans });
  } catch (err) {
    console.error("❌ [Plans GET] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * =====================================
 * CREATE A PLAN
 * =====================================
 */
router.post("/", async (req, res) => {
  const { gymSlug } = req.params;
  const { name, description, price, durationDays } = req.body;

  if (!name || price === undefined || !durationDays) {
    return res.status(400).json({ error: "Name, price, and duration are required" });
  }

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
      select: { id: true }
    });

    if (!gym) {
      return res.status(404).json({ error: "Gym not found" });
    }

    const newPlan = await prisma.membershipPlan.create({
      data: {
        gymId: gym.id,
        name,
        description: description || null,
        price: parseFloat(price),
        durationDays: parseInt(durationDays),
      }
    });

    res.status(201).json({ success: true, plan: newPlan });
  } catch (err) {
    console.error("❌ [Plans POST] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * =====================================
 * UPDATE A PLAN
 * =====================================
 */
router.put("/:planId", async (req, res) => {
  const { gymSlug, planId } = req.params;
  const { name, description, price, durationDays } = req.body;

  if (!name || price === undefined || !durationDays) {
    return res.status(400).json({ error: "Name, price, and duration are required" });
  }

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
      select: { id: true }
    });

    if (!gym) {
      return res.status(404).json({ error: "Gym not found" });
    }

    const plan = await prisma.membershipPlan.findFirst({
      where: { id: planId, gymId: gym.id }
    });

    if (!plan) {
      return res.status(404).json({ error: "Plan not found for this gym" });
    }

    const updatedPlan = await prisma.membershipPlan.update({
      where: { id: planId },
      data: {
        name,
        description: description || null,
        price: parseFloat(price),
        durationDays: parseInt(durationDays),
      }
    });

    res.json({ success: true, plan: updatedPlan });
  } catch (err) {
    console.error("❌ [Plans PUT] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * =====================================
 * DELETE A PLAN
 * =====================================
 */
router.delete("/:planId", async (req, res) => {
  const { gymSlug, planId } = req.params;

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
      select: { id: true }
    });

    if (!gym) {
      return res.status(404).json({ error: "Gym not found" });
    }

    const plan = await prisma.membershipPlan.findFirst({
      where: { id: planId, gymId: gym.id }
    });

    if (!plan) {
      return res.status(404).json({ error: "Plan not found for this gym" });
    }

    await prisma.membershipPlan.delete({
      where: { id: planId }
    });

    res.json({ success: true });
  } catch (err) {
    console.error("❌ [Plans DELETE] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;

