/**
 * DEBUG TOOL: Check evaluation status for a specific NRP
 * Usage: npx ts-node check-nrp-status.ts [NRP] [idkuliah]
 * Example: npx ts-node check-nrp-status.ts 123456 1
 */

import { prisma } from "./app/src/lib/prisma"

async function checkNrpStatus(nrp: string, idkuliah?: number) {
  console.log(`\n📋 Checking NRP: ${nrp}`)
  if (idkuliah) console.log(`📚 Course: ${idkuliah}`)
  console.log("=" + "=".repeat(79))

  try {
    // Get student info
    const student = await prisma.userNilai.findUnique({
      where: { nrp },
      select: { nrp: true, nama: true, email: true },
    })

    if (!student) {
      console.log("❌ Student not found in database")
      return
    }

    console.log(`\n✅ Student found: ${student.nama} <${student.email}>`)

    // Get all courses for this student
    const groups = await prisma.group.findMany({
      where: { nrp, ...(idkuliah && { idkuliah }) },
      select: { idkuliah: true, group_id: true },
    })

    console.log(`\n📚 Courses: ${groups.length} found`)

    for (const group of groups) {
      const kuliah = await prisma.kuliah.findUnique({
        where: { idkuliah: group.idkuliah! },
        select: { idkuliah: true, matkul: true, tahun: true },
      })

      console.log(`\n  Course ${group.idkuliah}: ${kuliah?.matkul} (${kuliah?.tahun})`)
      console.log(`  Group: ${group.group_id || "❌ NO GROUP"}`)

      // Check submission
      const submission = await prisma.submission.findFirst({
        where: { nrp, idkuliah: group.idkuliah },
        select: { id: true, created_at: true },
      })

      if (submission) {
        console.log(`  ✅ Submission record: YES (created ${submission.created_at})`)
      } else {
        console.log(`  ❌ Submission record: NO`)
      }

      // Check criteria completion
      const criteria = await prisma.kriteria.findMany({
        select: { idkriteria: true, namakriteria: true },
      })

      console.log(`\n  Criteria Status:`)

      let allComplete = true
      for (const k of criteria) {
        const evaluations = await prisma.evaluations.findMany({
          where: {
            evaluator_nrp: nrp,
            idkuliah: group.idkuliah,
            idkriteria: k.idkriteria,
          },
          select: { evaluated_nrp: true, points: true },
        })

        const total = evaluations.reduce((sum, e) => sum + (e.points || 0), 0)
        const count = evaluations.length
        const complete = total === 100

        if (!complete) allComplete = false

        const status = complete ? "✅" : "❌"
        console.log(`    ${status} ${k.namakriteria}: ${total}/100 (${count} scores)`)

        if (evaluations.length > 0) {
          evaluations.forEach((e) => {
            console.log(`       - ${e.evaluated_nrp}: ${e.points}`)
          })
        }
      }

      console.log(`\n  Overall: ${allComplete ? "✅ COMPLETE" : "❌ INCOMPLETE"}`)

      if (submission && !allComplete) {
        console.log(
          `\n  💡 FIX: This submission is incomplete. Run this to reset:\n`
        )
        console.log(
          `     DELETE FROM submission WHERE nrp = '${nrp}' AND idkuliah = ${group.idkuliah};`
        )
        console.log(
          `     DELETE FROM evaluations WHERE evaluator_nrp = '${nrp}' AND idkuliah = ${group.idkuliah};\n`
        )
      }
    }

    console.log("=" + "=".repeat(79))
  } catch (error) {
    console.error("Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

// Get NRP from command line
const args = process.argv.slice(2)
if (args.length === 0) {
  console.log("Usage: npx ts-node check-nrp-status.ts [NRP] [idkuliah?]")
  console.log("Example: npx ts-node check-nrp-status.ts 123456 1")
  process.exit(1)
}

const nrp = args[0]
const idkuliah = args[1] ? parseInt(args[1]) : undefined

checkNrpStatus(nrp, idkuliah).catch(console.error)
