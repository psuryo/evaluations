import { prisma } from "./prisma"

export interface PersonEvaluationStatus {
  nrp: string
  nama?: string
  hasSubmitted: boolean
  isInProgress: boolean // Started evaluating but not submitted
  isSubmittedButIncomplete: boolean // Submitted but didn't complete all evaluations
  evaluatedCount: number
  evaluatedBy: string[]
  missingEvaluators: string[]
  criteriaScores: Record<number, boolean> // idkriteria -> has_all_peers_evaluated
  isComplete: boolean
}

export interface GroupCompletionStatus {
  groupId: string
  idkuliah: number
  totalMembers: number
  submittedCount: number
  allSubmitted: boolean
  memberStatus: PersonEvaluationStatus[]
  summaryByPerson: Record<
    string,
    {
      submitted: boolean
      evaluatedByCount: number
      isComplete: boolean
    }
  >
}

export async function getGroupEvaluationStatus(
  groupId: string,
  idkuliah: number
): Promise<GroupCompletionStatus> {
  // 1. Get all group members
  const groupMembers = await prisma.group.findMany({
    where: { group_id: groupId, idkuliah },
    select: { nrp: true },
  })

  const memberNrps = groupMembers
    .map((m) => m.nrp)
    .filter((nrp) => nrp !== null && nrp !== undefined)

  // 2. Get all submissions
  const submissions = await prisma.submission.findMany({
    where: {
      nrp: { in: memberNrps },
      idkuliah,
    },
  })

  const submittedSet = new Set(submissions.map((s) => s.nrp))

  // 3. Get all criteria
  const criteria = await prisma.kriteria.findMany({
    select: { idkriteria: true },
  })
  const criteriaIds = criteria.map((c) => c.idkriteria)

  // Get all student names
  const students = await prisma.userNilai.findMany({
    where: { nrp: { in: memberNrps } },
    select: { nrp: true, nama: true },
  })

  const studentMap = new Map(students.map((s) => [s.nrp, s.nama]))

  // Get all evaluators who have started (have evaluation records)
  const startedEvaluators = await prisma.evaluations.findMany({
    where: { idkuliah },
    select: { evaluator_nrp: true },
    distinct: ["evaluator_nrp"],
  })

  const startedEvaluatorSet = new Set(
    startedEvaluators.map((e) => e.evaluator_nrp).filter((e): e is string => e !== null)
  )

  // 4. For each member, check evaluation details
  const memberStatus: PersonEvaluationStatus[] = await Promise.all(
    memberNrps.map(async (nrp) => {
      // Who evaluated this person?
      const evaluators = await prisma.evaluations.findMany({
        where: {
          evaluated_nrp: nrp,
          idkuliah,
        },
        select: { evaluator_nrp: true },
        distinct: ["evaluator_nrp"],
      })

      const evaluatedBySet = new Set(
        evaluators.map((e) => e.evaluator_nrp).filter((e): e is string => e !== null)
      )

      const missingEvaluators = memberNrps.filter(
        (peer) => peer !== nrp && !evaluatedBySet.has(peer)
      )

      // For each criteria, check if all peers evaluated THIS person
      const criteriaScores: Record<number, boolean> = {}
      let hasAllEvaluationsComplete = true

      for (const idkriteria of criteriaIds) {
        const scores = await prisma.evaluations.findMany({
          where: {
            evaluated_nrp: nrp,
            idkuliah,
            idkriteria,
          },
          select: { evaluator_nrp: true },
        })

        const peerCount = memberNrps.filter((p) => p !== nrp).length
        const scoreCount = new Set(scores.map((s) => s.evaluator_nrp)).size
        criteriaScores[idkriteria] = scoreCount === peerCount
        
        if (scoreCount < peerCount) {
          hasAllEvaluationsComplete = false
        }
      }

      // Check if THIS PERSON has evaluated all peers for all criteria
      const hasEvaluatedAllPeers = await Promise.all(
        memberNrps.map(async (peer) => {
          if (peer === nrp) return true // Skip self
          
          // Check if this person evaluated this peer for ALL criteria
          for (const idkriteria of criteriaIds) {
            const record = await prisma.evaluations.findFirst({
              where: {
                evaluator_nrp: nrp,
                evaluated_nrp: peer,
                idkuliah,
                idkriteria,
              },
            })
            
            if (!record) {
              // Missing evaluation for this peer in this criteria
              return false
            }
          }
          
          return true
        })
      )

      const thisPersonCompletedEval = hasEvaluatedAllPeers.every((completed) => completed)

      const isComplete =
        submittedSet.has(nrp) && thisPersonCompletedEval && hasAllEvaluationsComplete

      // Check if this person has started evaluating but not submitted
      const isInProgress = startedEvaluatorSet.has(nrp) && !submittedSet.has(nrp)

      // Check if submitted but didn't complete evaluations
      const isSubmittedButIncomplete = submittedSet.has(nrp) && !thisPersonCompletedEval

      return {
        nrp,
        nama: studentMap.get(nrp) ?? undefined,
        hasSubmitted: submittedSet.has(nrp),
        isInProgress,
        evaluatedCount: evaluatedBySet.size,
        evaluatedBy: Array.from(evaluatedBySet),
        missingEvaluators,
        criteriaScores,
        isComplete,
        isSubmittedButIncomplete,
      }
    })
  )

  // 5. Build summary
  const summaryByPerson = Object.fromEntries(
    memberStatus.map((status) => [
      status.nrp,
      {
        submitted: status.hasSubmitted,
        evaluatedByCount: status.evaluatedCount,
        isComplete: status.isComplete,
      },
    ])
  )

  return {
    groupId,
    idkuliah,
    totalMembers: memberNrps.length,
    submittedCount: submittedSet.size,
    allSubmitted: submittedSet.size === memberNrps.length,
    memberStatus,
    summaryByPerson,
  }
}
