import prisma from './src/prisma.js';

async function main() {
  const users = await prisma.gymUser.findMany({
    include: {
      gym: true
    }
  });
  console.log("USERS IN DB:", users);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
