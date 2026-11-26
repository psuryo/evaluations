import { Prisma } from "@/generated/prisma"
import { prisma } from "@/app/src/lib/prisma"

export type AuthLogEvent =
  | "login_requested"
  | "magic_link_sent"
  | "magic_link_verified"
  | "login_success"
  | "login_failed"
  | "magic_link_expired"

export interface AuthLogInput {
  event: AuthLogEvent
  email?: string | null
  userId?: string | null
  provider?: string | null
  reason?: string | null
  metadata?: Prisma.InputJsonValue
}

function normalizeEmail(email?: string | null): string | null {
  if (!email) return null
  const trimmed = email.trim().toLowerCase()
  return trimmed || null
}

/**
 * Persists an authentication lifecycle event to the `auth_logs` table.
 * Errors are caught and logged so audit logging never blocks authentication.
 */
export async function logAuthEvent({
  event,
  email,
  userId,
  provider,
  reason,
  metadata,
}: AuthLogInput): Promise<void> {
  try {
    await prisma.authLog.create({
      data: {
        event,
        email: normalizeEmail(email),
        user_id: userId ?? null,
        provider: provider ?? null,
        reason: reason ?? null,
        metadata: metadata ?? Prisma.JsonNull,
      },
    })
  } catch (error) {
    console.error(`[authLog] Failed to record event "${event}":`, error)
  }
}

export async function logLoginRequested(
  params: Omit<AuthLogInput, "event">
): Promise<void> {
  return logAuthEvent({ ...params, event: "login_requested" })
}

export async function logMagicLinkSent(
  params: Omit<AuthLogInput, "event">
): Promise<void> {
  return logAuthEvent({ ...params, event: "magic_link_sent" })
}

export async function logMagicLinkVerified(
  params: Omit<AuthLogInput, "event">
): Promise<void> {
  return logAuthEvent({ ...params, event: "magic_link_verified" })
}

export async function logLoginSuccess(
  params: Omit<AuthLogInput, "event">
): Promise<void> {
  return logAuthEvent({ ...params, event: "login_success" })
}

export async function logLoginFailed(
  params: Omit<AuthLogInput, "event">
): Promise<void> {
  return logAuthEvent({ ...params, event: "login_failed" })
}

export async function logMagicLinkExpired(
  params: Omit<AuthLogInput, "event">
): Promise<void> {
  return logAuthEvent({ ...params, event: "magic_link_expired" })
}
