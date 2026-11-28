import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/app/src/lib/prisma"
import { requireAdmin } from "@/app/src/lib/adminAuth"

export async function GET() {
  const authError = await requireAdmin()
  if (authError) return authError

  try {
    const availableCourses = await prisma.kuliah.findMany({
      where: {
        nilai: { none: {} },
      },
      select: {
        idkuliah: true,
        matkul: true,
        tahun: true,
      },
      orderBy: [{ tahun: "desc" }, { idkuliah: "desc" }],
    })

    return NextResponse.json({ courses: availableCourses })
  } catch (error) {
    console.error("Error fetching unused kuliah for nilai:", error)
    return NextResponse.json(
      { error: "Gagal mengambil daftar mata kuliah yang tersedia" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const authError = await requireAdmin()
  if (authError) return authError

  try {
    const body = await req.json()
    const idkuliah = Number(body.idkuliah)
    const { kriteriaList, students, kunci_jawaban } = body

    if (!Number.isInteger(idkuliah) || idkuliah <= 0) {
      return NextResponse.json({ error: "Pilih mata kuliah yang valid" }, { status: 400 })
    }

    const [course, existingNilaiCount] = await Promise.all([
      prisma.kuliah.findUnique({
        where: { idkuliah },
        select: { idkuliah: true, matkul: true, tahun: true },
      }),
      prisma.nilai.count({ where: { idkuliah } }),
    ])

    if (!course) {
      return NextResponse.json({ error: "Mata kuliah tidak ditemukan" }, { status: 404 })
    }

    if (existingNilaiCount > 0) {
      return NextResponse.json(
        { error: "Mata kuliah ini sudah digunakan pada tabel nilai" },
        { status: 409 }
      )
    }

    if (!Array.isArray(kriteriaList) || kriteriaList.length === 0) {
      return NextResponse.json(
        { error: "Minimal 1 kriteria penilaian harus ditambahkan" },
        { status: 400 }
      )
    }

    let calculatedTotalBobot = 0
    const cleanKriteriaList: { judulkriteria: string; kriteria: string; bobot: number }[] = []

    for (let i = 0; i < kriteriaList.length; i++) {
      const k = kriteriaList[i]
      const judul = k.judulkriteria?.toString().trim()
      const desc = k.kriteria?.toString().trim()
      const bobotNum = parseInt(k.bobot, 10)

      if (!judul) {
        return NextResponse.json(
          { error: `Judul kriteria pada baris ke-${i + 1} wajib diisi` },
          { status: 400 }
        )
      }
      if (!desc) {
        return NextResponse.json(
          { error: `Deskripsi kriteria "${judul}" wajib diisi` },
          { status: 400 }
        )
      }
      if (isNaN(bobotNum) || bobotNum <= 0) {
        return NextResponse.json(
          { error: `Bobot untuk kriteria "${judul}" harus berupa angka positif lebih dari 0` },
          { status: 400 }
        )
      }

      calculatedTotalBobot += bobotNum
      cleanKriteriaList.push({
        judulkriteria: judul,
        kriteria: desc,
        bobot: bobotNum,
      })
    }

    if (calculatedTotalBobot !== 100) {
      return NextResponse.json(
        {
          error: `Total keseluruhan bobot harus tepat 100%. Saat ini akumulasi bobot adalah ${calculatedTotalBobot}%.`,
          currentTotal: calculatedTotalBobot,
        },
        { status: 400 }
      )
    }

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
            idkuliah,
            nrp,
            judulkriteria: crit.judulkriteria,
            kriteria: crit.kriteria,
            bobot: crit.bobot,
            grade: null,
          })
        }
      }

      await prisma.nilai.createMany({ data: nilaiToInsert })
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

    if (typeof kunci_jawaban === "string" && kunci_jawaban.trim()) {
      await prisma.kuliah.update({
        where: { idkuliah },
        data: { kunci_jawaban: kunci_jawaban.trim() },
      })
    }

    return NextResponse.json(
      {
        message: "Data nilai berhasil dibuat untuk mata kuliah terpilih",
        idkuliah,
        kriteriaCount: cleanKriteriaList.length,
        enrolledStudentsCount: cleanNrps.length,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating nilai:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan internal saat membuat nilai" },
      { status: 500 }
    )
  }
}
