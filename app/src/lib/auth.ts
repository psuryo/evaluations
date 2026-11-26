import { NextAuthOptions } from "next-auth"
import EmailProvider from "next-auth/providers/email"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/app/src/lib/prisma"
import {
  logLoginFailed,
  logLoginRequested,
  logLoginSuccess,
  logMagicLinkExpired,
  logMagicLinkSent,
  logMagicLinkVerified,
} from "@/app/src/lib/authLog"

const isDev = process.env.NODE_ENV === "development"

const baseAdapter = PrismaAdapter(prisma)
const baseEmailProvider = EmailProvider({
  server: process.env.EMAIL_SERVER!,
  from: process.env.EMAIL_FROM!,
})

export const authOptions: NextAuthOptions = {
  adapter: {
    ...baseAdapter,
    async useVerificationToken(params) {
      const invite = await baseAdapter.useVerificationToken!(params)

      if (!invite) {
        await logLoginFailed({
          email: params.identifier,
          provider: "email",
          reason: "invalid_or_used_token",
        })
        return null
      }

      if (invite.expires.valueOf() < Date.now()) {
        await logMagicLinkExpired({
          email: invite.identifier,
          provider: "email",
          metadata: { expires: invite.expires.toISOString() },
        })
        return invite
      }

      if (params.identifier && invite.identifier !== params.identifier) {
        await logLoginFailed({
          email: params.identifier,
          provider: "email",
          reason: "identifier_mismatch",
          metadata: { tokenIdentifier: invite.identifier },
        })
        return invite
      }

      await logMagicLinkVerified({
        email: invite.identifier,
        provider: "email",
      })

      return invite
    },
  },

  providers: [
    EmailProvider({
      server: process.env.EMAIL_SERVER!,
      from: process.env.EMAIL_FROM!,
      async sendVerificationRequest(params) {
        try {
          await baseEmailProvider.sendVerificationRequest(params)
          await logMagicLinkSent({
            email: params.identifier,
            provider: params.provider.id,
            metadata: { expires: params.expires.toISOString() },
          })
        } catch (error) {
          await logLoginFailed({
            email: params.identifier,
            provider: params.provider.id,
            reason:
              error instanceof Error
                ? error.message
                : "Failed to send magic link email",
          })
          throw error
        }
      },
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
    async signIn({ user, account, email }) {
      if (email?.verificationRequest) {
        await logLoginRequested({
          email: user.email,
          userId: user.id ?? null,
          provider: account?.provider ?? "email",
        })
      }
      return true
    },
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

  events: {
    async signIn({ user, account, isNewUser }) {
      await logLoginSuccess({
        email: user.email,
        userId: user.id ?? null,
        provider: account?.provider ?? null,
        metadata: { isNewUser: Boolean(isNewUser) },
      })
    },
  },

  logger: {
    error(code, metadata) {
      console.error("[next-auth][error]", code, metadata)
      if (code === "SIGNIN_EMAIL_ERROR" || code === "CALLBACK_EMAIL_ERROR") {
        const message =
          metadata instanceof Error
            ? metadata.message
            : typeof metadata === "object" &&
                metadata !== null &&
                "error" in metadata &&
                metadata.error instanceof Error
              ? metadata.error.message
              : code
        void logLoginFailed({
          provider: "email",
          reason: message,
          metadata: { code },
        })
      }
    },
  },
}
