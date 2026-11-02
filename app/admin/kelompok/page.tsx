import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import KelompokShell from "./KelompokShell"
import KelompokList from "./KelompokList"

export const metadata = { title: "Penilaian Kelompok | evaluations" }

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

export default async function KelompokPage() {
  const session = await getServerSession()
  if (!session?.user?.email) redirect("/login")
  if (ADMIN_EMAIL && session.user.email !== ADMIN_EMAIL) redirect("/dashboard")

  return (
    <KelompokShell email={session.user.email}>
      <KelompokList />
    </KelompokShell>
  )
}
