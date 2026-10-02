import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import LogoutButton from "../../../dashboard/LogoutButton"
import CourseForm from "../CourseForm"

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

export default async function NewCoursePage() {
  const session = await getServerSession()

  if (!session?.user?.email) redirect("/login")
  if (ADMIN_EMAIL && session.user.email !== ADMIN_EMAIL) redirect("/dashboard")

  const userInitial = session.user.email.charAt(0).toUpperCase()

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .nc-root { min-height: 100dvh; background: #f5f4f0; font-family: 'Sora', system-ui, sans-serif; color: #111; }

        .nc-topbar {
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
        .nc-wordmark { font-family: 'Sora', system-ui, sans-serif; font-size: 19px; color: #111; letter-spacing: -0.3px; text-decoration: none; font-weight: 600; }
        
        .nc-nav { display: flex; align-items: center; gap: 20px; }
        .nc-nav-link { font-size: 13px; color: #666; text-decoration: none; transition: color 0.15s; }
        .nc-nav-link:hover { color: #111; }

        .nc-user { display: flex; align-items: center; gap: 10px; }
        .nc-avatar { width: 30px; height: 30px; border-radius: 50%; background: #141414; color: #efefef; font-size: 12px; font-weight: 500; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .nc-email { font-size: 13px; color: #999; }

        .nc-body { max-width: 920px; margin: 0 auto; padding: 36px 40px 80px; }

        .nc-breadcrumbs {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #888;
          margin-bottom: 16px;
        }
        .nc-bc-link { color: #888; text-decoration: none; transition: color 0.15s; }
        .nc-bc-link:hover { color: #111; }
        .nc-bc-sep { color: #ccc; }
        .nc-bc-cur { color: #111; font-weight: 500; }

        .nc-header { margin-bottom: 28px; }
        .nc-title { font-size: 28px; font-weight: 600; color: #111; margin-bottom: 6px; }
        .nc-subtitle { font-size: 14px; color: #777; font-weight: 300; line-height: 1.5; }

        .nc-logout {
          font-family: 'Sora', system-ui, sans-serif;
          font-size: 13px;
          color: #999;
          background: none;
          border: 0.5px solid rgba(0,0,0,0.12);
          border-radius: 6px;
          padding: 5px 12px;
          cursor: pointer;
        }
        .nc-logout:hover { color: #111; border-color: rgba(0,0,0,0.3); }

        @media (max-width: 640px) {
          .nc-body { padding: 24px 20px 60px; }
          .nc-topbar { padding: 0 20px; }
          .nc-email { display: none; }
        }
      `}</style>

      <div className="nc-root">
        <header className="nc-topbar">
          <Link href="/dashboard" className="nc-wordmark">evaluations</Link>
          <nav className="nc-nav">
            <Link href="/admin" className="nc-nav-link">
              Dashboard
            </Link>
            <Link href="/admin/evaluations" className="nc-nav-link">
              Evaluations
            </Link>
            <Link href="/admin/kuliah" className="nc-nav-link">
              Kelola Kuliah
            </Link>
          </nav>
          <div className="nc-user">
            <span className="nc-email">{session.user.email}</span>
            <div className="nc-avatar">{userInitial}</div>
            <LogoutButton className="nc-logout" />
          </div>
        </header>

        <main className="nc-body">
          <div className="nc-breadcrumbs">
            <Link href="/admin" className="nc-bc-link">Admin</Link>
            <span className="nc-bc-sep">/</span>
            <Link href="/admin/kuliah" className="nc-bc-link">Kelola Kuliah</Link>
            <span className="nc-bc-sep">/</span>
            <span className="nc-bc-cur">Buat Kuliah Baru</span>
          </div>

          <div className="nc-header">
            <h1 className="nc-title">Buat Mata Kuliah Baru</h1>
            <p className="nc-subtitle">
              Tentukan nama mata kuliah, tahun akademik, rincian kriteria penilaian (judul &amp; rubrik), serta bobot persentase.
              Sesuai aturan, <strong>total bobot keseluruhan harus tepat 100%</strong>.
            </p>
          </div>

          <CourseForm />
        </main>
      </div>
    </>
  )
}
