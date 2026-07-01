import { Router } from 'express';
import prisma from '../prisma.js';
import { hashPassword, verifyPassword, signJWT } from '../utils/auth.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { gymName, gymSlug, ownerName, ownerEmail, ownerPassword } = req.body;

    if (!gymName || !ownerName || !ownerEmail || !ownerPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Generate or clean gym slug
    let computedSlug = gymSlug;
    if (!computedSlug) {
      const baseSlug = gymName
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
      
      let finalSlug = baseSlug || 'gym';
      let isUnique = false;
      
      while (!isUnique) {
        const existing = await prisma.gym.findUnique({
          where: { slug: finalSlug },
        });
        if (!existing) {
          isUnique = true;
        } else {
          finalSlug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
        }
      }
      computedSlug = finalSlug;
    } else {
      computedSlug = computedSlug.toLowerCase();
      // Check slug uniqueness
      const existingGym = await prisma.gym.findUnique({
        where: { slug: computedSlug },
      });

      if (existingGym) {
        return res.status(400).json({ error: 'Gym slug already taken' });
      }
    }

    // Check user uniqueness
    const existingUser = await prisma.gymUser.findUnique({
      where: { email: ownerEmail },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Owner email already registered' });
    }

    const passwordHash = hashPassword(ownerPassword);

    // Create Gym, Owner User, ChatbotSettings, PaymentSettings, and default plans in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const gym = await tx.gym.create({
        data: {
          name: gymName,
          slug: computedSlug,
        },
      });

      const user = await tx.gymUser.create({
        data: {
          name: ownerName,
          email: ownerEmail,
          passwordHash,
          role: 'GYM_OWNER',
          gymId: gym.id,
        },
      });

      await tx.chatbotSettings.create({
        data: {
          gymId: gym.id,
          welcomeMessage: `Welcome to ${gymName}!\n\n1. My Membership\n2. Renew Membership\n3. View Plans\n4. Contact Gym\n5. Offers`,
        },
      });

      await tx.paymentSettings.create({
        data: {
          gymId: gym.id,
        },
      });

      // Default plans
      await tx.membershipPlan.createMany({
        data: [
          { name: 'Monthly Basic', price: 999, durationDays: 30, gymId: gym.id, description: 'Access to Gym during normal timings.' },
          { name: 'Quarterly Pro', price: 2499, durationDays: 90, gymId: gym.id, description: 'Save on 3-month subscription.' },
          { name: 'Annual Elite', price: 7999, durationDays: 365, gymId: gym.id, description: 'Full access for 1 year + 2 personal trainer sessions.' },
        ],
      });

      await tx.auditLog.create({
        data: {
          action: 'GYM_REGISTER',
          details: `Gym ${gymName} registered by owner ${ownerName} (${ownerEmail})`,
          gymId: gym.id,
          userId: user.id,
        },
      });

      return { gym, user };
    });

    // Auto log in the user on registration with a long-term 30-day session
    const payload = {
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role,
      gymId: result.user.gymId,
    };
    const token = signJWT(payload, '30d');

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 * 1000, // 7 days in ms
      path: '/',
    });

    return res.status(201).json({
      success: true,
      gym: result.gym,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.gymUser.findUnique({
      where: { email },
      include: { gym: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      gymId: user.gymId,
    };

    const duration = rememberMe ? '30d' : '7d';
    const maxAge = rememberMe 
      ? 60 * 60 * 24 * 30 * 1000  // 30 days
      : 60 * 60 * 24 * 7 * 1000;  // 7 days

    const token = signJWT(payload, duration);

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 * 1000, // 7 days in ms
      path: '/',
    });

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        gym: user.gym ? { id: user.gym.id, name: user.gym.name, slug: user.gym.slug } : null,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('auth_token', { path: '/' });
  if (req.headers['content-type'] === 'application/x-www-form-urlencoded' || req.accepts('html')) {
    return res.redirect('/login');
  }
  return res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.gymUser.findUnique({
      where: { id: req.user.userId },
      include: { gym: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        gym: user.gym ? { id: user.gym.id, name: user.gym.name, slug: user.gym.slug } : null,
      },
    });
  } catch (error) {
    console.error('Me auth checking error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
