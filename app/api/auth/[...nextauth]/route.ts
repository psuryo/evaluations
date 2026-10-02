import NextAuth, { NextAuthOptions } from "next-auth"
import EmailProvider from "next-auth/providers/email"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/app/src/lib/prisma"

const isDev = process.env.NODE_ENV === "development"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  providers: [
    EmailProvider({
      server: process.env.EMAIL_SERVER!,
      from: process.env.EMAIL_FROM!,
    }),
    ...(isDev
      ? [
          CredentialsProvider({
            id: "dev-login",
            name: "Dev Quick Login",
            credentials: {
              email: { label: "Email", type: "email" },
            },
            async authorize(credentials) {
              if (!credentials?.email) return null
              const email = credentials.email.trim().toLowerCase()

              const user = await prisma.userNilai.findUnique({
                where: { email },
              })

              return {
                id: user?.nrp || email,
                email: email,
                name: user?.nama || email,
              }
            },
          }),
        ]
      : []),
  ],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.email = user.email
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string
      }
      return session
    },
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }