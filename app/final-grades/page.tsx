import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/app/src/lib/prisma"
import { isAdminEmail } from "@/app/src/lib/adminAuth"
import { getImpersonatedEmail } from "@/app/src/lib/impersonate"
import LogoutButton from "../dashboard/LogoutButton"
import ImpersonationBackButton from "../dashboard/ImpersonationBackButton"
import StudentFinalGradesClient, {
  StudentFinalGradeItem,
} from "./StudentFinalGradesClient"

async function getStudentFinalGrades(
  nrp: string
): Promise<StudentFinalGradeItem[]> {
  if (!nrp) return []

  const grades = await prisma.studentFinalGrade.findMany({
    where: { nrp },
    orderBy: [{ idkuliah: "desc" }],
  })

  if (grades.length === 0) return []

  const courseIds = Array.from(
    new Set(grades.map((g) => g.idkuliah).filter((id): id is number => id !== null))
  )

  const [courses, weights] = await Promise.all([
    prisma.kuliah.findMany({
      where: { idkuliah: { in: courseIds } },
      select: { idkuliah: true, matkul: true, tahun: true, is_published: true },
    }),
    prisma.courseGradeWeights.findMany({
      where: { idkuliah: { in: courseIds } },
    }),
  ])

  const courseMap = new Map(courses.map((c) => [c.idkuliah, c]))
  const weightMap = new Map(weights.map((w) => [w.idkuliah, w]))

  const items: StudentFinalGradeItem[] = []

  for (const g of grades) {
    if (!g.idkuliah) continue
    const course = courseMap.get(g.idkuliah)
    if (!course?.is_published) continue

    const w = weightMap.get(g.idkuliah)
    const midAssignmentWeight = w?.mid_assignment_weight ?? 15
    const midExamWeight = w?.mid_exam_weight ?? 25
    const finalAssignmentWeight = w?.final_assignment_weight ?? 20
    const finalExamWeight = w?.final_exam_weight ?? 40

    const midAssign =
      g.mid_assignment_grade !== null
        ? parseFloat(g.mid_assignment_grade.toString())
        : null
    const midExam =
      g.mid_exam_grade !== null ? parseFloat(g.mid_exam_grade.toString()) : null
    const finalAssign =
      g.final_assignment_grade !== null
        ? parseFloat(g.final_assignment_grade.toString())
        : null
    const finalExam =
      g.final_exam_grade !== null
        ? parseFloat(g.final_exam_grade.toString())
        : null

    const sts =
      (midAssign ?? 0) * (midAssignmentWeight / 100) +
      (midExam ?? 0) * (midExamWeight / 100)
    const sas =
      (finalAssign ?? 0) * (finalAssignmentWeight / 100) +
      (finalExam ?? 0) * (finalExamWeight / 100)
    const computedFinal = 0.5 * sts + 0.5 * sas
    const finalGrade =
      g.final_grade !== null
        ? parseFloat(g.final_grade.toString())
        : parseFloat(computedFinal.toFixed(2))

    items.push({
      id: g.id,
      idkuliah: g.idkuliah,
      matkul: course.matkul ?? "Untitled",
      tahun: course.tahun ?? "—",
      midAssignmentGrade: midAssign,
      midExamGrade: midExam,
      sts: parseFloat(sts.toFixed(2)),
      finalAssignmentGrade: finalAssign,
      finalExamGrade: finalExam,
      sas: parseFloat(sas.toFixed(2)),
      finalGrade: parseFloat(finalGrade.toFixed(2)),
      weights: {
        midAssignment: midAssignmentWeight,
        midExam: midExamWeight,
        finalAssignment: finalAssignmentWeight,
        finalExam: finalExamWeight,
      },
    })
  }

  return items.sort((a, b) => {
    const tahunCmp = b.tahun.localeCompare(a.tahun, undefined, {
      numeric: true,
      sensitivity: "base",
    })
    if (tahunCmp !== 0) return tahunCmp
    return b.idkuliah - a.idkuliah
  })
}

export default async function StudentFinalGradesPage({
  searchParams,
}: {
  searchParams: Promise<{ viewAs?: string }>
}) {
  const session = await getServerSession()
  if (!session?.user?.email) redirect("/login")

  const userEmail = session.user.email
  const isAdmin = isAdminEmail(userEmail)
  const { viewAs } = await searchParams

  const impersonatedEmail = await getImpersonatedEmail()
  const isImpersonating = !!impersonatedEmail
  const legacyViewingAs = isAdmin && viewAs ? viewAs : null

  let nrp: string | null = null
  let viewingStudent: { nrp: string; nama: string | null } | null = null

  if (impersonatedEmail) {
    viewingStudent = await prisma.userNilai.findUnique({
      where: { email: impersonatedEmail },
      select: { nrp: true, nama: true },
    })
    nrp = viewingStudent?.nrp ?? null
  } else if (legacyViewingAs) {
    viewingStudent = await prisma.userNilai.findUnique({
      where: { nrp: legacyViewingAs },
      select: { nrp: true, nama: true },
    })
    nrp = legacyViewingAs
  } else {
    const student = await prisma.userNilai.findUnique({
      where: { email: userEmail },
      select: { nrp: true, nama: true },
    })
    if (!student && isAdmin) {
      redirect("/admin/final-grades")
    }
    nrp = student?.nrp ?? null
  }

  const viewingAs =
    isImpersonating || legacyViewingAs
      ? viewingStudent?.nrp ?? legacyViewingAs
      : null

  const grades = await getStudentFinalGrades(nrp ?? "")
  const userInitial = userEmail.charAt(0).toUpperCase()

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .sfg-root { min-height: 100dvh; background: #f5f4f0; font-family: 'Sora', system-ui, sans-serif; color: #111; }

        .sfg-topbar {
          background: #fff;
          border-bottom: 0.5px solid rgba(0,0,0,0.08);
          padding: 0 40px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .sfg-wordmark { font-size: 19px; color: #111; letter-spacing: -0.3px; text-decoration: none; }
        .sfg-user { display: flex; align-items: center; gap: 10px; }
        .sfg-avatar { width: 30px; height: 30px; border-radius: 50%; background: #141414; color: #efefef; font-size: 12px; font-weight: 500; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .sfg-email { font-size: 13px; color: #999; }

        .sfg-body { max-width: 960px; margin: 0 auto; padding: 48px 40px 80px; }

        .sfg-back-row { margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .sfg-back-link { font-size: 13px; color: #666; text-decoration: none; }
        .sfg-back-link:hover { color: #111; }

        .sfg-impersonate-banner {
          background: #fdf8ee;
          border: 0.5px solid #e8d08a;
          border-radius: 10px;
          padding: 12px 16px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13px;
          color: #6b4c00;
        }

        .sfg-title { font-size: 30px; font-weight: 600; color: #111; margin-bottom: 4px; line-height: 1.2; }
        .sfg-subtitle { font-size: 14px; color: #999; font-weight: 300; margin-bottom: 24px; }

        .sfg-filters {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.07);
          border-radius: 12px;
          padding: 16px 20px;
          margin-bottom: 20px;
        }
        .sfg-filter-group { display: flex; flex-direction: column; gap: 6px; min-width: 180px; }
        .sfg-filter-course { flex: 1; min-width: 240px; }
        .sfg-filter-label {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #999;
        }
        .sfg-select {
          font-family: 'Sora', system-ui, sans-serif;
          font-size: 13px;
          color: #111;
          background: #faf9f6;
          border: 0.5px solid rgba(0,0,0,0.14);
          border-radius: 8px;
          padding: 9px 12px;
          outline: none;
        }
        .sfg-select:focus { border-color: #111; background: #fff; }

        .sfg-stat-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 24px;
        }
        .sfg-stat-card {
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.07);
          border-radius: 12px;
          padding: 20px 22px;
        }
        .sfg-stat-label {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: #bbb;
          margin-bottom: 10px;
        }
        .sfg-stat-val { font-size: 36px; font-weight: 600; color: #111; line-height: 1; margin-bottom: 4px; }
        .sfg-val-green { color: #1f6b45; }
        .sfg-stat-sub { font-size: 12px; color: #bbb; font-weight: 300; }

        .sfg-table-card {
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.07);
          border-radius: 12px;
          overflow: hidden;
        }
        .sfg-table-wrap { overflow-x: auto; }
        .sfg-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .sfg-table th {
          text-align: left;
          padding: 12px 14px;
          font-size: 11px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #999;
          background: #faf9f6;
          border-bottom: 0.5px solid rgba(0,0,0,0.06);
          white-space: nowrap;
        }
        .sfg-table th.num, .sfg-table td.num { text-align: right; }
        .sfg-table td {
          padding: 13px 14px;
          border-bottom: 0.5px solid rgba(0,0,0,0.04);
          color: #222;
          white-space: nowrap;
        }
        .sfg-table tbody tr:last-child td { border-bottom: none; }
        .sfg-table tbody tr:hover { background: #faf9f6; }

        .sfg-tahun-pill {
          font-size: 11px;
          font-weight: 500;
          color: #555;
          background: #f0ede8;
          border-radius: 999px;
          padding: 3px 10px;
        }
        .sfg-course-name { font-weight: 500; color: #111; white-space: normal; min-width: 180px; }
        .sfg-course-weights { font-size: 11px; color: #aaa; font-weight: 300; margin-top: 2px; }
        .sfg-table td.num { font-family: 'Monaco', 'Courier', monospace; font-size: 12.5px; }
        .sfg-table td.sub { color: #666; }
        .sfg-table td.final { font-weight: 600; color: #1f6b45; }

        .sfg-empty {
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.07);
          border-radius: 12px;
          padding: 48px 24px;
          text-align: center;
          color: #999;
          font-size: 14px;
          font-weight: 300;
        }

        @media (max-width: 768px) {
          .sfg-body { padding: 28px 20px 60px; }
          .sfg-topbar { padding: 0 20px; }
          .sfg-email { display: none; }
          .sfg-stat-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="sfg-root">
        <header className="sfg-topbar">
          <Link href="/dashboard" className="sfg-wordmark">
            evaluations
          </Link>
          <div className="sfg-user">
            {isAdmin && (
              <Link
                href="/admin/final-grades"
                style={{
                  fontSize: "12px",
                  color: "#111",
                  background: "#f4f3ef",
                  border: "0.5px solid rgba(0,0,0,0.15)",
                  borderRadius: "6px",
                  padding: "5px 12px",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                Admin Final Grades →
              </Link>
            )}
            <span className="sfg-email">{userEmail}</span>
            <div className="sfg-avatar">{userInitial}</div>
            <LogoutButton />
          </div>
        </header>

        <main className="sfg-body">
          <div className="sfg-back-row">
            <Link
              href={viewingAs ? `/dashboard?viewAs=${viewingAs}` : "/dashboard"}
              className="sfg-back-link"
            >
              ← Back to dashboard
            </Link>
          </div>

          {(isImpersonating || viewingAs) && (
            <div className="sfg-impersonate-banner">
              <span>
                Viewing final grades for{" "}
                <strong>{viewingStudent?.nama ?? viewingAs ?? "user"}</strong>{" "}
                <span style={{ opacity: 0.6, fontFamily: "monospace", fontSize: "12px" }}>
                  ({viewingStudent?.nrp})
                </span>
              </span>
              {isImpersonating ? (
                <ImpersonationBackButton />
              ) : (
                <Link href="/admin" className="sfg-back-link">
                  ← Back to admin
                </Link>
              )}
            </div>
          )}

          <h1 className="sfg-title">Final Grades</h1>
          <p className="sfg-subtitle">
            Daftar nilai akhir berdasarkan mata kuliah dan tahun.
          </p>

          <StudentFinalGradesClient grades={grades} />
        </main>
      </div>
    </>
  )
}
