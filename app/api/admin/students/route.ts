import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/app/src/lib/prisma"

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

function isAuthorized(email?: string | null): boolean {
  if (!email) return false
  if (!ADMIN_EMAIL) return true
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isAuthorized(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const students = await prisma.userNilai.findMany({
      select: {
        nrp: true,
        nama: true,
        email: true,
      },
      orderBy: { nrp: "asc" },
    })

    return NextResponse.json({ students })
  } catch (error) {
    console.error("Error fetching students:", error)
    return NextResponse.json({ error: "Gagal mengambil daftar mahasiswa" }, { status: 500 })
  }
}
