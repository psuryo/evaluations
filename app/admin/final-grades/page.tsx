import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/app/src/lib/prisma"
import { isAdminEmail } from "@/app/src/lib/adminAuth"
import LogoutButton from "../../dashboard/LogoutButton"
import FinalGradesClient, {
  CourseFinalGradesGroup,
  CourseOption,
  FinalGradeRow,
  StudentOption,
} from "./FinalGradesClient"

export const dynamic = "force-dynamic"

async function getFinalGradesData(): Promise<{
  courses: CourseFinalGradesGroup[]
  allCourses: CourseOption[]
  allStudents: StudentOption[]
}> {
  const [courses, finalGrades, students, weights] = await Promise.all([
    prisma.kuliah.findMany({
      select: {
        idkuliah: true,
        matkul: true,
        tahun: true,
        is_published: true,
      },
      orderBy: [{ tahun: "desc" }, { idkuliah: "desc" }],
    }),
    prisma.studentFinalGrade.findMany({
      orderBy: [{ idkuliah: "desc" }, { nrp: "asc" }],
    }),
    prisma.userNilai.findMany({
      select: { nrp: true, nama: true, email: true },
      orderBy: { nrp: "asc" },
    }),
    prisma.courseGradeWeights.findMany(),
  ])

  const studentMap = new Map(students.map((s) => [s.nrp, s]))
  const weightMap = new Map(weights.map((w) => [w.idkuliah, w]))

  const gradesByCourse = new Map<number, FinalGradeRow[]>()

  for (const g of finalGrades) {
    if (!g.idkuliah || !g.nrp) continue

    const w = weightMap.get(g.idkuliah)
    const midAssignW = (w?.mid_assignment_weight ?? 15) / 100
    const midExamW = (w?.mid_exam_weight ?? 25) / 100
    const finalAssignW = (w?.final_assignment_weight ?? 20) / 100
    const finalExamW = (w?.final_exam_weight ?? 40) / 100

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
    const storedFinalGrade =
      g.final_grade !== null ? parseFloat(g.final_grade.toString()) : null

    const sts = (midAssign ?? 0) * midAssignW + (midExam ?? 0) * midExamW
    const sas = (finalAssign ?? 0) * finalAssignW + (finalExam ?? 0) * finalExamW
    const computedFinal = 0.5 * sts + 0.5 * sas
    const finalGrade =
      storedFinalGrade !== null
        ? storedFinalGrade
        : parseFloat(computedFinal.toFixed(2))

    const student = studentMap.get(g.nrp)

    if (!gradesByCourse.has(g.idkuliah)) {
      gradesByCourse.set(g.idkuliah, [])
    }

    gradesByCourse.get(g.idkuliah)!.push({
      id: g.id,
      nrp: g.nrp,
      nama: student?.nama ?? g.nrp,
      email: student?.email ?? "—",
      midAssignmentGrade: midAssign,
      midExamGrade: midExam,
      sts: parseFloat(sts.toFixed(2)),
      finalAssignmentGrade: finalAssign,
      finalExamGrade: finalExam,
      sas: parseFloat(sas.toFixed(2)),
      finalGrade: parseFloat(finalGrade.toFixed(2)),
      storedFinalGrade,
      updatedAt: g.updated_at.toISOString(),
    })
  }

  const courseGroups = courses
    .filter((c) => gradesByCourse.has(c.idkuliah))
    .map((c) => {
      const w = weightMap.get(c.idkuliah)
      return {
        idkuliah: c.idkuliah,
        matkul: c.matkul ?? "Untitled",
        tahun: c.tahun ?? "—",
        isPublished: c.is_published ?? false,
        weights: {
          midAssignment: w?.mid_assignment_weight ?? 15,
          midExam: w?.mid_exam_weight ?? 25,
          finalAssignment: w?.final_assignment_weight ?? 20,
          finalExam: w?.final_exam_weight ?? 40,
        },
        students: gradesByCourse.get(c.idkuliah) ?? [],
      }
    })

  const allCourses: CourseOption[] = courses.map((c) => ({
    idkuliah: c.idkuliah,
    matkul: c.matkul ?? "Untitled",
    tahun: c.tahun ?? "—",
    hasFinalGrades: gradesByCourse.has(c.idkuliah),
  }))

  const allStudents: StudentOption[] = students.map((s) => ({
    nrp: s.nrp,
    nama: s.nama ?? s.nrp,
  }))

  return { courses: courseGroups, allCourses, allStudents }
}

export default async function FinalGradesPage() {
  const session = await getServerSession()

  if (!session?.user?.email) redirect("/login")
  if (!isAdminEmail(session.user.email)) redirect("/dashboard")

  const userInitial = session.user.email.charAt(0).toUpperCase()
  const { courses, allCourses, allStudents } = await getFinalGradesData()

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .fg-root { min-height: 100dvh; background: #f5f4f0; font-family: 'Sora', system-ui, sans-serif; color: #111; }

        .fg-topbar {
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
        .fg-wordmark { font-size: 19px; color: #111; letter-spacing: -0.3px; text-decoration: none; font-weight: 600; }

        .fg-nav { display: flex; align-items: center; gap: 20px; }
        .fg-nav-link { font-size: 13px; color: #666; text-decoration: none; transition: color 0.15s; }
        .fg-nav-link:hover { color: #111; }
        .fg-nav-link.active { color: #111; font-weight: 600; border-bottom: 2px solid #111; padding: 17px 0 15px; }

        .fg-user { display: flex; align-items: center; gap: 10px; }
        .fg-avatar { width: 30px; height: 30px; border-radius: 50%; background: #141414; color: #efefef; font-size: 12px; font-weight: 500; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .fg-email { font-size: 13px; color: #999; }

        .fg-logout {
          font-family: 'Sora', system-ui, sans-serif;
          font-size: 13px;
          color: #999;
          background: none;
          border: 0.5px solid rgba(0,0,0,0.12);
          border-radius: 6px;
          padding: 5px 12px;
          cursor: pointer;
        }
        .fg-logout:hover { color: #111; border-color: rgba(0,0,0,0.3); }

        .fg-body { max-width: 1160px; margin: 0 auto; padding: 40px 40px 80px; }
        .fg-header {
          margin-bottom: 28px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .fg-title { font-size: 28px; font-weight: 600; color: #111; margin-bottom: 4px; line-height: 1.2; }
        .fg-subtitle { font-size: 14px; color: #888; font-weight: 300; }

        .fg-filters {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: flex-end;
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.07);
          border-radius: 12px;
          padding: 16px 20px;
          margin-bottom: 20px;
        }
        .fg-filter-group { display: flex; flex-direction: column; gap: 6px; min-width: 160px; }
        .fg-filter-course { flex: 1; min-width: 220px; }
        .fg-filter-search { flex: 1; min-width: 200px; }
        .fg-filter-label {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #999;
        }
        .fg-select, .fg-input {
          font-family: 'Sora', system-ui, sans-serif;
          font-size: 13px;
          color: #111;
          background: #faf9f6;
          border: 0.5px solid rgba(0,0,0,0.14);
          border-radius: 8px;
          padding: 9px 12px;
          outline: none;
          transition: border-color 0.15s;
          width: 100%;
        }
        .fg-select:focus, .fg-input:focus { border-color: #111; background: #fff; }

        .fg-btn-add {
          font-family: 'Sora', system-ui, sans-serif;
          font-size: 13px;
          font-weight: 600;
          color: #fff;
          background: #111;
          border: none;
          border-radius: 8px;
          padding: 10px 16px;
          cursor: pointer;
          white-space: nowrap;
          transition: opacity 0.15s;
        }
        .fg-btn-add:hover { opacity: 0.86; }

        .fg-stat-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 24px;
        }
        .fg-stat-card {
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.07);
          border-radius: 12px;
          padding: 18px 20px;
        }
        .fg-stat-label {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: #999;
          margin-bottom: 8px;
        }
        .fg-stat-val { font-size: 32px; font-weight: 600; color: #111; line-height: 1; margin-bottom: 4px; }
        .fg-val-green { color: #1f6b45; }
        .fg-stat-sub { font-size: 12px; color: #aaa; font-weight: 300; }

        .fg-course-list { display: flex; flex-direction: column; gap: 20px; }
        .fg-course-card {
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.07);
          border-radius: 12px;
          overflow: hidden;
        }
        .fg-course-header {
          padding: 18px 22px;
          border-bottom: 0.5px solid rgba(0,0,0,0.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .fg-course-title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 4px; }
        .fg-course-title { font-size: 16px; font-weight: 600; color: #111; }
        .fg-tahun-pill {
          font-size: 11px;
          font-weight: 500;
          color: #555;
          background: #f0ede8;
          border-radius: 999px;
          padding: 2px 10px;
        }
        .fg-status-pill {
          font-size: 11px;
          font-weight: 500;
          border-radius: 999px;
          padding: 2px 10px;
        }
        .fg-status-pill.published { background: #f0faf5; color: #1f6b45; border: 0.5px solid #a8d8bc; }
        .fg-status-pill.draft { background: #fdf8ee; color: #8a6200; border: 0.5px solid #e8d08a; }

        .fg-course-weights { font-size: 12px; color: #999; font-weight: 300; }
        .fg-student-count { font-size: 12px; font-weight: 500; color: #666; white-space: nowrap; }

        .fg-table-wrap { overflow-x: auto; }
        .fg-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .fg-table th {
          text-align: left;
          padding: 10px 12px;
          font-size: 11px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #999;
          background: #faf9f6;
          border-bottom: 0.5px solid rgba(0,0,0,0.06);
          white-space: nowrap;
        }
        .fg-table th.num, .fg-table td.num { text-align: right; }
        .fg-table th.fg-sortable { cursor: pointer; user-select: none; }
        .fg-table th.fg-sortable:hover { color: #111; }
        .fg-table td {
          padding: 10px 12px;
          border-bottom: 0.5px solid rgba(0,0,0,0.04);
          color: #222;
          white-space: nowrap;
        }
        .fg-table tbody tr:last-child td { border-bottom: none; }
        .fg-table tbody tr:hover { background: #faf9f6; }
        .fg-table td.muted { color: #bbb; font-size: 12px; }
        .fg-table td.mono { font-family: monospace; font-size: 12px; color: #555; }
        .fg-table td.name { font-weight: 500; color: #111; white-space: normal; min-width: 150px; }
        .fg-table td.num { font-family: 'Monaco', 'Courier', monospace; font-size: 12.5px; }
        .fg-table td.sub { color: #666; }
        .fg-table td.final { font-weight: 600; color: #1f6b45; }

        .fg-actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
        .fg-btn-sm {
          font-family: 'Sora', system-ui, sans-serif;
          font-size: 11px;
          font-weight: 500;
          border-radius: 6px;
          padding: 4px 10px;
          cursor: pointer;
          border: 0.5px solid rgba(0,0,0,0.14);
          background: #fff;
          color: #333;
          transition: all 0.15s;
        }
        .fg-btn-sm:hover { border-color: #111; color: #111; }
        .fg-btn-sm.danger { color: #b42318; border-color: rgba(180,35,24,0.25); }
        .fg-btn-sm.danger:hover { background: #fef3f2; border-color: #b42318; }
        .fg-btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }

        .fg-empty, .fg-course-empty {
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.07);
          border-radius: 12px;
          padding: 48px 24px;
          text-align: center;
          color: #999;
          font-size: 14px;
          font-weight: 300;
        }
        .fg-course-empty { border: none; border-radius: 0; padding: 32px 24px; }

        .fg-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
          padding: 20px;
        }
        .fg-modal {
          background: #fff;
          border-radius: 14px;
          width: 100%;
          max-width: 520px;
          padding: 24px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.18);
        }
        .fg-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
        }
        .fg-modal-title { font-size: 17px; font-weight: 600; color: #111; }
        .fg-modal-close {
          background: none;
          border: none;
          font-size: 20px;
          color: #999;
          cursor: pointer;
          line-height: 1;
        }
        .fg-modal-close:hover { color: #111; }

        .fg-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .fg-form-full { grid-column: 1 / -1; }
        .fg-form-field { display: flex; flex-direction: column; gap: 5px; }
        .fg-form-error {
          background: #fef3f2;
          color: #b42318;
          border: 0.5px solid #fecdca;
          border-radius: 8px;
          padding: 9px 12px;
          font-size: 12.5px;
          margin-bottom: 14px;
        }
        .fg-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 20px;
        }
        .fg-btn-cancel {
          font-family: 'Sora', system-ui, sans-serif;
          font-size: 13px;
          color: #666;
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.15);
          border-radius: 8px;
          padding: 9px 16px;
          cursor: pointer;
        }
        .fg-btn-save {
          font-family: 'Sora', system-ui, sans-serif;
          font-size: 13px;
          font-weight: 600;
          color: #fff;
          background: #111;
          border: none;
          border-radius: 8px;
          padding: 9px 18px;
          cursor: pointer;
        }
        .fg-btn-save:disabled { opacity: 0.5; cursor: not-allowed; }

        @media (max-width: 768px) {
          .fg-body { padding: 24px 20px 60px; }
          .fg-topbar { padding: 0 20px; }
          .fg-email { display: none; }
          .fg-stat-grid { grid-template-columns: repeat(2, 1fr); }
          .fg-nav { gap: 12px; overflow-x: auto; }
          .fg-form-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="fg-root">
        <header className="fg-topbar">
          <Link href="/dashboard" className="fg-wordmark">
            evaluations
          </Link>
          <nav className="fg-nav">
            <Link href="/admin" className="fg-nav-link">
              Dashboard
            </Link>
            <Link href="/admin/evaluations" className="fg-nav-link">
              Evaluations
            </Link>
            <Link href="/admin/kuliah" className="fg-nav-link">
              Kelola Kuliah
            </Link>
            <Link href="/admin/final-grades" className="fg-nav-link active">
              Final Grades
            </Link>
            <Link href="/admin/kelompok" className="fg-nav-link">
              Penilaian Kelompok
            </Link>
          </nav>
          <div className="fg-user">
            <span className="fg-email">{session.user.email}</span>
            <div className="fg-avatar">{userInitial}</div>
            <LogoutButton className="fg-logout" />
          </div>
        </header>

        <main className="fg-body">
          <div className="fg-header">
            <div>
              <h1 className="fg-title">Final Grades</h1>
              <p className="fg-subtitle">
                Kelola nilai akhir mahasiswa pada <code>student_final_grades</code>{" "}
                berdasarkan mata kuliah dan tahun.
              </p>
            </div>
          </div>

          <FinalGradesClient
            courses={courses}
            allCourses={allCourses}
            allStudents={allStudents}
          />
        </main>
      </div>
    </>
  )
}
