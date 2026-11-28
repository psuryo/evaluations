import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/app/src/lib/prisma"
import { isAdminEmail } from "@/app/src/lib/adminAuth"
import LogoutButton from "../../../dashboard/LogoutButton"
import NewNilaiForm from "./NewNilaiForm"

export const dynamic = "force-dynamic"

export default async function NewNilaiPage({
  searchParams,
}: {
  searchParams: Promise<{ idkuliah?: string }>
}) {
  const session = await getServerSession()

  if (!session?.user?.email) redirect("/login")
  if (!isAdminEmail(session.user.email)) redirect("/dashboard")

  const { idkuliah: idParam } = await searchParams
  const initialCourseId = idParam ? parseInt(idParam, 10) : undefined

  const availableCourses = await prisma.kuliah.findMany({
    where: {
      nilai: { none: {} },
    },
    select: {
      idkuliah: true,
      matkul: true,
      tahun: true,
    },
    orderBy: [{ tahun: "desc" }, { idkuliah: "desc" }],
  })

  const formattedCourses = availableCourses.map((c) => ({
    idkuliah: c.idkuliah,
    matkul: c.matkul ?? "Untitled",
    tahun: c.tahun ?? "—",
  }))

  const userInitial = session.user.email.charAt(0).toUpperCase()

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .nn-root { min-height: 100dvh; background: #f5f4f0; font-family: 'Sora', system-ui, sans-serif; color: #111; }

        .nn-topbar {
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
        .nn-wordmark { font-family: 'Sora', system-ui, sans-serif; font-size: 19px; color: #111; letter-spacing: -0.3px; text-decoration: none; font-weight: 600; }

        .nn-nav { display: flex; align-items: center; gap: 20px; }
        .nn-nav-link { font-size: 13px; color: #666; text-decoration: none; transition: color 0.15s; }
        .nn-nav-link:hover { color: #111; }

        .nn-user { display: flex; align-items: center; gap: 10px; }
        .nn-avatar { width: 30px; height: 30px; border-radius: 50%; background: #141414; color: #efefef; font-size: 12px; font-weight: 500; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .nn-email { font-size: 13px; color: #999; }

        .nn-body { max-width: 920px; margin: 0 auto; padding: 36px 40px 80px; }

        .nn-breadcrumbs {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #888;
          margin-bottom: 16px;
        }
        .nn-bc-link { color: #888; text-decoration: none; transition: color 0.15s; }
        .nn-bc-link:hover { color: #111; }
        .nn-bc-sep { color: #ccc; }
        .nn-bc-cur { color: #111; font-weight: 500; }

        .nn-header { margin-bottom: 28px; }
        .nn-title { font-size: 28px; font-weight: 600; color: #111; margin-bottom: 6px; }
        .nn-subtitle { font-size: 14px; color: #777; font-weight: 300; line-height: 1.5; }

        .nn-logout {
          font-family: 'Sora', system-ui, sans-serif;
          font-size: 13px;
          color: #999;
          background: none;
          border: 0.5px solid rgba(0,0,0,0.12);
          border-radius: 6px;
          padding: 5px 12px;
          cursor: pointer;
        }
        .nn-logout:hover { color: #111; border-color: rgba(0,0,0,0.3); }

        @media (max-width: 640px) {
          .nn-body { padding: 24px 20px 60px; }
          .nn-topbar { padding: 0 20px; }
          .nn-email { display: none; }
        }
      `}</style>

      <div className="nn-root">
        <header className="nn-topbar">
          <Link href="/dashboard" className="nn-wordmark">evaluations</Link>
          <nav className="nn-nav">
            <Link href="/admin" className="nn-nav-link">
              Dashboard
            </Link>
            <Link href="/admin/evaluations" className="nn-nav-link">
              Evaluations
            </Link>
            <Link href="/admin/kuliah" className="nn-nav-link">
              Kelola Kuliah
            </Link>
            <Link href="/admin/final-grades" className="nn-nav-link">
              Final Grades
            </Link>
          </nav>
          <div className="nn-user">
            <span className="nn-email">{session.user.email}</span>
            <div className="nn-avatar">{userInitial}</div>
            <LogoutButton className="nn-logout" />
          </div>
        </header>

        <main className="nn-body">
          <div className="nn-breadcrumbs">
            <Link href="/admin" className="nn-bc-link">Admin</Link>
            <span className="nn-bc-sep">/</span>
            <Link href="/admin/kuliah" className="nn-bc-link">Kelola Kuliah</Link>
            <span className="nn-bc-sep">/</span>
            <span className="nn-bc-cur">Input Nilai Baru</span>
          </div>

          <div className="nn-header">
            <h1 className="nn-title">Input Nilai Baru</h1>
            <p className="nn-subtitle">
              Pilih mata kuliah yang belum digunakan pada tabel <code>nilai</code>, tentukan kriteria &amp; bobot (total 100 poin), lalu daftarkan mahasiswa jika diperlukan.
            </p>
          </div>

          <NewNilaiForm
            availableCourses={formattedCourses}
            initialCourseId={Number.isInteger(initialCourseId) ? initialCourseId : undefined}
          />
        </main>
      </div>
    </>
  )
}
