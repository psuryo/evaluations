import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/app/src/lib/prisma"

// scores[idkriteria][evaluated_nrp] = points
// each criteria column must sum to 100
type ScoreMap = Record<string, Record<string, number>>

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { evaluatorNrp, scores, idkuliah } = body as {
    evaluatorNrp: string
    scores: ScoreMap
    idkuliah: number
  }

  if (!idkuliah || isNaN(idkuliah)) {
    return NextResponse.json({ error: "Missing idkuliah" }, { status: 400 })
  }

  // Guard: each criteria column must sum to exactly 100
  for (const [idkriteria, peerScores] of Object.entries(scores)) {
    const total = Object.values(peerScores).reduce((a, b) => a + b, 0)
    if (total !== 100) {
      return NextResponse.json(
        { error: `Criteria ${idkriteria} sums to ${total}, must be 100` },
        { status: 400 }
      )
    }
  }

  const transactionItems: any[] = []

  // Check if they already submitted
  const existing = await prisma.submission.findFirst({
    where: { nrp: evaluatorNrp, idkuliah },
  })
  
  if (existing) {
    // Delete existing evaluations so we can replace them with the new complete set
    transactionItems.push(
      prisma.evaluations.deleteMany({
        where: { evaluator_nrp: evaluatorNrp, idkuliah }
      })
    )
  } else {
    // Create submission record for the first time
    transactionItems.push(
      prisma.submission.create({
        data: { nrp: evaluatorNrp, idkuliah },
      })
    )
  }

  // Build rows: one per evaluator × evaluated
  const evaluationRows = Object.entries(scores).flatMap(
    ([idkriteria, peerScores]) =>
      Object.entries(peerScores).map(([evaluatedNrp, score]) =>
        prisma.evaluations.create({
          data: {
            evaluator_nrp: evaluatorNrp,
            evaluated_nrp: evaluatedNrp,
            idkuliah,
            idkriteria: parseInt(idkriteria),
            points: score,
          },
        })
      )
  )

  transactionItems.push(...evaluationRows)

  await prisma.$transaction(transactionItems)

  return NextResponse.json({ ok: true })
}
