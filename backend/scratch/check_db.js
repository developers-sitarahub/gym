import prisma from "../src/prisma.js";

async function main() {
  try {
    const gyms = await prisma.gym.findMany({
      include: {
        users: true,
      },
    });

    console.log("=== REGISTERED GYMS ===");
    if (gyms.length === 0) {
      console.log("No gyms registered yet. You should register a new gym!");
    } else {
      gyms.forEach((gym) => {
        console.log(`- Gym Name: ${gym.name}`);
        console.log(`  Slug: ${gym.slug}`);
        console.log(`  URL: http://localhost:3000/dashboard/${gym.slug}`);
        console.log(`  Users:`);
        gym.users.forEach((u) => {
          console.log(`    * ${u.name} (${u.email}) [Role: ${u.role}]`);
        });
        console.log("------------------------");
      });
    }
  } catch (err) {
    console.error("DB Query failed:", err);
  } finally {
    process.exit(0);
  }
}

main();
