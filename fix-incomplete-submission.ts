/**
 * ADMIN TOOL: Reset an incomplete evaluation submission
 * Usage: npx ts-node fix-incomplete-submission.ts [NRP] [idkuliah]
 * Example: npx ts-node fix-incomplete-submission.ts 123456 1
 *
 * This allows a student to re-evaluate after submitting incomplete data.
 */

import { prisma } from "./app/src/lib/prisma"
import * as readline from "readline"

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve)
  })
}

async function resetSubmission(nrp: string, idkuliah: number) {
  console.log(`\n⚠️  Resetting evaluation for NRP: ${nrp}, Course: ${idkuliah}`)
  console.log("=" + "=".repeat(79))

  try {
    // Verify the submission exists
    const submission = await prisma.submission.findFirst({
      where: { nrp, idkuliah },
      select: { id: true, created_at: true },
    })

    if (!submission) {
      console.log("❌ No submission found for this NRP + Course")
      return
    }

    // Check evaluations
    const evaluations = await prisma.evaluations.findMany({
      where: { evaluator_nrp: nrp, idkuliah },
      select: { id: true, evaluated_nrp: true, idkriteria: true, points: true },
    })

    console.log(`\n📋 Found:`)
    console.log(`   - 1 Submission record (${submission.created_at})`)
    console.log(`   - ${evaluations.length} Evaluation records`)

    if (evaluations.length > 0) {
      console.log("\n   Evaluations to be deleted:")
      evaluations.slice(0, 5).forEach((e) => {
        console.log(
          `   - Evaluated ${e.evaluated_nrp} on criteria ${e.idkriteria}: ${e.points}`
        )
      })
      if (evaluations.length > 5) {
        console.log(`   - ... and ${evaluations.length - 5} more`)
      }
    }

    const confirm = await question(
      "\n⚠️  This will delete the above records. Continue? (yes/no): "
    )

    if (confirm.toLowerCase() !== "yes") {
      console.log("Cancelled.")
      return
    }

    // Delete evaluations and submission
    const evalDeleteResult = await prisma.evaluations.deleteMany({
      where: { evaluator_nrp: nrp, idkuliah },
    })

    const subDeleteResult = await prisma.submission.deleteMany({
      where: { nrp, idkuliah },
    })

    console.log("\n✅ Reset complete!")
    console.log(`   - Deleted ${evalDeleteResult.count} evaluation records`)
    console.log(`   - Deleted ${subDeleteResult.count} submission record`)
    console.log(`\n💬 The student can now re-evaluate this course.`)
  } catch (error) {
    console.error("❌ Error:", error)
  } finally {
    rl.close()
    await prisma.$disconnect()
  }
}

// Main
const args = process.argv.slice(2)
if (args.length < 2) {
  console.log("Usage: npx ts-node fix-incomplete-submission.ts [NRP] [idkuliah]")
  console.log("Example: npx ts-node fix-incomplete-submission.ts 123456 1")
  process.exit(1)
}

const nrp = args[0]
const idkuliah = parseInt(args[1])

if (isNaN(idkuliah)) {
  console.log("❌ idkuliah must be a number")
  process.exit(1)
}

resetSubmission(nrp, idkuliah).catch(console.error)
