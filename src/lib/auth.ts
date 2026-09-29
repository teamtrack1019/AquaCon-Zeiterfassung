import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { createUser, findUserByUsername, updateUser } from "@/lib/db";

async function ensureBootstrapAdmin() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return;

  const existing = await findUserByUsername(username);
  const hashed = await bcrypt.hash(password, 10);

  if (!existing) {
    await createUser({
      username,
      password: hashed,
      role: "ADMIN",
    });
    return;
  }

  // Keep Admin password aligned with Vercel ADMIN_PASSWORD
  const stillValid = await verifyPassword(password, existing.password);
  if (!stillValid) {
    await updateUser(existing.id, { password: hashed });
  }
}

async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (stored.startsWith("$2a$") || stored.startsWith("$2b$")) {
    return bcrypt.compare(plain, stored).catch(() => false);
  }
  return plain === stored;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        try {
          await ensureBootstrapAdmin();

          const user = await findUserByUsername(credentials.username);
          if (!user) return null;

          const isValid = await verifyPassword(credentials.password, user.password);
          if (!isValid) return null;

          if (!user.password.startsWith("$2a$") && !user.password.startsWith("$2b$")) {
            await updateUser(user.id, {
              password: await bcrypt.hash(credentials.password, 10),
            });
          }

          return { id: user.id, name: user.username, role: user.role };
        } catch (err) {
          console.error("[auth] login failed:", err);
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/",
  },
  session: {
    strategy: "jwt",
    maxAge: 365 * 24 * 60 * 60,
  },
  jwt: {
    maxAge: 365 * 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as { id?: string; role?: string }).id = token.sub;
        (session.user as { id?: string; role?: string }).role = token.role as string;
      }
      return session;
    },
  },
};
