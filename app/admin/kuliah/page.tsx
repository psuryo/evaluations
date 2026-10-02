import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/app/src/lib/prisma"
import LogoutButton from "../../dashboard/LogoutButton"
import CourseList from "./CourseList"

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

async function getKuliahManagementData() {
  const [courses, totalStudentsCount, totalNilaiCount] = await Promise.all([
    prisma.kuliah.findMany({
      include: {
        nilai: {
          select: {
            idnilai: true,
            judulkriteria: true,
            kriteria: true,
            bobot: true,
            nrp: true,
          },
        },
        groups: {
          select: {
            id: true,
            nrp: true,
            group_id: true,
          },
        },
        submissions: {
          select: {
            id: true,
            nrp: true,
          },
        },
      },
      orderBy: { idkuliah: "desc" },
    }),
    prisma.userNilai.count(),
    prisma.nilai.count(),
  ])

  const formattedCourses = courses.map((c) => {
    // Unique criteria breakdown
    const criteriaMap = new Map<string, { judulkriteria: string; kriteria: string; bobot: number }>()
    for (const n of c.nilai) {
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
    const totalBobot = criteriaList.reduce((sum, item) => sum + (item.bobot || 0), 0)

    const studentNrps = new Set<string>()
    for (const n of c.nilai) {
      if (n.nrp) studentNrps.add(n.nrp)
    }
    for (const g of c.groups) {
      if (g.nrp) studentNrps.add(g.nrp)
    }

    return {
      idkuliah: c.idkuliah,
      matkul: c.matkul ?? "Untitled",
      tahun: c.tahun ?? "—",
      criteriaList,
      totalBobot,
      totalCriteria: criteriaList.length,
      studentCount: studentNrps.size,
      groupCount: new Set(c.groups.map((g) => g.group_id).filter(Boolean)).size,
      submissionCount: c.submissions.length,
    }
  })

  const totalCriteriaDefinitions = formattedCourses.reduce((sum, c) => sum + c.totalCriteria, 0)
  const valid100CoursesCount = formattedCourses.filter((c) => c.totalBobot === 100).length

  return {
    courses: formattedCourses,
    totalCourses: formattedCourses.length,
    totalStudentsCount,
    totalCriteriaDefinitions,
    valid100CoursesCount,
    totalNilaiCount,
  }
}

export default async function KuliahAdminPage() {
  const session = await getServerSession()

  if (!session?.user?.email) redirect("/login")
  if (ADMIN_EMAIL && session.user.email !== ADMIN_EMAIL) redirect("/dashboard")

  const userInitial = session.user.email.charAt(0).toUpperCase()
  const data = await getKuliahManagementData()

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .km-root { min-height: 100dvh; background: #f5f4f0; font-family: 'Sora', system-ui, sans-serif; color: #111; }

        .km-topbar {
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
        .km-wordmark { font-family: 'Sora', system-ui, sans-serif; font-size: 19px; color: #111; letter-spacing: -0.3px; text-decoration: none; font-weight: 600; }
        
        .km-nav { display: flex; align-items: center; gap: 20px; }
        .km-nav-link { font-size: 13px; color: #666; text-decoration: none; transition: color 0.15s; }
        .km-nav-link:hover { color: #111; }
        .km-nav-link.active { color: #111; font-weight: 600; border-bottom: 2px solid #111; padding: 17px 0 15px; }

        .km-user { display: flex; align-items: center; gap: 10px; }
        .km-avatar { width: 30px; height: 30px; border-radius: 50%; background: #141414; color: #efefef; font-size: 12px; font-weight: 500; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .km-email { font-size: 13px; color: #999; }

        .km-body { max-width: 1060px; margin: 0 auto; padding: 40px 40px 80px; }

        .km-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 32px;
          flex-wrap: wrap;
        }
        .km-title { font-size: 28px; font-weight: 600; color: #111; margin-bottom: 4px; line-height: 1.2; }
        .km-subtitle { font-size: 14px; color: #888; font-weight: 300; }

        .km-btn-new {
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          color: #fff;
          background: #111;
          border-radius: 8px;
          padding: 10px 18px;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: opacity 0.15s, transform 0.1s;
          box-shadow: 0 2px 6px rgba(0,0,0,0.08);
        }
        .km-btn-new:hover { opacity: 0.88; }
        .km-btn-new:active { transform: scale(0.99); }

        .km-stat-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 32px;
        }
        .km-stat-card {
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.07);
          border-radius: 12px;
          padding: 20px 22px;
        }
        .km-stat-label {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: #999;
          margin-bottom: 8px;
        }
        .km-stat-val {
          font-size: 36px;
          font-weight: 600;
          color: #111;
          line-height: 1;
          margin-bottom: 4px;
        }
        .km-stat-sub { font-size: 12px; color: #aaa; font-weight: 300; }

        .km-logout {
          font-family: 'Sora', system-ui, sans-serif;
          font-size: 13px;
          color: #999;
          background: none;
          border: 0.5px solid rgba(0,0,0,0.12);
          border-radius: 6px;
          padding: 5px 12px;
          cursor: pointer;
        }
        .km-logout:hover { color: #111; border-color: rgba(0,0,0,0.3); }

        @media (max-width: 768px) {
          .km-body { padding: 24px 20px 60px; }
          .km-topbar { padding: 0 20px; }
          .km-email { display: none; }
          .km-stat-grid { grid-template-columns: repeat(2, 1fr); }
          .km-header { flex-direction: column; align-items: stretch; }
          .km-btn-new { width: 100%; justify-content: center; }
        }
      `}</style>

      <div className="km-root">
        <header className="km-topbar">
          <Link href="/dashboard" className="km-wordmark">evaluations</Link>
          <nav className="km-nav">
            <Link href="/admin" className="km-nav-link">
              Dashboard
            </Link>
            <Link href="/admin/evaluations" className="km-nav-link">
              Evaluations
            </Link>
            <Link href="/admin/kuliah" className="km-nav-link active">
              Kelola Kuliah
            </Link>
          </nav>
          <div className="km-user">
            <span className="km-email">{session.user.email}</span>
            <div className="km-avatar">{userInitial}</div>
            <LogoutButton className="km-logout" />
          </div>
        </header>

        <main className="km-body">
          <div className="km-header">
            <div>
              <h1 className="km-title">Modul Dosen: Kelola Mata Kuliah</h1>
              <p className="km-subtitle">
                Atur mata kuliah, kriteria penilaian, dan tentukan bobot kriteria dengan syarat total 100%.
              </p>
            </div>
            <Link href="/admin/kuliah/new" className="km-btn-new">
              <span>+</span> Buat Kuliah Baru (Bobot 100%)
            </Link>
          </div>

          {/* Metric Stat Cards */}
          <div className="km-stat-grid">
            <div className="km-stat-card">
              <p className="km-stat-label">Total Kuliah</p>
              <p className="km-stat-val">{data.totalCourses}</p>
              <p className="km-stat-sub">mata kuliah terdaftar</p>
            </div>
            <div className="km-stat-card">
              <p className="km-stat-label">Bobot Valid (100%)</p>
              <p className="km-stat-val" style={{ color: "#1f6b45" }}>{data.valid100CoursesCount}</p>
              <p className="km-stat-sub">kuliah memenuhi syarat</p>
            </div>
            <div className="km-stat-card">
              <p className="km-stat-label">Total Kriteria</p>
              <p className="km-stat-val">{data.totalCriteriaDefinitions}</p>
              <p className="km-stat-sub">komponen penilaian</p>
            </div>
            <div className="km-stat-card">
              <p className="km-stat-label">Total Mahasiswa</p>
              <p className="km-stat-val">{data.totalStudentsCount}</p>
              <p className="km-stat-sub">mahasiswa di database</p>
            </div>
          </div>

          {/* Interactive Course Catalog */}
          <CourseList initialCourses={data.courses} />
        </main>
      </div>
    </>
  )
}
