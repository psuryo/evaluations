import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/app/src/lib/prisma"
import { generateExcelBuffer } from "@/app/src/lib/excelGradeUtils"

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

function isAuthorized(email?: string | null): boolean {
  if (!email) return false
  if (!ADMIN_EMAIL) return true
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ idkuliah: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isAuthorized(session.user.email)) {
    return NextResponse.json({ error: "Forbidden: Akses khusus Dosen/Admin" }, { status: 403 })
  }

  try {
    const { idkuliah: idStr } = await params
    const idkuliah = parseInt(idStr, 10)
    if (isNaN(idkuliah)) {
      return NextResponse.json({ error: "ID Kuliah tidak valid" }, { status: 400 })
    }

    const course = await prisma.kuliah.findUnique({
      where: { idkuliah },
      include: {
        nilai: {
          include: {
            usernilai: { select: { nama: true, email: true } },
          },
          orderBy: [{ idnilai: "asc" }],
        },
      },
    })

    if (!course) {
      return NextResponse.json({ error: "Kuliah tidak ditemukan" }, { status: 404 })
    }

    // Extract unique criteria definitions
    const criteriaMap = new Map<string, { judulkriteria: string; kriteria: string; bobot: number; minIdnilai: number }>()
    for (const n of course.nilai) {
      if (!n.judulkriteria) continue
      const existing = criteriaMap.get(n.judulkriteria)
      if (!existing) {
        criteriaMap.set(n.judulkriteria, {
          judulkriteria: n.judulkriteria,
          kriteria: n.kriteria ?? "",
          bobot: n.bobot ?? 0,
          minIdnilai: n.idnilai,
        })
      } else {
        if (n.idnilai < existing.minIdnilai) {
          existing.minIdnilai = n.idnilai
        }
      }
    }
    const criteriaList = Array.from(criteriaMap.values())
      .sort((a, b) => {
        if (a.minIdnilai !== b.minIdnilai) {
          return a.minIdnilai - b.minIdnilai
        }
        return a.judulkriteria.localeCompare(b.judulkriteria, undefined, { numeric: true, sensitivity: "base" })
      })
      .map(({ judulkriteria, kriteria, bobot }) => ({ judulkriteria, kriteria, bobot }))

    // Group student records
    const studentMap = new Map<
      string,
      {
        nrp: string
        nama: string
        email: string
        grades: Record<string, { grade: number | null; kriteria?: string | null }>
      }
    >()

    for (const n of course.nilai) {
      if (!n.nrp) continue
      if (!studentMap.has(n.nrp)) {
        studentMap.set(n.nrp, {
          nrp: n.nrp,
          nama: n.usernilai?.nama ?? n.nrp,
          email: n.usernilai?.email ?? "",
          grades: {},
        })
      }
      if (n.judulkriteria) {
        studentMap.get(n.nrp)!.grades[n.judulkriteria] = {
          grade: n.grade !== null ? Number(n.grade) : null,
          kriteria: n.kriteria,
        }
      }
    }

    const students = Array.from(studentMap.values()).sort((a, b) =>
      a.nrp.localeCompare(b.nrp, undefined, { numeric: true })
    )

    const buffer = generateExcelBuffer({
      matkul: course.matkul ?? `Kuliah_${idkuliah}`,
      tahun: course.tahun ?? "",
      criteriaList,
      students,
    })

    const safeMatkul = (course.matkul ?? "Kuliah").replace(/[^a-zA-Z0-9_-]/g, "_")
    const safeTahun = (course.tahun ?? "").replace(/[^a-zA-Z0-9_-]/g, "_")
    const fileName = `Template_Nilai_${safeMatkul}${safeTahun ? "_" + safeTahun : ""}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("Error generating excel template:", error)
    return NextResponse.json({ error: "Gagal membuat template Excel" }, { status: 500 })
  }
}
