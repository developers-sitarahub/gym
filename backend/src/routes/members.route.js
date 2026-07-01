import { Router } from "express";
import prisma from "../prisma.js";
import { getIO } from "../socket.js";

const router = Router({ mergeParams: true });

/**
 * =====================================
 * GET ALL MEMBERS (DIRECTORY)
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

    const members = await prisma.member.findMany({
      where: { gymId: gym.id },
      include: {
        memberships: {
          include: {
            plan: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // Map memberName to name for frontend compatibility
    const mappedMembers = members.map(m => ({
      ...m,
      name: m.memberName || ''
    }));

    res.json({ members: mappedMembers });
  } catch (err) {
    console.error("❌ [Members GET] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * =====================================
 * ADD NEW MEMBER
 * =====================================
 */
router.post("/", async (req, res) => {
  const { gymSlug } = req.params;
  const { name, memberName, phone, email, address, dob, emergencyContact, notes, planId, startDate, endDate } = req.body;
  const actualName = name || memberName;

  if (!actualName || !phone) {
    return res.status(400).json({ error: "Name and Phone number are required" });
  }

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
      select: { id: true, name: true }
    });

    if (!gym) {
      return res.status(404).json({ error: "Gym not found" });
    }

    // Clean phone number (leave digits only)
    const formattedPhone = phone.replace(/\D/g, "");

    // Check unique phone number per gym tenant
    const existing = await prisma.member.findUnique({
      where: {
        gymId_phone: {
          gymId: gym.id,
          phone: formattedPhone
        }
      }
    });

    if (existing) {
      return res.status(400).json({ error: "A member with this phone number is already registered." });
    }


    const memberData = {
      gymId: gym.id,
      memberName: actualName,
      phone: formattedPhone,
      email: email || null,
      address: address || null,
      dob: dob ? new Date(dob) : null,
      emergencyContact: emergencyContact || null,
      notes: notes || null
    };

    if (planId && startDate && endDate) {
      memberData.memberships = {
        create: {
          gymId: gym.id,
          planId: planId,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          status: "ACTIVE"
        }
      };
    }

    const newMember = await prisma.member.create({
      data: memberData,
      include: {
        memberships: {
          include: { plan: true }
        }
      }
    });

    // Queue welcome template message for the new member
    await prisma.notification.create({
      data: {
        gymId: gym.id,
        memberId: newMember.id,
        recipientPhone: formattedPhone,
        title: `TEMPLATE:welcome_member:${actualName},${gym.name}`,
        message: `Welcome ${actualName} to ${gym.name}! Your account has been registered successfully.`,
        type: "ACTIVATION",
        status: "PENDING",
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "MEMBER_CREATE",
        details: `Member ${actualName} (${formattedPhone}) registered manually.`,
        gymId: gym.id,
        userId: req.user?.userId || null
      }
    });

    // Map memberName to name for frontend compatibility
    const mappedMember = {
      ...newMember,
      name: newMember.memberName
    };

    res.status(201).json({ success: true, member: mappedMember });
  } catch (err) {
    console.error("❌ [Members POST] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * =====================================
 * GET MEMBER MESSAGES LOGS
 * =====================================
 */
router.get("/:memberId/messages", async (req, res) => {
  try {
    const { gymSlug, memberId } = req.params;
    const messages = await prisma.notification.findMany({
      where: {
        memberId,
        gym: { slug: gymSlug.toLowerCase() },
      },
      orderBy: { createdAt: "asc" },
    });
    res.json({ messages });
  } catch (err) {
    console.error("❌ [Members GET Messages] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * =====================================
 * TOGGLE BOT FOR A MEMBER (TAKEOVER)
 * =====================================
 */
router.post("/:memberId/toggle-bot", async (req, res) => {
  try {
    const { gymSlug, memberId } = req.params;
    const { isBotDisabled } = req.body;

    const member = await prisma.member.update({
      where: {
        id: memberId,
        gym: { slug: gymSlug.toLowerCase() },
      },
      data: { isBotDisabled },
    });

    await prisma.auditLog.create({
      data: {
        action: isBotDisabled ? "BOT_PAUSE" : "BOT_RESUME",
        details: `${isBotDisabled ? "Paused" : "Resumed"} chatbot for member ${member.memberName || ''} (${member.phone})`,
        gymId: member.gymId,
        userId: req.user?.userId || null,
      },
    });

    res.json({ success: true, member });
  } catch (err) {
    console.error("❌ [Members POST Toggle Bot] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * =====================================
 * UPDATE A MEMBER
 * =====================================
 */
router.put("/:memberId", async (req, res) => {
  try {
    const { gymSlug, memberId } = req.params;
    const { name, phone, email, address, dob, emergencyContact, notes, planId, startDate, endDate } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: "Name and phone are required" });
    }

    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
    });

    if (!gym) {
      return res.status(404).json({ error: "Gym not found" });
    }

    const formattedPhone = phone.replace(/\D/g, "");

    // Verify member belongs to this gym
    const memberToUpdate = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!memberToUpdate || memberToUpdate.gymId !== gym.id) {
      return res.status(404).json({ error: "Member not found in this gym" });
    }

    // Check if phone registered to another member in this gym
    const existing = await prisma.member.findFirst({
      where: {
        gymId: gym.id,
        phone: formattedPhone,
        NOT: { id: memberId },
      },
    });

    if (existing) {
      return res.status(400).json({ error: "Member phone already exists for this gym" });
    }

    // Update basic details
    const member = await prisma.member.update({
      where: { id: memberId },
      data: {
        memberName: name,
        phone: formattedPhone,
        email: email || null,
        address: address || null,
        dob: dob ? new Date(dob) : null,
        emergencyContact: emergencyContact || null,
        notes: notes || null,
      },
    });

    // Handle memberships update
    if (planId && startDate && endDate) {
      // Find existing ACTIVE membership
      const activeSub = await prisma.membership.findFirst({
        where: { memberId, status: "ACTIVE" }
      });

      if (activeSub) {
        await prisma.membership.update({
          where: { id: activeSub.id },
          data: {
            planId,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
          }
        });
      } else {
        await prisma.membership.create({
          data: {
            gymId: gym.id,
            memberId,
            planId,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            status: "ACTIVE"
          }
        });
      }
    } else if (!planId) {
      // If "No Active Plan" was chosen, cancel active subscriptions if any exist
      await prisma.membership.updateMany({
        where: { memberId, status: "ACTIVE" },
        data: { status: "CANCELLED" }
      });
    }

    await prisma.auditLog.create({
      data: {
        action: "MEMBER_UPDATE",
        details: `Updated member ${name} (${formattedPhone})`,
        gymId: gym.id,
        userId: req.user?.userId || null,
      },
    });

    res.json({ success: true, member });
  } catch (err) {
    console.error("❌ [Members PUT] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * =====================================
 * DELETE A MEMBER
 * =====================================
 */
router.delete("/:memberId", async (req, res) => {
  try {
    const { gymSlug, memberId } = req.params;

    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
    });

    if (!gym) {
      return res.status(404).json({ error: "Gym not found" });
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member || member.gymId !== gym.id) {
      return res.status(404).json({ error: "Member not found" });
    }

    await prisma.member.delete({
      where: { id: memberId },
    });

    await prisma.auditLog.create({
      data: {
        action: "MEMBER_DELETE",
        details: `Deleted member ${member.memberName || ''} (${member.phone})`,
        gymId: gym.id,
        userId: req.user?.userId || null,
      },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("❌ [Members DELETE] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
