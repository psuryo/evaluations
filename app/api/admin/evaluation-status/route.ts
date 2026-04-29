import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/app/src/lib/prisma"

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
    const stats = await prisma.$queryRaw`
      WITH DoneCounts AS (
        SELECT evaluator_nrp, idkuliah, count(evaluated_nrp)::int as done_count 
        FROM evaluations 
        GROUP BY evaluator_nrp, idkuliah
      ),
      GroupShouldDo AS (
        SELECT group_id, idkuliah, (count(nrp) - 1)*3::int as should_do 
        FROM "group" 
        GROUP BY group_id, idkuliah
      ),
      UserGroups AS (
        SELECT g.nrp, g.idkuliah, SUM(gs.should_do)::int as total_should_do
        FROM "group" g
        JOIN GroupShouldDo gs ON g.group_id = gs.group_id AND g.idkuliah = gs.idkuliah
        GROUP BY g.nrp, g.idkuliah
      )
      SELECT 
        ug.nrp as evaluator_nrp,
        u.nama,
        k.matkul,
        k.idkuliah,
        COALESCE(dc.done_count, 0)::int as done_count,
        ug.total_should_do as should_do
      FROM UserGroups ug
      LEFT JOIN DoneCounts dc ON ug.nrp = dc.evaluator_nrp AND ug.idkuliah = dc.idkuliah
      LEFT JOIN usernilai u ON ug.nrp = u.nrp
      LEFT JOIN kuliah k ON ug.idkuliah = k.idkuliah
      ORDER BY ug.idkuliah ASC, (ug.total_should_do - COALESCE(dc.done_count, 0)) DESC;
    `

    return NextResponse.json({
      stats
    })
  } catch (error) {
    console.error("Error fetching evaluation status:", error)
    return NextResponse.json(
      { error: "Failed to fetch evaluation status" },
      { status: 500 }
    )
  }
}
