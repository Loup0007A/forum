import nodemailer from 'nodemailer';
import { logger } from './logger';

function createTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendRegistrationNotification(userData: {
  username: string;
  email: string;
  age?: number;
  country?: string;
  ip: string;
  country_ip: string;
}) {
  const transporter = createTransporter();
  if (!transporter) {
    logger.warn('Email non envoyé — SMTP non configuré');
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.NOTIFY_EMAIL,
      subject: `🔔 Nouvelle inscription — ${userData.username}`,
      html: `
        <div style="font-family: monospace; max-width: 600px; padding: 24px; background: #0f0f0f; color: #e0e0e0; border-radius: 8px;">
          <h2 style="color: #c084fc;">Nouvelle inscription en attente de validation</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; color: #a0a0a0;">Pseudo</td><td style="padding: 8px; color: #fff;">${userData.username}</td></tr>
            <tr><td style="padding: 8px; color: #a0a0a0;">Email</td><td style="padding: 8px; color: #fff;">${userData.email}</td></tr>
            <tr><td style="padding: 8px; color: #a0a0a0;">Âge</td><td style="padding: 8px; color: #fff;">${userData.age || 'Non renseigné'}</td></tr>
            <tr><td style="padding: 8px; color: #a0a0a0;">Pays</td><td style="padding: 8px; color: #fff;">${userData.country || 'Non renseigné'}</td></tr>
            <tr><td style="padding: 8px; color: #a0a0a0;">IP</td><td style="padding: 8px; color: #fff;">${userData.ip}</td></tr>
            <tr><td style="padding: 8px; color: #a0a0a0;">Pays IP</td><td style="padding: 8px; color: #fff;">${userData.country_ip}</td></tr>
            <tr><td style="padding: 8px; color: #a0a0a0;">Date</td><td style="padding: 8px; color: #fff;">${new Date().toLocaleString('fr-FR')}</td></tr>
          </table>
          <p style="margin-top: 24px; color: #a0a0a0;">Connectez-vous au panneau admin pour valider ce compte.</p>
        </div>
      `,
    });
    logger.info(`Email de notification envoyé pour ${userData.username}`);
  } catch (error) {
    logger.error('Erreur envoi email:', error);
  }
}

export async function sendWelcomeEmail(email: string, username: string) {
  const transporter = createTransporter();
  if (!transporter) return;
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: '✅ Votre compte a été validé — Bienvenue !',
      html: `
        <div style="font-family: monospace; max-width: 600px; padding: 24px; background: #0f0f0f; color: #e0e0e0; border-radius: 8px;">
          <h2 style="color: #4ade80;">Bienvenue ${username} !</h2>
          <p>Votre compte a été validé par l'administrateur. Vous pouvez maintenant vous connecter.</p>
        </div>
      `,
    });
  } catch (error) {
    logger.error('Erreur envoi email de bienvenue:', error);
  }
}

export async function sendBanNotification(email: string, username: string, reason: string, expiresAt?: Date) {
  const transporter = createTransporter();
  if (!transporter) return;
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: '⛔ Votre compte a été suspendu',
      html: `
        <div style="font-family: monospace; max-width: 600px; padding: 24px; background: #0f0f0f; color: #e0e0e0; border-radius: 8px;">
          <h2 style="color: #f87171;">Compte suspendu — ${username}</h2>
          <p><strong>Raison :</strong> ${reason}</p>
          ${expiresAt ? `<p><strong>Expiration :</strong> ${expiresAt.toLocaleString('fr-FR')}</p>` : '<p>Suspension permanente.</p>'}
        </div>
      `,
    });
  } catch (error) {
    logger.error('Erreur envoi email de ban:', error);
  }
}
