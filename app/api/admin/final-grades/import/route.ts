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
    const idkuliah = Number(body.idkuliah)
    const rows = Array.isArray(body.rows) ? body.rows : []

    if (!Number.isInteger(idkuliah) || idkuliah <= 0) {
      return NextResponse.json({ error: "Mata kuliah tidak valid" }, { status: 400 })
    }
    if (rows.length === 0) {
      return NextResponse.json({ error: "Tidak ada baris data untuk diimpor" }, { status: 400 })
    }

    const course = await prisma.kuliah.findUnique({
      where: { idkuliah },
      select: { idkuliah: true },
    })
    if (!course) {
      return NextResponse.json({ error: "Mata kuliah tidak ditemukan" }, { status: 404 })
    }

    const nrps = Array.from(
      new Set(
        rows
          .map((r: { nrp?: unknown }) => (typeof r.nrp === "string" ? r.nrp.trim() : ""))
          .filter(Boolean)
      )
    ) as string[]

    const validStudents = await prisma.userNilai.findMany({
      where: { nrp: { in: nrps } },
      select: { nrp: true },
    })
    const validNrpSet = new Set(validStudents.map((s) => s.nrp))

    const missingNrps = nrps.filter((n) => !validNrpSet.has(n))
    if (missingNrps.length > 0) {
      return NextResponse.json(
        {
          error: `NRP berikut tidak ditemukan di database mahasiswa: ${missingNrps.slice(0, 10).join(", ")}${
            missingNrps.length > 10 ? ` (+${missingNrps.length - 10} lainnya)` : ""
          }`,
        },
        { status: 400 }
      )
    }

    const cleanRows = rows.map(
      (r: {
        nrp: string
        mid_assignment_grade?: unknown
        mid_exam_grade?: unknown
        final_assignment_grade?: unknown
        final_exam_grade?: unknown
        final_grade?: unknown
      }) => ({
        nrp: r.nrp.trim(),
        mid_assignment_grade: parseOptionalGrade(r.mid_assignment_grade),
        mid_exam_grade: parseOptionalGrade(r.mid_exam_grade),
        final_assignment_grade: parseOptionalGrade(r.final_assignment_grade),
        final_exam_grade: parseOptionalGrade(r.final_exam_grade),
        final_grade: parseOptionalGrade(r.final_grade),
      })
    )

    await prisma.$transaction(
      cleanRows.map((row: (typeof cleanRows)[number]) =>
        prisma.studentFinalGrade.upsert({
          where: {
            nrp_idkuliah: {
              nrp: row.nrp,
              idkuliah,
            },
          },
          create: {
            nrp: row.nrp,
            idkuliah,
            mid_assignment_grade: row.mid_assignment_grade,
            mid_exam_grade: row.mid_exam_grade,
            final_assignment_grade: row.final_assignment_grade,
            final_exam_grade: row.final_exam_grade,
            final_grade: row.final_grade,
          },
          update: {
            mid_assignment_grade: row.mid_assignment_grade,
            mid_exam_grade: row.mid_exam_grade,
            final_assignment_grade: row.final_assignment_grade,
            final_exam_grade: row.final_exam_grade,
            final_grade: row.final_grade,
          },
        })
      )
    )

    return NextResponse.json({
      message: `${cleanRows.length} data final grade berhasil diimpor`,
      count: cleanRows.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal mengimpor final grades"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
