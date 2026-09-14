import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        if (!credentials?.username || !credentials?.password) return null;
        
        let user = await prisma.user.findUnique({
          where: { username: credentials.username }
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              username: credentials.username,
              password: credentials.password,
              role: credentials.username.toLowerCase() === 'admin' ? 'ADMIN' : 'WORKER'
            }
          });
          return { id: user.id.toString(), name: user.username, role: user.role };
        }

        let isValid = false;
        if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
           isValid = await bcrypt.compare(credentials.password, user.password).catch(() => false);
        } else {
           isValid = credentials.password === user.password;
        }

        if (isValid) {
          return { id: user.id.toString(), name: user.username, role: user.role };
        }
        return null;
      }
    })
  ],
  pages: {
    signIn: '/',
  },
  session: {
    strategy: "jwt",
    maxAge: 365 * 24 * 60 * 60, // 365 days persistent session
  },
  jwt: {
    maxAge: 365 * 24 * 60 * 60, // 365 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
      }
      return session;
    }
  }
}
