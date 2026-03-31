import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/app/src/lib/prisma"
import LogoutButton from "../dashboard/LogoutButton"

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

async function getAdminData() {
  const [groups, submissions, students, courses] = await Promise.all([
    prisma.group.findMany({
      select: { nrp: true, idkuliah: true },
    }),
    prisma.submission.findMany({
      select: { nrp: true, idkuliah: true },
    }),
    prisma.userNilai.findMany({
      select: { nrp: true, nama: true, email: true },
    }),
    prisma.kuliah.findMany({
      select: { idkuliah: true, matkul: true, tahun: true },
      orderBy: { idkuliah: "asc" },
    }),
  ])

  const studentMap = new Map(students.map((s) => [s.nrp, s]))
  const submittedSet = new Set(submissions.map((s) => `${s.nrp}:${s.idkuliah}`))

  // Group members per course
  const courseGroups = new Map<number, string[]>()
  for (const g of groups) {
    if (!g.nrp || !g.idkuliah) continue
    if (!courseGroups.has(g.idkuliah)) courseGroups.set(g.idkuliah, [])
    courseGroups.get(g.idkuliah)!.push(g.nrp)
  }

  const courseData = courses
    .filter((c) => courseGroups.has(c.idkuliah))
    .map((c) => {
      const members = courseGroups.get(c.idkuliah) ?? []
      const pending = members.filter(
        (nrp) => !submittedSet.has(`${nrp}:${c.idkuliah}`)
      )
      const submitted = members.length - pending.length

      return {
        idkuliah: c.idkuliah,
        matkul: c.matkul ?? "Untitled course",
        tahun: c.tahun ?? "—",
        total: members.length,
        submitted,
        pending: pending.map((nrp) => ({
          nrp,
          nama: studentMap.get(nrp)?.nama ?? nrp,
          email: studentMap.get(nrp)?.email ?? "—",
        })),
      }
    })

  const totalPending = courseData.reduce((sum, c) => sum + c.pending.length, 0)
  const totalAssignments = courseData.reduce((sum, c) => sum + c.total, 0)
  const totalSubmitted = courseData.reduce((sum, c) => sum + c.submitted, 0)

  return { courseData, totalPending, totalAssignments, totalSubmitted }
}

export default async function AdminPage() {
  const session = await getServerSession()

  if (!session?.user?.email) redirect("/login")
  if (ADMIN_EMAIL && session.user.email !== ADMIN_EMAIL) redirect("/dashboard")

  const { courseData, totalPending, totalAssignments, totalSubmitted } =
    await getAdminData()

  const userInitial = session.user.email.charAt(0).toUpperCase()

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .ad-root { min-height: 100dvh; background: #f5f4f0; font-family: 'Sora', system-ui, sans-serif; color: #111; }

        .ad-topbar {
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
        .ad-wordmark { font-family: 'Sora', system-ui, sans-serif; font-size: 19px; color: #111; letter-spacing: -0.3px; text-decoration: none; }
        .ad-user { display: flex; align-items: center; gap: 10px; }
        .ad-avatar { width: 30px; height: 30px; border-radius: 50%; background: #141414; color: #efefef; font-size: 12px; font-weight: 500; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ad-email { font-size: 13px; color: #999; }

        .ad-body { max-width: 860px; margin: 0 auto; padding: 48px 40px 80px; }

        .ad-title { font-family: 'Sora', system-ui, sans-serif; font-size: 30px; font-weight: 600; color: #111; margin-bottom: 4px; }
        .ad-subtitle { font-size: 14px; color: #aaa; font-weight: 300; margin-bottom: 36px; }

        .stat-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 40px; }

        .stat-card { background: #fff; border: 0.5px solid rgba(0,0,0,0.07); border-radius: 12px; padding: 24px 26px 22px; }
        .stat-label { font-size: 11px; font-weight: 500; letter-spacing: 0.07em; text-transform: uppercase; color: #bbb; margin-bottom: 14px; }
        .stat-value { font-family: 'Sora', system-ui, sans-serif; font-size: 48px; line-height: 1; margin-bottom: 6px; }
        .stat-value.neutral  { color: #111; }
        .stat-value.positive { color: #1f6b45; }
        .stat-value.warning  { color: #a05a00; }
        .stat-sub { font-size: 13px; color: #bbb; font-weight: 300; }
        .stat-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 6px; vertical-align: middle; position: relative; top: -1px; }
        .dot-positive { background: #2d8a5e; }
        .dot-warning  { background: #c97d10; }

        .ad-section-title { font-size: 12px; font-weight: 500; letter-spacing: 0.07em; text-transform: uppercase; color: #bbb; margin-bottom: 14px; }

        .course-list { display: flex; flex-direction: column; gap: 12px; }

        .course-card { background: #fff; border: 0.5px solid rgba(0,0,0,0.07); border-radius: 12px; overflow: hidden; }

        .course-header { padding: 18px 22px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .course-info { display: flex; flex-direction: column; gap: 3px; }
        .course-name { font-size: 15px; font-weight: 500; color: #111; }
        .course-year { font-size: 12px; color: #bbb; font-weight: 300; }

        .course-stats { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }

        .progress-wrap { display: flex; align-items: center; gap: 8px; }
        .progress-bar { width: 80px; height: 5px; background: #f0f0f0; border-radius: 99px; overflow: hidden; }
        .progress-fill { height: 100%; border-radius: 99px; background: #2d8a5e; }
        .progress-text { font-size: 12px; color: #999; white-space: nowrap; }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 500;
          padding: 4px 10px;
          border-radius: 20px;
          white-space: nowrap;
        }
        .badge-ok      { background: #f0faf5; color: #2d6e4e; border: 0.5px solid #a8d8bc; }
        .badge-pending { background: #fdf8ee; color: #8a6200; border: 0.5px solid #e8d08a; }
        .badge-dot { width: 6px; height: 6px; border-radius: 50%; }
        .badge-ok .badge-dot      { background: #2d8a5e; }
        .badge-pending .badge-dot { background: #c97d10; }

        .student-list { border-top: 0.5px solid rgba(0,0,0,0.06); }

        .student-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 11px 22px;
          border-bottom: 0.5px solid rgba(0,0,0,0.04);
          gap: 12px;
        }
        .student-row:last-child { border-bottom: none; }

        .student-left { display: flex; align-items: center; gap: 10px; }
        .student-avatar { width: 26px; height: 26px; border-radius: 50%; background: #f0ede8; color: #888; font-size: 11px; font-weight: 500; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .student-nama { font-size: 13px; font-weight: 500; color: #333; }
        .student-email { font-size: 12px; color: #bbb; font-weight: 300; }
        .student-nrp { font-size: 11px; color: #ccc; font-family: monospace; }

        .ad-all-done { text-align: center; padding: 60px 24px; color: #ccc; font-size: 14px; font-weight: 300; }

        .ad-logout {
          font-family: 'Sora', system-ui, sans-serif;
          font-size: 13px;
          color: #999;
          background: none;
          border: 0.5px solid rgba(0,0,0,0.12);
          border-radius: 6px;
          padding: 5px 12px;
          cursor: pointer;
          transition: color 0.15s, border-color 0.15s;
        }
        .ad-logout:hover { color: #111; border-color: rgba(0,0,0,0.3); }

        @media (max-width: 640px) {
          .ad-body { padding: 28px 20px 60px; }
          .ad-topbar { padding: 0 20px; }
          .ad-email { display: none; }
          .stat-grid { grid-template-columns: 1fr; }
          .progress-wrap { display: none; }
          .student-email { display: none; }
        }
      `}</style>

      <div className="ad-root">
        <header className="ad-topbar">
          <Link href="/dashboard" className="ad-wordmark">evaluations</Link>
          <div className="ad-user">
            <span className="ad-email">{session.user.email}</span>
            <div className="ad-avatar">{userInitial}</div>
            <LogoutButton className="ad-logout" />
          </div>
        </header>

        <div className="ad-body">
          <h1 className="ad-title">Admin</h1>
          <p className="ad-subtitle">Submission status across all courses and students.</p>

          <div className="stat-grid">
            <div className="stat-card">
              <p className="stat-label">Total assignments</p>
              <p className="stat-value neutral">{totalAssignments}</p>
              <p className="stat-sub">student × course pairs</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Submitted</p>
              <p className="stat-value positive">{totalSubmitted}</p>
              <p className="stat-sub">
                <span className="stat-dot dot-positive" />
                evaluations completed
              </p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Not yet submitted</p>
              <p className="stat-value warning">{totalPending}</p>
              <p className="stat-sub">
                <span className="stat-dot dot-warning" />
                evaluations pending
              </p>
            </div>
          </div>

          <p className="ad-section-title">Pending by course</p>

          {courseData.length === 0 ? (
            <p className="ad-all-done">No courses found.</p>
          ) : totalPending === 0 ? (
            <p className="ad-all-done">All students have submitted their evaluations.</p>
          ) : (
            <div className="course-list">
              {courseData.map((course) => {
                const pct = course.total > 0
                  ? Math.round((course.submitted / course.total) * 100)
                  : 100
                const allDone = course.pending.length === 0

                return (
                  <div key={course.idkuliah} className="course-card">
                    <div className="course-header">
                      <div className="course-info">
                        <span className="course-name">{course.matkul}</span>
                        <span className="course-year">{course.tahun}</span>
                      </div>
                      <div className="course-stats">
                        <div className="progress-wrap">
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="progress-text">{course.submitted}/{course.total}</span>
                        </div>
                        {allDone ? (
                          <span className="badge badge-ok">
                            <span className="badge-dot" />
                            All done
                          </span>
                        ) : (
                          <span className="badge badge-pending">
                            <span className="badge-dot" />
                            {course.pending.length} pending
                          </span>
                        )}
                      </div>
                    </div>

                    {course.pending.length > 0 && (
                      <div className="student-list">
                        {course.pending.map((student) => (
                          <div key={student.nrp} className="student-row">
                            <div className="student-left">
                              <div className="student-avatar">
                                {(student.nama || student.nrp).charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="student-nama">{student.nama || student.nrp}</p>
                                <p className="student-email">{student.email}</p>
                              </div>
                            </div>
                            <span className="student-nrp">{student.nrp}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
