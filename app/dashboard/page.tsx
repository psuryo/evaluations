import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { prisma } from "@/app/src/lib/prisma"
import Link from "next/link"
import LogoutButton from "./LogoutButton"

async function getDashboardStats(nrp: string) {
  // Only courses where the student has an actual group_id require evaluation
  const studentGroups = await prisma.group.findMany({
    where: { nrp },
    select: { idkuliah: true, group_id: true },
  })

  const allCourseIds = studentGroups
    .map((g) => g.idkuliah)
    .filter(Boolean) as number[]

  // Courses without a group_id are auto-submitted — only those with group_id need evaluation
  const requiresEvalIds = studentGroups
    .filter((g) => g.group_id)
    .map((g) => g.idkuliah)
    .filter(Boolean) as number[]

  const totalAssignedCourses = requiresEvalIds.length

  const [completedSubmissions, coursesWithGrades] = await Promise.all([
    prisma.submission.count({
      where: { nrp, idkuliah: { in: requiresEvalIds } },
    }),
    prisma.kuliah.count({
      where: { nilai: { some: {} } },
    }),
  ])

  const pendingEvaluations = Math.max(0, totalAssignedCourses - completedSubmissions)

  return {
    completedSubmissions,
    pendingEvaluations,
    coursesWithGrades,
    totalAssignedCourses,
    allCourseIds,
  }
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ viewAs?: string }>
}) {
  const session = await getServerSession()

  if (!session) {
    redirect("/login")
  }

  const userEmail = session.user?.email ?? ""
  const isAdmin = !!process.env.ADMIN_EMAIL && userEmail === process.env.ADMIN_EMAIL
  const { viewAs } = await searchParams
  const viewingAs = isAdmin && viewAs ? viewAs : null

  let nrp: string | null = null
  let viewingStudent: { nrp: string; nama: string | null } | null = null

  if (viewingAs) {
    viewingStudent = await prisma.userNilai.findUnique({
      where: { nrp: viewingAs },
      select: { nrp: true, nama: true },
    })
    nrp = viewingAs
  } else {
    const student = await prisma.userNilai.findUnique({
      where: { email: userEmail },
      select: { nrp: true },
    })
    nrp = student?.nrp ?? null
  }

  const stats = await getDashboardStats(nrp ?? "")
  const userInitial = userEmail.charAt(0).toUpperCase()

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .db-root {
          min-height: 100dvh;
          background: #f5f4f0;
          font-family: 'Sora', system-ui, sans-serif;
          color: #111;
        }

        .db-topbar {
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

        .db-wordmark {
          font-family: 'Sora', system-ui, sans-serif;
          font-size: 19px;
          color: #111;
          letter-spacing: -0.3px;
        }

        .db-user {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .db-avatar {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: #141414;
          color: #efefef;
          font-size: 12px;
          font-weight: 500;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .db-email {
          font-size: 13px;
          color: #999;
        }

        .db-body {
          max-width: 860px;
          margin: 0 auto;
          padding: 48px 40px 80px;
        }

        .db-title {
          font-family: 'Sora', system-ui, sans-serif;
          font-size: 30px;
          font-weight: 600;
          color: #111;
          margin-bottom: 4px;
        }

        .db-subtitle {
          font-size: 14px;
          color: #aaa;
          font-weight: 300;
          margin-bottom: 36px;
        }

        .stat-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .stat-card {
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.07);
          border-radius: 12px;
          padding: 24px 26px 22px;
        }

        .stat-label {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: #bbb;
          margin-bottom: 14px;
        }

        .stat-value {
          font-family: 'Sora', system-ui, sans-serif;
          font-size: 48px;
          line-height: 1;
          margin-bottom: 6px;
        }

        .stat-value.neutral  { color: #111; }
        .stat-value.positive { color: #1f6b45; }
        .stat-value.warning  { color: #a05a00; }

        .stat-sub {
          font-size: 13px;
          color: #bbb;
          font-weight: 300;
        }

        .stat-dot {
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          margin-right: 6px;
          vertical-align: middle;
          position: relative;
          top: -1px;
        }

        .dot-positive { background: #2d8a5e; }
        .dot-warning  { background: #c97d10; }

        .db-nav-link {
          font-family: 'Sora', system-ui, sans-serif;
          font-size: 13px;
          font-weight: 500;
          color: #fff;
          background: #111;
          border-radius: 6px;
          padding: 6px 14px;
          text-decoration: none;
          transition: opacity 0.15s;
        }
        .db-nav-link:hover { opacity: 0.8; }

        .db-grades-card {
          margin-top: 20px;
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.07);
          border-radius: 12px;
          padding: 20px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .db-grades-card-info { display: flex; flex-direction: column; gap: 4px; }
        .db-grades-card-title { font-size: 14px; font-weight: 500; color: #111; }
        .db-grades-card-sub { font-size: 12px; color: #bbb; font-weight: 300; }

        .db-grades-btn {
          font-family: 'Sora', system-ui, sans-serif;
          font-size: 13px;
          font-weight: 500;
          color: #fff;
          background: #111;
          border-radius: 6px;
          padding: 6px 14px;
          text-decoration: none;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .db-grades-btn:hover { opacity: 0.8; }

        .db-grades-locked {
          font-size: 12px;
          color: #bbb;
          background: #f5f5f5;
          border: 0.5px solid rgba(0,0,0,0.08);
          border-radius: 6px;
          padding: 6px 14px;
          white-space: nowrap;
          flex-shrink: 0;
          cursor: not-allowed;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .db-impersonate-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          background: #fff8ec;
          border: 0.5px solid #e8c96a;
          border-radius: 10px;
          padding: 12px 18px;
          margin-bottom: 28px;
          font-size: 13px;
          color: #7a5200;
        }
        .db-impersonate-banner strong { font-weight: 600; }
        .db-back-link {
          font-size: 12px;
          color: #7a5200;
          text-decoration: none;
          border: 0.5px solid #e8c96a;
          border-radius: 6px;
          padding: 4px 10px;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .db-back-link:hover { background: #fff3d0; }

        .db-logout {
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
        .db-logout:hover { color: #111; border-color: rgba(0,0,0,0.3); }

        @media (max-width: 640px) {
          .stat-grid { grid-template-columns: 1fr; }
          .db-body { padding: 28px 20px 60px; }
          .db-topbar { padding: 0 20px; }
          .db-email { display: none; }
        }
      `}</style>

      <div className="db-root">
        <header className="db-topbar">
          <p className="db-wordmark">evaluations</p>
          <div className="db-user">
            <span className="db-email">{userEmail}</span>
            <div className="db-avatar">{userInitial}</div>
            <LogoutButton />
          </div>
        </header>

        <div className="db-body">
          {viewingAs && (
            <div className="db-impersonate-banner">
              <span>
                Viewing dashboard for{" "}
                <strong>{viewingStudent?.nama ?? viewingAs}</strong>{" "}
                <span style={{ opacity: 0.6, fontFamily: "monospace", fontSize: "12px" }}>({viewingAs})</span>
              </span>
              <Link href="/admin" className="db-back-link">← Back to admin</Link>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <h1 className="db-title">{viewingAs ? "Student Dashboard" : "Dashboard"}</h1>
            {!viewingAs && <Link href="/evaluate" className="db-nav-link">Start evaluation →</Link>}
          </div>
          <p className="db-subtitle">Group evaluations &amp; grade overview.</p>

          <div className="stat-grid">
            <div className="stat-card">
              <p className="stat-label">Courses with grades</p>
              <p className="stat-value neutral">{stats.coursesWithGrades}</p>
              <p className="stat-sub">mata kuliah have scores</p>
            </div>

            <div className="stat-card">
              <p className="stat-label">Evaluated</p>
              <p className="stat-value positive">{stats.completedSubmissions}</p>
              <p className="stat-sub">
                <span className="stat-dot dot-positive" />
                of {stats.totalAssignedCourses} courses submitted
              </p>
            </div>

            <div className="stat-card">
              <p className="stat-label">Not yet evaluated</p>
              <p className="stat-value warning">{stats.pendingEvaluations}</p>
              <p className="stat-sub">
                <span className="stat-dot dot-warning" />
                courses still pending
              </p>
            </div>
          </div>

          <div className="db-grades-card">
            <div className="db-grades-card-info">
              <span className="db-grades-card-title">Your grades</span>
              {stats.pendingEvaluations > 0 ? (
                <span className="db-grades-card-sub">
                  Complete all evaluations to unlock grades ({stats.pendingEvaluations} remaining)
                </span>
              ) : (
                <span className="db-grades-card-sub">All evaluations submitted — grades are available</span>
              )}
            </div>
            {stats.pendingEvaluations > 0 ? (
              <span className="db-grades-locked">
                🔒 Locked
              </span>
            ) : (
              <Link
                href={viewingAs ? `/grade?viewAs=${viewingAs}` : "/grade"}
                className="db-grades-btn"
              >
                View grades →
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
