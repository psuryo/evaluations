import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/app/src/lib/prisma"
import { getGroupEvaluationStatus } from "@/app/src/lib/evaluationStatus"

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

export async function GET(req: NextRequest) {
  const session = await getServerSession()

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (ADMIN_EMAIL && session.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const idkuliah = searchParams.get("idkuliah")

    // Get all group records
    const where: any = { group_id: { not: null } }
    if (idkuliah) {
      where.idkuliah = parseInt(idkuliah)
    }

    const allGroupRecords = await prisma.group.findMany({
      where,
      select: { group_id: true, idkuliah: true },
      orderBy: [{ idkuliah: "asc" }, { group_id: "asc" }],
    })

    // Deduplicate groups in memory
    const uniqueGroupsMap = new Map<string, { group_id: string; idkuliah: number }>()
    allGroupRecords.forEach((g) => {
      if (g.group_id !== null && g.idkuliah !== null) {
        const key = `${g.group_id}:${g.idkuliah}`
        if (!uniqueGroupsMap.has(key)) {
          uniqueGroupsMap.set(key, { group_id: g.group_id, idkuliah: g.idkuliah })
        }
      }
    })
    const uniqueGroups = Array.from(uniqueGroupsMap.values())

    const courseMap = new Map<number, string>()
    const courses = await prisma.kuliah.findMany({
      select: { idkuliah: true, matkul: true },
    })
    courses.forEach((c) => courseMap.set(c.idkuliah, c.matkul ?? "Unknown"))

    // Get status for all groups
    const statusData = await Promise.all(
      uniqueGroups.map((g) =>
        getGroupEvaluationStatus(g.group_id!, g.idkuliah!)
          .catch((error) => {
            console.error(`Error getting status for group ${g.group_id} in course ${g.idkuliah}:`, error)
            return null
          })
      )
    ).then((results) => results.filter((r) => r !== null))

    return NextResponse.json({
      groups: statusData,
      courseMap: Object.fromEntries(courseMap),
    })
  } catch (error) {
    console.error("Error fetching evaluation status:", error)
    return NextResponse.json(
      { error: "Failed to fetch evaluation status" },
      { status: 500 }
    )
  }
}
