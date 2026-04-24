import { cookies } from "next/headers"

export async function getImpersonatedEmail(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get("impersonate")?.value || null
}
