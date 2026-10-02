import { getServerSession } from "next-auth"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/app/src/lib/prisma"
import LogoutButton from "../../../../dashboard/LogoutButton"
import CourseForm from "../../CourseForm"

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ idkuliah: string }>
}) {
  const session = await getServerSession()

  if (!session?.user?.email) redirect("/login")
  if (ADMIN_EMAIL && session.user.email !== ADMIN_EMAIL) redirect("/dashboard")

  const { idkuliah: idStr } = await params
  const idkuliah = parseInt(idStr, 10)
  if (isNaN(idkuliah)) notFound()

  const course = await prisma.kuliah.findUnique({
    where: { idkuliah },
    include: {
      nilai: {
        select: {
          judulkriteria: true,
          kriteria: true,
          bobot: true,
          nrp: true,
        },
      },
    },
  })

  if (!course) notFound()

  // Extract unique criteria
  const criteriaMap = new Map<string, { judulkriteria: string; kriteria: string; bobot: number }>()
  for (const n of course.nilai) {
    if (!n.judulkriteria) continue
    const key = `${n.judulkriteria}:::${n.kriteria ?? ""}`
    if (!criteriaMap.has(key)) {
      criteriaMap.set(key, {
        judulkriteria: n.judulkriteria,
        kriteria: n.kriteria ?? "",
        bobot: n.bobot ?? 0,
      })
    }
  }

  const criteriaList = Array.from(criteriaMap.values())
  const enrolledStudents = Array.from(
    new Set(course.nilai.map((n) => n.nrp).filter(Boolean))
  ) as string[]

  const userInitial = session.user.email.charAt(0).toUpperCase()

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .ec-root { min-height: 100dvh; background: #f5f4f0; font-family: 'Sora', system-ui, sans-serif; color: #111; }

        .ec-topbar {
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
        .ec-wordmark { font-family: 'Sora', system-ui, sans-serif; font-size: 19px; color: #111; letter-spacing: -0.3px; text-decoration: none; font-weight: 600; }
        
        .ec-nav { display: flex; align-items: center; gap: 20px; }
        .ec-nav-link { font-size: 13px; color: #666; text-decoration: none; transition: color 0.15s; }
        .ec-nav-link:hover { color: #111; }

        .ec-user { display: flex; align-items: center; gap: 10px; }
        .ec-avatar { width: 30px; height: 30px; border-radius: 50%; background: #141414; color: #efefef; font-size: 12px; font-weight: 500; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ec-email { font-size: 13px; color: #999; }

        .ec-body { max-width: 920px; margin: 0 auto; padding: 36px 40px 80px; }

        .ec-breadcrumbs {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #888;
          margin-bottom: 16px;
        }
        .ec-bc-link { color: #888; text-decoration: none; transition: color 0.15s; }
        .ec-bc-link:hover { color: #111; }
        .ec-bc-sep { color: #ccc; }
        .ec-bc-cur { color: #111; font-weight: 500; }

        .ec-header { margin-bottom: 28px; }
        .ec-title { font-size: 28px; font-weight: 600; color: #111; margin-bottom: 6px; }
        .ec-subtitle { font-size: 14px; color: #777; font-weight: 300; }

        .ec-logout {
          font-family: 'Sora', system-ui, sans-serif;
          font-size: 13px;
          color: #999;
          background: none;
          border: 0.5px solid rgba(0,0,0,0.12);
          border-radius: 6px;
          padding: 5px 12px;
          cursor: pointer;
        }
        .ec-logout:hover { color: #111; border-color: rgba(0,0,0,0.3); }

        @media (max-width: 640px) {
          .ec-body { padding: 24px 20px 60px; }
          .ec-topbar { padding: 0 20px; }
          .ec-email { display: none; }
        }
      `}</style>

      <div className="ec-root">
        <header className="ec-topbar">
          <Link href="/dashboard" className="ec-wordmark">evaluations</Link>
          <nav className="ec-nav">
            <Link href="/admin" className="ec-nav-link">
              Dashboard
            </Link>
            <Link href="/admin/evaluations" className="ec-nav-link">
              Evaluations
            </Link>
            <Link href="/admin/kuliah" className="ec-nav-link">
              Kelola Kuliah
            </Link>
          </nav>
          <div className="ec-user">
            <span className="ec-email">{session.user.email}</span>
            <div className="ec-avatar">{userInitial}</div>
            <LogoutButton className="ec-logout" />
          </div>
        </header>

        <main className="ec-body">
          <div className="ec-breadcrumbs">
            <Link href="/admin" className="ec-bc-link">Admin</Link>
            <span className="ec-bc-sep">/</span>
            <Link href="/admin/kuliah" className="ec-bc-link">Kelola Kuliah</Link>
            <span className="ec-bc-sep">/</span>
            <span className="ec-bc-cur">Edit {course.matkul}</span>
          </div>

          <div className="ec-header">
            <h1 className="ec-title">Edit Mata Kuliah &amp; Kriteria</h1>
            <p className="ec-subtitle">
              Sesuaikan informasi mata kuliah, kriteria penilaian, dan pastikan total bobot tetap 100%.
            </p>
          </div>

          <CourseForm
            isEditing={true}
            initialData={{
              idkuliah: course.idkuliah,
              matkul: course.matkul ?? "",
              tahun: course.tahun ?? "",
              criteriaList: criteriaList.length > 0 ? criteriaList : [
                { judulkriteria: "Tugas", kriteria: "Penugasan berkala", bobot: 30 },
                { judulkriteria: "UTS", kriteria: "Ujian Tengah Semester", bobot: 35 },
                { judulkriteria: "UAS", kriteria: "Ujian Akhir Semester", bobot: 35 },
              ],
              students: enrolledStudents,
            }}
          />
        </main>
      </div>
    </>
  )
}
