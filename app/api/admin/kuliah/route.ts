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
      const criteriaMap = new Map<string, { judulkriteria: string; kriteria: string; bobot: number }>()
      for (const n of c.nilai) {
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
    const { matkul, tahun, kriteriaList, students } = body

    // 1. Validate Course metadata
    if (!matkul || typeof matkul !== "string" || !matkul.trim()) {
      return NextResponse.json({ error: "Nama mata kuliah wajib diisi" }, { status: 400 })
    }
    if (!tahun || typeof tahun !== "string" || !tahun.trim()) {
      return NextResponse.json({ error: "Tahun / semester akademik wajib diisi" }, { status: 400 })
    }

    // 2. Validate Kriteria List
    if (!Array.isArray(kriteriaList) || kriteriaList.length === 0) {
      return NextResponse.json({ error: "Minimal 1 kriteria penilaian harus ditambahkan" }, { status: 400 })
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
        return NextResponse.json({ error: `Bobot untuk kriteria "${judul}" harus berupa angka positif lebih dari 0` }, { status: 400 })
      }

      calculatedTotalBobot += bobotNum
      cleanKriteriaList.push({
        judulkriteria: judul,
        kriteria: desc,
        bobot: bobotNum,
      })
    }

    // 3. STRICT OVERALL BOBOT CONSTRAINT: MUST EQUAL 100
    if (calculatedTotalBobot !== 100) {
      return NextResponse.json(
        {
          error: `Total keseluruhan bobot harus tepat 100%. Saat ini akumulasi bobot adalah ${calculatedTotalBobot}% (${
            calculatedTotalBobot < 100
              ? `kurang ${100 - calculatedTotalBobot}%`
              : `kelebihan ${calculatedTotalBobot - 100}%`
          }).`,
          currentTotal: calculatedTotalBobot,
        },
        { status: 400 }
      )
    }

    // 4. Parse students if provided (NRP array or comma/newline separated string)
    let cleanNrps: string[] = []
    if (Array.isArray(students)) {
      cleanNrps = Array.from(new Set(students.map((s: string) => String(s).trim()).filter(Boolean)))
    } else if (typeof students === "string" && students.trim()) {
      cleanNrps = Array.from(
        new Set(
          students
            .split(/[\n,;]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        )
      )
    }

    // 5. Create Course in DB
    const newKuliah = await prisma.kuliah.create({
      data: {
        matkul: matkul.trim(),
        tahun: tahun.trim(),
      },
    })

    // 6. Create Course Grade Weights entry
    await prisma.courseGradeWeights.upsert({
      where: { idkuliah: newKuliah.idkuliah },
      create: {
        idkuliah: newKuliah.idkuliah,
        mid_assignment_weight: 15,
        mid_exam_weight: 25,
        final_assignment_weight: 20,
        final_exam_weight: 40,
      },
      update: {},
    })

    // 7. Insert Nilai records (for students or template)
    if (cleanNrps.length > 0) {
      const nilaiToInsert: {
        idkuliah: number
        nrp: string
        judulkriteria: string
        kriteria: string
        bobot: number
        grade: null
      }[] = []

      for (const nrp of cleanNrps) {
        for (const crit of cleanKriteriaList) {
          nilaiToInsert.push({
            idkuliah: newKuliah.idkuliah,
            nrp,
            judulkriteria: crit.judulkriteria,
            kriteria: crit.kriteria,
            bobot: crit.bobot,
            grade: null,
          })
        }
      }

      await prisma.nilai.createMany({
        data: nilaiToInsert,
      })
    } else {
      // Insert template definition so kriteria and bobot are recorded for this course
      const templateNilai = cleanKriteriaList.map((crit) => ({
        idkuliah: newKuliah.idkuliah,
        nrp: null,
        judulkriteria: crit.judulkriteria,
        kriteria: crit.kriteria,
        bobot: crit.bobot,
        grade: null,
      }))

      await prisma.nilai.createMany({
        data: templateNilai,
      })
    }

    return NextResponse.json(
      {
        message: "Kuliah berhasil dibuat dengan kriteria dan bobot 100%",
        kuliah: {
          idkuliah: newKuliah.idkuliah,
          matkul: newKuliah.matkul,
          tahun: newKuliah.tahun,
          kriteriaCount: cleanKriteriaList.length,
          totalBobot: calculatedTotalBobot,
          enrolledStudentsCount: cleanNrps.length,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating course:", error)
    return NextResponse.json({ error: "Terjadi kesalahan internal saat membuat kuliah" }, { status: 500 })
  }
}
