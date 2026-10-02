import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/app/src/lib/prisma"

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
          orderBy: [{ nrp: "asc" }, { idnilai: "asc" }],
        },
      },
    })

    if (!course) {
      return NextResponse.json({ error: "Kuliah tidak ditemukan" }, { status: 404 })
    }

    // Extract unique criteria definitions
    const criteriaMap = new Map<string, { judulkriteria: string; kriteria: string; bobot: number }>()
    for (const n of course.nilai) {
      if (!n.judulkriteria) continue
      const key = `${n.judulkriteria}:::${n.kriteria ?? ""}`
      if (!criteriaMap.has(key)) {
        criteriaMap.set(key, {
          judulkriteria: n.judulkriteria,
          kriteria: n.kriteria ?? "",
          bobot: n.bobot ?? 0,
        })
      }
    }
    const criteriaList = Array.from(criteriaMap.values())

    // Group student grades
    const studentMap = new Map<
      string,
      {
        nrp: string
        nama: string
        email: string
        grades: Record<string, { idnilai: number; grade: number | null; bobot: number }>
      }
    >()

    for (const n of course.nilai) {
      if (!n.nrp) continue
      if (!studentMap.has(n.nrp)) {
        studentMap.set(n.nrp, {
          nrp: n.nrp,
          nama: n.usernilai?.nama ?? n.nrp,
          email: n.usernilai?.email ?? "—",
          grades: {},
        })
      }

      if (n.judulkriteria) {
        studentMap.get(n.nrp)!.grades[n.judulkriteria] = {
          idnilai: n.idnilai,
          grade: n.grade !== null ? Number(n.grade) : null,
          bobot: n.bobot ?? 0,
        }
      }
    }

    const students = Array.from(studentMap.values())

    return NextResponse.json({
      course: {
        idkuliah: course.idkuliah,
        matkul: course.matkul,
        tahun: course.tahun,
      },
      criteriaList,
      students,
    })
  } catch (error) {
    console.error("Error fetching course grades:", error)
    return NextResponse.json({ error: "Gagal mengambil data nilai kuliah" }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ idkuliah: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isAuthorized(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const { idkuliah: idStr } = await params
    const idkuliah = parseInt(idStr, 10)
    if (isNaN(idkuliah)) {
      return NextResponse.json({ error: "ID Kuliah tidak valid" }, { status: 400 })
    }

    const body = await req.json()
    const { updates } = body // updates: Array<{ idnilai: number, grade: number | null }>

    if (!Array.isArray(updates)) {
      return NextResponse.json({ error: "Payload updates harus berupa array" }, { status: 400 })
    }

    // Execute bulk update
    await Promise.all(
      updates.map((u) =>
        prisma.nilai.update({
          where: { idnilai: u.idnilai },
          data: {
            grade: u.grade !== null && u.grade !== "" && !isNaN(Number(u.grade)) ? Number(u.grade) : null,
          },
        })
      )
    )

    return NextResponse.json({ message: "Nilai berhasil disimpan", count: updates.length })
  } catch (error) {
    console.error("Error saving grades:", error)
    return NextResponse.json({ error: "Gagal menyimpan nilai mahasiswa" }, { status: 500 })
  }
}

// Enroll new students into this course
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ idkuliah: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isAuthorized(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const { idkuliah: idStr } = await params
    const idkuliah = parseInt(idStr, 10)
    if (isNaN(idkuliah)) {
      return NextResponse.json({ error: "ID Kuliah tidak valid" }, { status: 400 })
    }

    const body = await req.json()
    const { nrps } = body // Array of strings or comma-separated

    let cleanNrps: string[] = []
    if (Array.isArray(nrps)) {
      cleanNrps = Array.from(new Set(nrps.map((s: string) => String(s).trim()).filter(Boolean)))
    } else if (typeof nrps === "string") {
      cleanNrps = Array.from(
        new Set(
          nrps
            .split(/[\n,;]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        )
      )
    }

    if (cleanNrps.length === 0) {
      return NextResponse.json({ error: "Daftar NRP tidak boleh kosong" }, { status: 400 })
    }

    // Get current criteria of this course
    const existingNilai = await prisma.nilai.findMany({
      where: { idkuliah },
    })

    const criteriaMap = new Map<string, { judulkriteria: string; kriteria: string; bobot: number }>()
    for (const n of existingNilai) {
      if (!n.judulkriteria) continue
      const key = `${n.judulkriteria}:::${n.kriteria ?? ""}`
      if (!criteriaMap.has(key)) {
        criteriaMap.set(key, {
          judulkriteria: n.judulkriteria,
          kriteria: n.kriteria ?? "",
          bobot: n.bobot ?? 0,
        })
      }
    }
    const criteriaList = Array.from(criteriaMap.values())

    if (criteriaList.length === 0) {
      return NextResponse.json({ error: "Kuliah ini belum memiliki kriteria penilaian" }, { status: 400 })
    }

    // Existing student NRPs
    const existingStudentNrps = new Set(existingNilai.map((n) => n.nrp).filter(Boolean))

    const newNilaiRecords = []
    for (const nrp of cleanNrps) {
      if (existingStudentNrps.has(nrp)) continue // Skip already enrolled
      for (const crit of criteriaList) {
        newNilaiRecords.push({
          idkuliah,
          nrp,
          judulkriteria: crit.judulkriteria,
          kriteria: crit.kriteria,
          bobot: crit.bobot,
          grade: null,
        })
      }
    }

    if (newNilaiRecords.length > 0) {
      await prisma.nilai.createMany({
        data: newNilaiRecords,
      })

      // Clean up template record (nrp: null) if students are now present
      await prisma.nilai.deleteMany({
        where: { idkuliah, nrp: null },
      })
    }

    return NextResponse.json({
      message: `${cleanNrps.length} mahasiswa berhasil ditambahkan ke mata kuliah`,
      enrolledCount: cleanNrps.length,
    })
  } catch (error) {
    console.error("Error enrolling students:", error)
    return NextResponse.json({ error: "Gagal mendaftarkan mahasiswa" }, { status: 500 })
  }
}
