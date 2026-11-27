import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/app/src/lib/prisma"
import { requireAdmin } from "@/app/src/lib/adminAuth"

function parseWeight(value: unknown, label: string): number {
  const num = Number(value)
  if (!Number.isInteger(num) || num < 0 || num > 100) {
    throw new Error(`${label} harus berupa bilangan bulat antara 0 dan 100`)
  }
  return num
}

export async function PATCH(req: NextRequest) {
  const authError = await requireAdmin()
  if (authError) return authError

  try {
    const body = await req.json()
    const idkuliah = Number(body.idkuliah)

    if (!Number.isInteger(idkuliah) || idkuliah <= 0) {
      return NextResponse.json(
        { error: "Mata kuliah tidak valid" },
        { status: 400 }
      )
    }

    const course = await prisma.kuliah.findUnique({
      where: { idkuliah },
      select: { idkuliah: true },
    })
    if (!course) {
      return NextResponse.json(
        { error: "Mata kuliah tidak ditemukan" },
        { status: 404 }
      )
    }

    const mid_assignment_weight = parseWeight(
      body.mid_assignment_weight,
      "Bobot Tugas UTS"
    )
    const mid_exam_weight = parseWeight(body.mid_exam_weight, "Bobot UTS")
    const final_assignment_weight = parseWeight(
      body.final_assignment_weight,
      "Bobot Tugas UAS"
    )
    const final_exam_weight = parseWeight(body.final_exam_weight, "Bobot UAS")

    const updated = await prisma.courseGradeWeights.upsert({
      where: { idkuliah },
      create: {
        idkuliah,
        mid_assignment_weight,
        mid_exam_weight,
        final_assignment_weight,
        final_exam_weight,
      },
      update: {
        mid_assignment_weight,
        mid_exam_weight,
        final_assignment_weight,
        final_exam_weight,
      },
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal menyimpan bobot nilai"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
