import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/utils/password";

const prisma = new PrismaClient();

async function main() {
  const password = await hashPassword("Password123");

  const user = await prisma.user.upsert({
    where: { email: "demo@lifeorganizer.dev" },
    update: {},
    create: {
      email: "demo@lifeorganizer.dev",
      username: "demo",
      password,
      name: "Usuario Demo",
    },
  });

  await prisma.event.createMany({
    data: [
      {
        userId: user.id,
        title: "Gimnasio",
        type: "gym",
        startTime: new Date(new Date().setHours(7, 0, 0, 0)),
        endTime: new Date(new Date().setHours(8, 0, 0, 0)),
      },
      {
        userId: user.id,
        title: "Estudio TypeScript",
        type: "study",
        startTime: new Date(new Date().setHours(20, 0, 0, 0)),
        endTime: new Date(new Date().setHours(21, 30, 0, 0)),
      },
    ],
  });

  console.log(`✅ Seed completado. Usuario demo: ${user.email} / Password123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
