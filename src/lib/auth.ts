import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

async function ensureBootstrapAdmin() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return;

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return;

  await prisma.user.create({
    data: {
      username,
      password: await bcrypt.hash(password, 10),
      role: "ADMIN",
    },
  });
}

async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (stored.startsWith("$2a$") || stored.startsWith("$2b$")) {
    return bcrypt.compare(plain, stored).catch(() => false);
  }
  // Legacy plaintext support (migrate on successful login)
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

        await ensureBootstrapAdmin();

        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
        });

        if (!user) return null;

        const isValid = await verifyPassword(credentials.password, user.password);
        if (!isValid) return null;

        // Upgrade legacy plaintext passwords to bcrypt after successful login
        if (!user.password.startsWith("$2a$") && !user.password.startsWith("$2b$")) {
          await prisma.user.update({
            where: { id: user.id },
            data: { password: await bcrypt.hash(credentials.password, 10) },
          });
        }

        return { id: user.id.toString(), name: user.username, role: user.role };
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
