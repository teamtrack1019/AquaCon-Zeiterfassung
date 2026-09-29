import bcrypt from "bcryptjs";
import { createUser, findUserByUsername } from "../src/lib/db";

async function main() {
  const username = process.env.ADMIN_USERNAME?.trim() || "Admin";
  const password = process.env.ADMIN_PASSWORD || "change-me";

  const existing = await findUserByUsername(username);
  if (existing) {
    console.log(`Admin '${username}' already exists — skip.`);
    return;
  }

  await createUser({
    username,
    password: await bcrypt.hash(password, 10),
    role: "ADMIN",
  });
  console.log(`Admin '${username}' created in Firestore.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
