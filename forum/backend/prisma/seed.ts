import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Initialisation de la base de données...');

  const adminEmail = process.env.ADMIN_EMAIL || 'lr000000007@gmail.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeThisNow!2024Lr007@A*';
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';

  const passwordHash = await argon2.hash(adminPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  // Utilisation de upsert pour créer ou mettre à jour
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      username: adminUsername,
      passwordHash: passwordHash, // Met à jour le mot de passe si on relance le seed
      status: 'ACTIVE',           // S'assure que l'admin n'est pas en PENDING
      role: 'ADMIN',
    },
    create: {
      email: adminEmail,
      username: adminUsername,
      passwordHash: passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      rank: 'Légende',
      points: 9999,
      bio: 'Administrateur du forum.',
    },
  });

  // Initialisation des badges
  await prisma.badge.createMany({
    data: [
      { name: 'Fondateur',    description: 'Membre fondateur du forum',            icon: '👑', color: '#FFD700' },
      { name: 'Vétéran',      description: "Plus d'un an sur le forum",            icon: '🎖️', color: '#C0C0C0' },
      { name: 'Contributeur', description: 'Plus de 100 messages',                 icon: '✍️', color: '#CD7F32' },
      { name: 'Expert',       description: 'Plus de 500 messages',                 icon: '🏆', color: '#FFD700' },
      { name: 'Légende',      description: 'Plus de 1000 messages',                icon: '⭐', color: '#FF4500' },
      { name: 'Modérateur',   description: "Membre de l'équipe de modération",     icon: '🛡️', color: '#4169E1' },
    ],
    skipDuplicates: true,
  });

  const founderBadge = await prisma.badge.findUnique({ where: { name: 'Fondateur' } });
  if (founderBadge) {
    // On utilise upsert ici aussi pour éviter de doubler le badge à chaque déploiement
    await prisma.userBadge.upsert({
      where: {
        userId_badgeId: { userId: admin.id, badgeId: founderBadge.id }
      },
      update: {},
      create: { userId: admin.id, badgeId: founderBadge.id }
    }).catch(() => {});
  }

  console.log(`✅ Admin configuré (Email: ${admin.email})`);
  console.log(`🔑 Statut: ${admin.status}`);
}

main()
  .catch(e => {
    console.error('❌ Erreur seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
