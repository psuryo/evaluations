import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import KelompokShell from "../KelompokShell"
import KelompokEditor from "./KelompokEditor"

export const metadata = { title: "Detail Penilaian Kelompok | evaluations" }

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

export default async function KelompokDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession()
  if (!session?.user?.email) redirect("/login")
  if (ADMIN_EMAIL && session.user.email !== ADMIN_EMAIL) redirect("/dashboard")

  const { id } = await params
  const n = parseInt(id, 10)
  if (isNaN(n)) redirect("/admin/kelompok")

  return (
    <KelompokShell email={session.user.email}>
      <KelompokEditor id={n} />
    </KelompokShell>
  )
}
