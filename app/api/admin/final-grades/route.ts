import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/app/src/lib/prisma"
import { requireAdmin } from "@/app/src/lib/adminAuth"

function parseOptionalGrade(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0 || num > 100) {
    throw new Error("Nilai harus berupa angka antara 0 dan 100")
  }
  return Math.round(num * 100) / 100
}

export async function POST(req: NextRequest) {
  const authError = await requireAdmin()
  if (authError) return authError

  try {
    const body = await req.json()
    const nrp = typeof body.nrp === "string" ? body.nrp.trim() : ""
    const idkuliah = Number(body.idkuliah)

    if (!nrp) {
      return NextResponse.json({ error: "NRP wajib diisi" }, { status: 400 })
    }
    if (!Number.isInteger(idkuliah) || idkuliah <= 0) {
      return NextResponse.json(
        { error: "Mata kuliah tidak valid" },
        { status: 400 }
      )
    }

    const [student, course, existing] = await Promise.all([
      prisma.userNilai.findUnique({ where: { nrp }, select: { nrp: true } }),
      prisma.kuliah.findUnique({
        where: { idkuliah },
        select: { idkuliah: true },
      }),
      prisma.studentFinalGrade.findFirst({
        where: { nrp, idkuliah },
        select: { id: true },
      }),
    ])

    if (!student) {
      return NextResponse.json(
        { error: `Mahasiswa dengan NRP ${nrp} tidak ditemukan` },
        { status: 404 }
      )
    }
    if (!course) {
      return NextResponse.json(
        { error: "Mata kuliah tidak ditemukan" },
        { status: 404 }
      )
    }
    if (existing) {
      return NextResponse.json(
        { error: "Data final grade untuk mahasiswa dan mata kuliah ini sudah ada" },
        { status: 409 }
      )
    }

    const mid_assignment_grade = parseOptionalGrade(body.mid_assignment_grade)
    const mid_exam_grade = parseOptionalGrade(body.mid_exam_grade)
    const final_assignment_grade = parseOptionalGrade(
      body.final_assignment_grade
    )
    const final_exam_grade = parseOptionalGrade(body.final_exam_grade)
    const final_grade = parseOptionalGrade(body.final_grade)

    const created = await prisma.studentFinalGrade.create({
      data: {
        nrp,
        idkuliah,
        mid_assignment_grade,
        mid_exam_grade,
        final_assignment_grade,
        final_exam_grade,
        final_grade,
      },
    })

    return NextResponse.json({ data: created }, { status: 201 })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal menambah final grade"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
