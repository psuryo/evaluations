import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import EvaluationDashboard from "../EvaluationDashboard"
import LogoutButton from "../../dashboard/LogoutButton"

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

export default async function EvaluationStatusPage() {
  const session = await getServerSession()

  if (!session?.user?.email) redirect("/login")
  if (ADMIN_EMAIL && session.user.email !== ADMIN_EMAIL) redirect("/dashboard")

  const userInitial = session.user.email.charAt(0).toUpperCase()

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .ed-root { min-height: 100dvh; background: #f5f4f0; font-family: 'Sora', system-ui, sans-serif; color: #111; }

        .ed-topbar {
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
        .ed-wordmark { font-family: 'Sora', system-ui, sans-serif; font-size: 19px; color: #111; letter-spacing: -0.3px; text-decoration: none; font-weight: 500; }
        .ed-nav { display: flex; align-items: center; gap: 20px; }
        .ed-nav-link { font-size: 13px; color: #666; text-decoration: none; transition: color 0.15s; }
        .ed-nav-link:hover { color: #111; }
        .ed-nav-link.active { color: #111; font-weight: 500; }
        .ed-user { display: flex; align-items: center; gap: 10px; }
        .ed-avatar { width: 30px; height: 30px; border-radius: 50%; background: #141414; color: #efefef; font-size: 12px; font-weight: 500; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ed-email { font-size: 13px; color: #999; }

        .ed-body { max-width: 1200px; margin: 0 auto; padding: 48px 40px 80px; }

        .ed-header { margin-bottom: 40px; }
        .ed-title { font-family: 'Sora', system-ui, sans-serif; font-size: 30px; font-weight: 600; color: #111; margin-bottom: 8px; }
        .ed-subtitle { font-size: 14px; color: #aaa; font-weight: 300; }

        .ed-logout {
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
        .ed-logout:hover { color: #111; border-color: rgba(0,0,0,0.3); }

        @media (max-width: 640px) {
          .ed-body { padding: 28px 20px 60px; }
          .ed-topbar { padding: 0 20px; }
          .ed-email { display: none; }
          .ed-nav { gap: 12px; }
        }
      `}</style>

      <div className="ed-root">
        <header className="ed-topbar">
          <Link href="/dashboard" className="ed-wordmark">evaluations</Link>
          <nav className="ed-nav">
            <Link href="/admin" className="ed-nav-link">
              Dashboard
            </Link>
            <Link href="/admin/evaluations" className="ed-nav-link active">
              Evaluations
            </Link>
          </nav>
          <div className="ed-user">
            <span className="ed-email">{session.user.email}</span>
            <div className="ed-avatar">{userInitial}</div>
            <LogoutButton className="ed-logout" />
          </div>
        </header>

        <div className="ed-body">
          <div className="ed-header">
            <h1 className="ed-title">Peer Evaluation Status</h1>
            <p className="ed-subtitle">Track completion status for group evaluations across all courses.</p>
          </div>

          <EvaluationDashboard />
        </div>
      </div>
    </>
  )
}
