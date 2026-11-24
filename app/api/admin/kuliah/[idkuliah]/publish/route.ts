import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/src/lib/auth"
import { prisma } from "@/app/src/lib/prisma"

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

function isAuthorized(email?: string | null): boolean {
  if (!email) return false
  if (!ADMIN_EMAIL) return true
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
}

async function handlePublishToggle(
  req: NextRequest,
  paramsPromise: Promise<{ idkuliah: string }>
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isAuthorized(session.user.email)) {
    return NextResponse.json({ error: "Forbidden: Akses khusus Dosen/Admin" }, { status: 403 })
  }

  try {
    const { idkuliah: idStr } = await paramsPromise
    const idkuliah = parseInt(idStr, 10)
    if (isNaN(idkuliah)) {
      return NextResponse.json({ error: "ID Kuliah tidak valid" }, { status: 400 })
    }

    const course = await prisma.kuliah.findUnique({
      where: { idkuliah },
      select: { idkuliah: true, matkul: true, is_published: true },
    })

    if (!course) {
      return NextResponse.json({ error: "Mata kuliah tidak ditemukan" }, { status: 404 })
    }

    let targetStatus: boolean
    const body = await req.json().catch(() => null)
    if (body && typeof body.is_published === "boolean") {
      targetStatus = body.is_published
    } else {
      // Toggle if not explicitly specified
      targetStatus = !course.is_published
    }

    const updated = await prisma.kuliah.update({
      where: { idkuliah },
      data: { is_published: targetStatus },
      select: { idkuliah: true, matkul: true, is_published: true },
    })

    return NextResponse.json({
      success: true,
      idkuliah: updated.idkuliah,
      is_published: updated.is_published,
      message: updated.is_published
        ? `Nilai mata kuliah "${updated.matkul}" berhasil dipublikasikan. Sekarang mahasiswa dapat melihat nilai mereka.`
        : `Publikasi nilai mata kuliah "${updated.matkul}" berhasil ditarik. Nilai disembunyikan dari mahasiswa.`,
    })
  } catch (error) {
    console.error("Error toggling course publish status:", error)
    return NextResponse.json(
      { error: "Gagal memperbarui status publikasi nilai kuliah" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ idkuliah: string }> }
) {
  return handlePublishToggle(req, params)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ idkuliah: string }> }
) {
  return handlePublishToggle(req, params)
}
