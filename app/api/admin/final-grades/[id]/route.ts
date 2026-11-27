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

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin()
  if (authError) return authError

  const { id: idStr } = await context.params
  const id = parseInt(idStr, 10)
  if (isNaN(id)) {
    return NextResponse.json({ error: "ID tidak valid" }, { status: 400 })
  }

  try {
    const existing = await prisma.studentFinalGrade.findUnique({
      where: { id },
    })
    if (!existing) {
      return NextResponse.json(
        { error: "Data final grade tidak ditemukan" },
        { status: 404 }
      )
    }

    const body = await req.json()
    const mid_assignment_grade = parseOptionalGrade(body.mid_assignment_grade)
    const mid_exam_grade = parseOptionalGrade(body.mid_exam_grade)
    const final_assignment_grade = parseOptionalGrade(
      body.final_assignment_grade
    )
    const final_exam_grade = parseOptionalGrade(body.final_exam_grade)
    const final_grade = parseOptionalGrade(body.final_grade)

    const updated = await prisma.studentFinalGrade.update({
      where: { id },
      data: {
        mid_assignment_grade,
        mid_exam_grade,
        final_assignment_grade,
        final_exam_grade,
        final_grade,
      },
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal memperbarui final grade"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin()
  if (authError) return authError

  const { id: idStr } = await context.params
  const id = parseInt(idStr, 10)
  if (isNaN(id)) {
    return NextResponse.json({ error: "ID tidak valid" }, { status: 400 })
  }

  const existing = await prisma.studentFinalGrade.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json(
      { error: "Data final grade tidak ditemukan" },
      { status: 404 }
    )
  }

  await prisma.studentFinalGrade.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
