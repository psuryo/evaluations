import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/app/src/lib/prisma"

async function getCourseList(nrp: string) {
  // All courses that have a group entry for this student
  const groupEntries = await prisma.group.findMany({
    where: { nrp },
    select: { idkuliah: true, group_id: true },
  })

  const idkuliahList = groupEntries
    .map((g) => g.idkuliah)
    .filter(Boolean) as number[]

  const [courses, submissions] = await Promise.all([
    prisma.kuliah.findMany({
      where: { idkuliah: { in: idkuliahList } },
      orderBy: { idkuliah: "asc" },
    }),
    prisma.submission.findMany({
      where: { nrp, idkuliah: { in: idkuliahList } },
      select: { idkuliah: true },
    }),
  ])

  const submittedSet = new Set(submissions.map((s) => s.idkuliah))

  return courses.map((c) => ({
    ...c,
    submitted: submittedSet.has(c.idkuliah),
  }))
}

export default async function EvaluateIndexPage() {
  const session = await getServerSession()
  if (!session?.user?.email) redirect("/login")

  const student = await prisma.userNilai.findUnique({
    where: { email: session.user.email },
  })

  if (!student) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui", background: "#f5f4f0" }}>
        <p style={{ fontSize: 14, color: "#aaa", textAlign: "center" }}>
          No student record found for <strong style={{ color: "#555" }}>{session.user.email}</strong>.<br />
          <span style={{ fontSize: 12 }}>Contact your administrator.</span>
        </p>
      </div>
    )
  }

  const courses = await getCourseList(student.nrp)
  const userInitial = (session.user.email ?? "?").charAt(0).toUpperCase()

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .ev-root { min-height: 100dvh; background: #f5f4f0; font-family: 'DM Sans', system-ui, sans-serif; color: #111; }

        .ev-topbar {
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
        .ev-wordmark { font-family: 'Instrument Serif', Georgia, serif; font-size: 19px; color: #111; letter-spacing: -0.3px; text-decoration: none; }
        .ev-user { display: flex; align-items: center; gap: 10px; }
        .ev-avatar { width: 30px; height: 30px; border-radius: 50%; background: #141414; color: #efefef; font-size: 12px; font-weight: 500; display: flex; align-items: center; justify-content: center; }
        .ev-email { font-size: 13px; color: #999; }

        .ev-body { max-width: 640px; margin: 0 auto; padding: 48px 40px 80px; }
        .ev-heading { font-family: 'Instrument Serif', Georgia, serif; font-size: 30px; font-weight: 400; color: #111; margin-bottom: 4px; }
        .ev-sub { font-size: 14px; color: #aaa; font-weight: 300; margin-bottom: 36px; line-height: 1.5; }

        .ev-list { display: flex; flex-direction: column; gap: 10px; }

        .ev-course-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.07);
          border-radius: 12px;
          padding: 18px 22px;
          text-decoration: none;
          color: inherit;
          transition: border-color 0.15s, box-shadow 0.15s;
          gap: 16px;
        }
        .ev-course-card:hover { border-color: rgba(0,0,0,0.15); box-shadow: 0 2px 12px rgba(0,0,0,0.04); }
        .ev-course-card.done { opacity: 0.6; pointer-events: none; }

        .ev-course-left { display: flex; flex-direction: column; gap: 3px; }
        .ev-course-name { font-size: 15px; font-weight: 500; color: #111; }
        .ev-course-year { font-size: 12px; color: #bbb; font-weight: 300; }

        .ev-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 500;
          padding: 4px 10px;
          border-radius: 20px;
          flex-shrink: 0;
          white-space: nowrap;
        }
        .ev-badge-pending {
          background: #fdf8ee;
          color: #8a6200;
          border: 0.5px solid #e8d08a;
        }
        .ev-badge-done {
          background: #f0faf5;
          color: #2d6e4e;
          border: 0.5px solid #a8d8bc;
        }
        .ev-badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        .ev-badge-pending .ev-badge-dot { background: #c97d10; }
        .ev-badge-done    .ev-badge-dot { background: #2d8a5e; }

        .ev-arrow { font-size: 16px; color: #ccc; margin-left: 4px; }

        .ev-empty {
          text-align: center;
          padding: 60px 24px;
          color: #ccc;
          font-size: 14px;
          font-weight: 300;
        }

        @media (max-width: 640px) {
          .ev-body { padding: 28px 20px 60px; }
          .ev-topbar { padding: 0 20px; }
          .ev-email { display: none; }
        }
      `}</style>

      <div className="ev-root">
        <header className="ev-topbar">
          <Link href="/dashboard" className="ev-wordmark">evaluations</Link>
          <div className="ev-user">
            <span className="ev-email">{session.user.email}</span>
            <div className="ev-avatar">{userInitial}</div>
          </div>
        </header>

        <div className="ev-body">
          <h1 className="ev-heading">Peer evaluation</h1>
          <p className="ev-sub">
            Select a course to evaluate your group members. Each course is independent — you can submit once per course.
          </p>

          {courses.length === 0 ? (
            <p className="ev-empty">No courses assigned yet.</p>
          ) : (
            <div className="ev-list">
              {courses.map((course) => (
                <Link
                  key={course.idkuliah}
                  href={`/evaluate/${course.idkuliah}`}
                  className={`ev-course-card${course.submitted ? " done" : ""}`}
                >
                  <div className="ev-course-left">
                    <span className="ev-course-name">{course.matkul ?? "Untitled course"}</span>
                    <span className="ev-course-year">{course.tahun ?? "—"}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {course.submitted ? (
                      <span className="ev-badge ev-badge-done">
                        <span className="ev-badge-dot" />
                        Submitted
                      </span>
                    ) : (
                      <>
                        <span className="ev-badge ev-badge-pending">
                          <span className="ev-badge-dot" />
                          Pending
                        </span>
                        <span className="ev-arrow">→</span>
                      </>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
