import type { Request, Response } from 'express';
import argon2 from 'argon2';
import { rateLimit } from 'express-rate-limit';
import validator from 'validator';
import { prisma } from '../utils/prisma.js';
import { createSession, invalidateSession, invalidateAllSessions } from '../utils/jwt.js';
import { extractRequestMeta, getClientIp, generateFingerprint } from '../utils/geo.js';
import { sendRegistrationNotification } from '../utils/email.js';
import { logger } from '../utils/logger.js';

const MAX_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '3');
const BAN_DURATION_MS = parseInt(process.env.BAN_DURATION_MINUTES || '60') * 60 * 1000;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Strict rate limiter for auth routes
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => getClientIp(req),
  message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── VERIFY CAPTCHA ────────────────────────────────────────────────────
async function verifyCaptcha(token: string): Promise<boolean> {
  if (process.env.NODE_ENV === 'development') return true; // skip in dev
  
  try {
    const response = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `response=${token}&secret=${process.env.CAPTCHA_SECRET_KEY}`,
    });
    const data = await response.json() as { success: boolean };
    return data.success;
  } catch {
    return false;
  }
}

// ─── COUNT RECENT FAILED ATTEMPTS ──────────────────────────────────────
async function countRecentFailures(ip: string, fingerprint: string): Promise<number> {
  const since = new Date(Date.now() - ATTEMPT_WINDOW_MS);
  return prisma.loginAttempt.count({
    where: {
      OR: [{ ipAddress: ip }, { fingerprint }],
      success: false,
      createdAt: { gte: since },
    },
  });
}

// ─── BAN IP + FINGERPRINT ──────────────────────────────────────────────
async function banIpAndFingerprint(ip: string, fingerprint: string): Promise<void> {
  const expiresAt = new Date(Date.now() + BAN_DURATION_MS);
  
  await Promise.all([
    prisma.ban.upsert({
      where: { id: `ip-${ip}` },
      create: { id: `ip-${ip}`, type: 'IP', value: ip, expiresAt, reason: 'Trop de tentatives de connexion' },
      update: { expiresAt, reason: 'Trop de tentatives de connexion' },
    }).catch(() => prisma.ban.create({
      data: { type: 'IP', value: ip, expiresAt, reason: 'Trop de tentatives de connexion' }
    })),
    prisma.ban.create({
      data: { type: 'FINGERPRINT', value: fingerprint, expiresAt, reason: 'Trop de tentatives de connexion' }
    }).catch(() => {}),
  ]);

  logger.warn(`BAN automatique — IP: ${ip}, Fingerprint: ${fingerprint}`);
}

// ─── REGISTER ─────────────────────────────────────────────────────────
export async function register(req: Request, res: Response): Promise<void> {
  const {
    username, email, password, age, country,
    acceptRules, acceptPrivacy, captchaToken
  } = req.body;

  const meta = extractRequestMeta(req);

  // Validate inputs
  if (!username || !email || !password) {
    res.status(400).json({ error: 'Tous les champs obligatoires doivent être remplis.' });
    return;
  }

  if (!validator.isEmail(email)) {
    res.status(400).json({ error: 'Adresse email invalide.' });
    return;
  }

  if (username.length < 3 || username.length > 30) {
    res.status(400).json({ error: 'Le pseudo doit faire entre 3 et 30 caractères.' });
    return;
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    res.status(400).json({ error: 'Le pseudo ne peut contenir que des lettres, chiffres, tirets et underscores.' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Le mot de passe doit faire au moins 8 caractères.' });
    return;
  }

  if (!acceptRules || !acceptPrivacy) {
    res.status(400).json({ error: 'Vous devez accepter les règles et la politique de confidentialité.' });
    return;
  }

  // CAPTCHA verification
  if (captchaToken) {
    const captchaValid = await verifyCaptcha(captchaToken);
    if (!captchaValid) {
      res.status(400).json({ error: 'CAPTCHA invalide. Veuillez réessayer.' });
      return;
    }
  }

  // Check if user exists
  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });

  if (existingUser) {
    const field = existingUser.email === email ? 'email' : 'pseudo';
    res.status(409).json({ error: `Cet ${field} est déjà utilisé.` });
    return;
  }

  // Hash password with Argon2id
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,   // 64 MB
    timeCost: 3,
    parallelism: 4,
  });

  // Create user (PENDING status)
  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
      age: age ? parseInt(age) : null,
      country: country || null,
      status: 'PENDING',
    },
  });

  // Log registration
  await prisma.systemLog.create({
    data: {
      userId: user.id,
      action: 'REGISTER',
      ipAddress: meta.ip,
      country: meta.country,
      userAgent: meta.userAgent,
      browser: meta.browser,
      os: meta.os,
      page: '/register',
    },
  });

  // Send notification email to admin
  await sendRegistrationNotification({
    username,
    email,
    age: age ? parseInt(age) : undefined,
    country,
    ip: meta.ip,
    country_ip: meta.country,
  });

  logger.info(`Nouvelle inscription: ${username} (${email}) depuis ${meta.ip}`);

  res.status(201).json({
    message: 'Compte créé avec succès. Un administrateur doit valider votre inscription avant que vous puissiez vous connecter.',
  });
}

// ─── LOGIN ─────────────────────────────────────────────────────────────
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password, captchaToken } = req.body;
  const meta = extractRequestMeta(req);

  if (!email || !password) {
    res.status(400).json({ error: 'Email et mot de passe requis.' });
    return;
  }

  // Check if IP/fingerprint is banned
  const activeBan = await prisma.ban.findFirst({
    where: {
      OR: [
        { type: 'IP', value: meta.ip },
        { type: 'FINGERPRINT', value: meta.fingerprint },
      ],
      OR: [
        { permanent: true },
        { expiresAt: { gt: new Date() } },
      ],
    },
  });

  if (activeBan) {
    logger.warn(`Tentative de connexion depuis IP/fingerprint bannie: ${meta.ip}`);
    res.status(403).json({ 
      error: 'Accès refusé. Votre accès a été révoqué.',
      banned: true 
    });
    return;
  }

  // Count recent failures
  const failures = await countRecentFailures(meta.ip, meta.fingerprint);

  // Require CAPTCHA after 2 failures
  if (failures >= 2) {
    if (!captchaToken) {
      res.status(400).json({ 
        error: 'Trop de tentatives échouées. Veuillez compléter le CAPTCHA.',
        requireCaptcha: true,
        attemptsLeft: Math.max(0, MAX_ATTEMPTS - failures)
      });
      return;
    }
    const captchaValid = await verifyCaptcha(captchaToken);
    if (!captchaValid) {
      res.status(400).json({ error: 'CAPTCHA invalide.', requireCaptcha: true });
      return;
    }
  }

  // Auto-ban after MAX_ATTEMPTS failures
  if (failures >= MAX_ATTEMPTS) {
    await banIpAndFingerprint(meta.ip, meta.fingerprint);
    
    await prisma.systemLog.create({
      data: {
        action: 'LOGIN_FAILED',
        ipAddress: meta.ip,
        country: meta.country,
        userAgent: meta.userAgent,
        browser: meta.browser,
        os: meta.os,
        metadata: { reason: 'auto_ban', attempts: failures },
      },
    });

    res.status(403).json({ 
      error: 'Trop de tentatives échouées. Votre accès a été bloqué temporairement.',
      banned: true
    });
    return;
  }

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
  });

  // Always hash-compare to prevent timing attacks
  const dummyHash = '$argon2id$v=19$m=65536,t=3,p=4$dummy$dummy';
  const hashToVerify = user?.passwordHash || dummyHash;
  const passwordValid = await argon2.verify(hashToVerify, password);

  if (!user || !passwordValid) {
    // Log failed attempt
    await prisma.loginAttempt.create({
      data: {
        ipAddress: meta.ip,
        fingerprint: meta.fingerprint,
        email,
        success: false,
        userAgent: meta.userAgent,
      },
    });

    await prisma.systemLog.create({
      data: {
        action: 'LOGIN_FAILED',
        ipAddress: meta.ip,
        country: meta.country,
        userAgent: meta.userAgent,
        browser: meta.browser,
        os: meta.os,
        metadata: { email, attempt: failures + 1 },
      },
    });

    const newFailures = failures + 1;
    const attemptsLeft = MAX_ATTEMPTS - newFailures;

    if (newFailures >= MAX_ATTEMPTS) {
      await banIpAndFingerprint(meta.ip, meta.fingerprint);
      res.status(403).json({ 
        error: 'Trop de tentatives échouées. Votre accès a été bloqué temporairement.',
        banned: true
      });
      return;
    }

    res.status(401).json({ 
      error: 'Email ou mot de passe incorrect.',
      attemptsLeft,
      requireCaptcha: newFailures >= 2
    });
    return;
  }

  // Check user status
  if (user.status === 'PENDING') {
    res.status(403).json({ error: 'Votre compte est en attente de validation par l\'administrateur.' });
    return;
  }

  if (user.status === 'BANNED') {
    const banInfo = user.banExpiresAt 
      ? `jusqu'au ${user.banExpiresAt.toLocaleString('fr-FR')}`
      : 'définitivement';
    res.status(403).json({ error: `Votre compte a été banni ${banInfo}.` });
    return;
  }

  // Successful login — create session
  const token = await createSession(
    user.id,
    meta.fingerprint,
    meta.ip,
    meta.userAgent
  );

  // Log successful login
  await prisma.loginAttempt.create({
    data: {
      ipAddress: meta.ip,
      fingerprint: meta.fingerprint,
      email,
      success: true,
      userAgent: meta.userAgent,
    },
  });

  await prisma.systemLog.create({
    data: {
      userId: user.id,
      action: 'LOGIN',
      ipAddress: meta.ip,
      country: meta.country,
      userAgent: meta.userAgent,
      browser: meta.browser,
      os: meta.os,
      page: '/login',
    },
  });

  logger.info(`Connexion réussie: ${user.username} depuis ${meta.ip} (${meta.country})`);

  // Set HTTP-only cookie
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      rank: user.rank,
      points: user.points,
      avatarUrl: user.avatarUrl,
    },
  });
}

// ─── LOGOUT ────────────────────────────────────────────────────────────
export async function logout(req: Request, res: Response): Promise<void> {
  if (req.sessionId) {
    await invalidateSession(req.sessionId);
  }

  if (req.user) {
    await prisma.systemLog.create({
      data: {
        userId: req.user.id,
        action: 'LOGOUT',
        ipAddress: req.clientIp,
        page: '/logout',
      },
    }).catch(() => {});
  }

  res.clearCookie('token');
  res.json({ message: 'Déconnecté avec succès.' });
}

// ─── LOGOUT ALL SESSIONS ───────────────────────────────────────────────
export async function logoutAll(req: Request, res: Response): Promise<void> {
  if (req.user) {
    await invalidateAllSessions(req.user.id);
  }
  res.clearCookie('token');
  res.json({ message: 'Toutes les sessions ont été déconnectées.' });
}

// ─── CHECK AUTH STATUS ─────────────────────────────────────────────────
export async function checkAuth(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.token || req.headers.authorization?.slice(7);
  
  if (!token) {
    res.json({ authenticated: false });
    return;
  }

  const { verifyToken } = await import('../utils/jwt.js');
  const payload = verifyToken(token);
  
  if (!payload) {
    res.json({ authenticated: false });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true, username: true, email: true, role: true,
      status: true, rank: true, points: true, avatarUrl: true,
    },
  });

  if (!user || user.status !== 'ACTIVE') {
    res.json({ authenticated: false });
    return;
  }

  res.json({ authenticated: true, user });
}
