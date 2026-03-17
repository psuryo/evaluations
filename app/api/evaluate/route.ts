import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/app/src/lib/prisma"

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { evaluatorNrp, points, idkuliah } = body as {
    evaluatorNrp: string
    points: Record<string, number>
    idkuliah: number
  }

  if (!idkuliah || isNaN(idkuliah)) {
    return NextResponse.json({ error: "Missing idkuliah" }, { status: 400 })
  }

  // Guard: total must be exactly 100
  const total = Object.values(points).reduce((a, b) => a + b, 0)
  if (total !== 100) {
    return NextResponse.json(
      { error: `Points must sum to 100, got ${total}` },
      { status: 400 }
    )
  }

  // Guard: already submitted for this course
  const existing = await prisma.submission.findFirst({
    where: { nrp: evaluatorNrp, idkuliah },
  })
  if (existing) {
    return NextResponse.json({ error: "Already submitted for this course" }, { status: 409 })
  }

  // Write all evaluation rows + submission in a single transaction
  await prisma.$transaction([
    ...Object.entries(points).map(([evaluatedNrp, pts]) =>
      prisma.evaluations.create({
        data: {
          evaluator_nrp: evaluatorNrp,
          evaluated_nrp: evaluatedNrp,
          points: pts,
          idkuliah,
        },
      })
    ),
    prisma.submission.create({
      data: { nrp: evaluatorNrp, idkuliah },
    }),
  ])

  return NextResponse.json({ ok: true })
}
