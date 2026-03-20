import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { prisma } from "@/app/src/lib/prisma"

async function getDashboardStats() {
  const [
    totalStudents,
    completedSubmissions,
    coursesWithGrades,
  ] = await Promise.all([
    prisma.userNilai.count(),
    prisma.submission.count(),
    prisma.kuliah.count({
      where: {
        nilai: { some: {} },
      },
    }),
  ])

  const pendingEvaluations = Math.max(0, totalStudents - completedSubmissions)

  return {
    completedSubmissions,
    pendingEvaluations,
    coursesWithGrades,
  }
}

export default async function Dashboard() {
  const session = await getServerSession()

  if (!session) {
    redirect("/login")
  }

  const stats = await getDashboardStats()
  const userEmail = session.user?.email ?? ""
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
          </div>
        </header>

        <div className="db-body">
          <h1 className="db-title">Dashboard</h1>
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
                submissions completed
              </p>
            </div>

            <div className="stat-card">
              <p className="stat-label">Not yet evaluated</p>
              <p className="stat-value warning">{stats.pendingEvaluations}</p>
              <p className="stat-sub">
                <span className="stat-dot dot-warning" />
                pending submissions
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
