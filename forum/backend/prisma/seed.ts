import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Initialisation de la base de données...');

  const existing = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (existing) {
    console.log('⚠️  Un compte admin existe déjà. Seed ignoré.');
    return;
  }

  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeThisNow!2024';
  const passwordHash = await argon2.hash(adminPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const admin = await prisma.user.create({
    data: {
      username: process.env.ADMIN_USERNAME || 'admin',
      email: process.env.ADMIN_EMAIL || 'lr000000007@gmail.com',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      rank: 'Légende',
      points: 9999,
      bio: 'Administrateur du forum.',
    },
  });

  await prisma.badge.createMany({
    data: [
      { name: 'Fondateur',    description: 'Membre fondateur du forum',          icon: '👑', color: '#FFD700' },
      { name: 'Vétéran',      description: "Plus d'un an sur le forum",           icon: '🎖️', color: '#C0C0C0' },
      { name: 'Contributeur', description: 'Plus de 100 messages',                icon: '✍️', color: '#CD7F32' },
      { name: 'Expert',       description: 'Plus de 500 messages',                icon: '🏆', color: '#FFD700' },
      { name: 'Légende',      description: 'Plus de 1000 messages',               icon: '⭐', color: '#FF4500' },
      { name: 'Modérateur',   description: "Membre de l'équipe de modération",    icon: '🛡️', color: '#4169E1' },
    ],
    skipDuplicates: true,
  });

  const founderBadge = await prisma.badge.findUnique({ where: { name: 'Fondateur' } });
  if (founderBadge) {
    await prisma.userBadge.create({ data: { userId: admin.id, badgeId: founderBadge.id } });
  }

  console.log(`✅ Admin créé: ${admin.username}`);
  console.log(`📧 Email: ${admin.email}`);
  console.log(`🔑 Mot de passe: ${adminPassword}`);
  console.log('\n⚠️  CHANGEZ CE MOT DE PASSE IMMÉDIATEMENT !\n');
}

main()
  .catch(e => { console.error('❌ Erreur seed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
