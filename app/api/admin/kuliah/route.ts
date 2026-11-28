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

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isAuthorized(session.user.email)) {
    return NextResponse.json({ error: "Forbidden: Akses khusus Dosen/Admin" }, { status: 403 })
  }

  try {
    const courses = await prisma.kuliah.findMany({
      include: {
        nilai: {
          select: {
            idnilai: true,
            judulkriteria: true,
            kriteria: true,
            bobot: true,
            nrp: true,
            grade: true,
          },
          orderBy: { idnilai: "asc" },
        },
        groups: {
          select: {
            id: true,
            nrp: true,
            group_id: true,
          },
        },
        submissions: {
          select: {
            id: true,
            nrp: true,
          },
        },
      },
      orderBy: { idkuliah: "desc" },
    })

    const result = courses.map((c) => {
      // Extract unique criteria definitions for this course
      const criteriaMap = new Map<string, { judulkriteria: string; kriteria: string; bobot: number; minIdnilai: number }>()
      for (const n of c.nilai) {
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
      const totalBobot = criteriaList.reduce((sum, item) => sum + (item.bobot || 0), 0)

      // Count unique enrolled students
      const studentNrps = new Set<string>()
      for (const n of c.nilai) {
        if (n.nrp) studentNrps.add(n.nrp)
      }
      for (const g of c.groups) {
        if (g.nrp) studentNrps.add(g.nrp)
      }

      return {
        idkuliah: c.idkuliah,
        matkul: c.matkul ?? "Untitled",
        tahun: c.tahun ?? "—",
        kunci_jawaban: c.kunci_jawaban ?? null,
        is_published: c.is_published ?? false,
        criteriaList,
        totalBobot,
        totalCriteria: criteriaList.length,
        studentCount: studentNrps.size,
        groupCount: new Set(c.groups.map((g) => g.group_id).filter(Boolean)).size,
        submissionCount: c.submissions.length,
      }
    })

    return NextResponse.json({ courses: result })
  } catch (error) {
    console.error("Error fetching courses:", error)
    return NextResponse.json({ error: "Gagal mengambil data kuliah" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isAuthorized(session.user.email)) {
    return NextResponse.json({ error: "Forbidden: Akses khusus Dosen/Admin" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { matkul, tahun, kunci_jawaban, is_published } = body

    // 1. Validate Course metadata
    if (!matkul || typeof matkul !== "string" || !matkul.trim()) {
      return NextResponse.json({ error: "Nama mata kuliah wajib diisi" }, { status: 400 })
    }
    if (!tahun || typeof tahun !== "string" || !tahun.trim()) {
      return NextResponse.json({ error: "Tahun / semester akademik wajib diisi" }, { status: 400 })
    }

    // 2. Create Course in DB (without creating nilai or student_final_grades records)
    const newKuliah = await prisma.kuliah.create({
      data: {
        matkul: matkul.trim(),
        tahun: tahun.trim(),
        kunci_jawaban: typeof kunci_jawaban === "string" && kunci_jawaban.trim() ? kunci_jawaban.trim() : null,
        is_published: typeof is_published === "boolean" ? is_published : false,
      },
    })

    return NextResponse.json(
      {
        message: "Mata kuliah berhasil dibuat",
        kuliah: {
          idkuliah: newKuliah.idkuliah,
          matkul: newKuliah.matkul,
          tahun: newKuliah.tahun,
          is_published: newKuliah.is_published,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating course:", error)
    return NextResponse.json({ error: "Terjadi kesalahan internal saat membuat kuliah" }, { status: 500 })
  }
}
