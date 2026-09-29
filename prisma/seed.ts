import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME?.trim() || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin";

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log(`Admin user '${username}' already exists — skip seed.`);
    return;
  }

  await prisma.user.create({
    data: {
      username,
      password: await bcrypt.hash(password, 10),
      role: "ADMIN",
    },
  });

  console.log(`Admin user '${username}' created.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
