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

    const course = await prisma.kuliah.findUnique({
      where: { idkuliah },
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
        submissions: true,
      },
    })

    if (!course) {
      return NextResponse.json({ error: "Kuliah tidak ditemukan" }, { status: 404 })
    }

    // Extract unique criteria
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
    const totalBobot = criteriaList.reduce((sum, item) => sum + (item.bobot || 0), 0)

    // Enrolled student NRPs
    const studentNrps = Array.from(
      new Set([
        ...course.nilai.map((n) => n.nrp).filter(Boolean),
        ...course.groups.map((g) => g.nrp).filter(Boolean),
      ])
    ) as string[]

    const studentDetails = await prisma.userNilai.findMany({
      where: { nrp: { in: studentNrps } },
      select: { nrp: true, nama: true, email: true },
    })

    return NextResponse.json({
      course: {
        idkuliah: course.idkuliah,
        matkul: course.matkul,
        tahun: course.tahun,
        criteriaList,
        totalBobot,
        students: studentDetails,
        groups: course.groups,
        submissionsCount: course.submissions.length,
      },
    })
  } catch (error) {
    console.error("Error fetching course detail:", error)
    return NextResponse.json({ error: "Gagal memuat detail kuliah" }, { status: 500 })
  }
}

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
    const { matkul, tahun, kriteriaList } = body

    if (!matkul || !matkul.trim()) {
      return NextResponse.json({ error: "Nama mata kuliah wajib diisi" }, { status: 400 })
    }
    if (!tahun || !tahun.trim()) {
      return NextResponse.json({ error: "Tahun akademik wajib diisi" }, { status: 400 })
    }
    if (!Array.isArray(kriteriaList) || kriteriaList.length === 0) {
      return NextResponse.json({ error: "Minimal 1 kriteria penilaian harus ada" }, { status: 400 })
    }

    let calculatedTotalBobot = 0
    const cleanKriteriaList: { judulkriteria: string; kriteria: string; bobot: number }[] = []

    for (let i = 0; i < kriteriaList.length; i++) {
      const k = kriteriaList[i]
      const judul = k.judulkriteria?.toString().trim()
      const desc = k.kriteria?.toString().trim()
      const bobotNum = parseInt(k.bobot, 10)

      if (!judul) {
        return NextResponse.json({ error: `Judul kriteria pada baris ke-${i + 1} wajib diisi` }, { status: 400 })
      }
      if (!desc) {
        return NextResponse.json({ error: `Deskripsi kriteria "${judul}" wajib diisi` }, { status: 400 })
      }
      if (isNaN(bobotNum) || bobotNum <= 0) {
        return NextResponse.json({ error: `Bobot "${judul}" harus berupa angka positif` }, { status: 400 })
      }

      calculatedTotalBobot += bobotNum
      cleanKriteriaList.push({
        judulkriteria: judul,
        kriteria: desc,
        bobot: bobotNum,
      })
    }

    // STRICT 100% CHECK
    if (calculatedTotalBobot !== 100) {
      return NextResponse.json(
        {
          error: `Total keseluruhan bobot harus tepat 100%. Saat ini akumulasi bobot adalah ${calculatedTotalBobot}%.`,
          currentTotal: calculatedTotalBobot,
        },
        { status: 400 }
      )
    }

    // Update Kuliah
    const updated = await prisma.kuliah.update({
      where: { idkuliah },
      data: {
        matkul: matkul.trim(),
        tahun: tahun.trim(),
      },
    })

    // Get current enrolled students
    const currentNilai = await prisma.nilai.findMany({
      where: { idkuliah },
      select: { nrp: true },
      distinct: ["nrp"],
    })
    const existingNrps = currentNilai.map((n) => n.nrp).filter(Boolean) as string[]

    // Delete existing nilai entries and recreate with new criteria
    await prisma.nilai.deleteMany({
      where: { idkuliah },
    })

    if (existingNrps.length > 0) {
      const newNilaiData = []
      for (const nrp of existingNrps) {
        for (const crit of cleanKriteriaList) {
          newNilaiData.push({
            idkuliah,
            nrp,
            judulkriteria: crit.judulkriteria,
            kriteria: crit.kriteria,
            bobot: crit.bobot,
            grade: null,
          })
        }
      }
      await prisma.nilai.createMany({ data: newNilaiData })
    } else {
      const templateNilai = cleanKriteriaList.map((crit) => ({
        idkuliah,
        nrp: null,
        judulkriteria: crit.judulkriteria,
        kriteria: crit.kriteria,
        bobot: crit.bobot,
        grade: null,
      }))
      await prisma.nilai.createMany({ data: templateNilai })
    }

    return NextResponse.json({
      message: "Kuliah berhasil diperbarui",
      kuliah: updated,
    })
  } catch (error) {
    console.error("Error updating course:", error)
    return NextResponse.json({ error: "Gagal memperbarui kuliah" }, { status: 500 })
  }
}

export async function DELETE(
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

    // Delete child records first to satisfy DB constraints
    await prisma.nilai.deleteMany({ where: { idkuliah } })
    await prisma.group.deleteMany({ where: { idkuliah } })
    await prisma.submission.deleteMany({ where: { idkuliah } })
    await prisma.evaluations.deleteMany({ where: { idkuliah } })
    await prisma.courseGradeWeights.deleteMany({ where: { idkuliah } })
    await prisma.studentFinalGrade.deleteMany({ where: { idkuliah } })

    // Delete the course
    await prisma.kuliah.delete({
      where: { idkuliah },
    })

    return NextResponse.json({ message: "Kuliah berhasil dihapus" })
  } catch (error) {
    console.error("Error deleting course:", error)
    return NextResponse.json({ error: "Gagal menghapus kuliah" }, { status: 500 })
  }
}
