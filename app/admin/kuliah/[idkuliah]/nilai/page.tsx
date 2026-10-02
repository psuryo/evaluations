import { getServerSession } from "next-auth"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/app/src/lib/prisma"
import LogoutButton from "../../../../dashboard/LogoutButton"
import GradeMatrixEditor from "./GradeMatrixEditor"

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

export default async function CourseGradesPage({
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
        include: {
          usernilai: { select: { nama: true, email: true } },
        },
        orderBy: [{ nrp: "asc" }, { idnilai: "asc" }],
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

  // Group student grades
  const studentMap = new Map<
    string,
    {
      nrp: string
      nama: string
      email: string
      grades: Record<string, { idnilai: number; grade: number | null; bobot: number }>
    }
  >()

  for (const n of course.nilai) {
    if (!n.nrp) continue
    if (!studentMap.has(n.nrp)) {
      studentMap.set(n.nrp, {
        nrp: n.nrp,
        nama: n.usernilai?.nama ?? n.nrp,
        email: n.usernilai?.email ?? "—",
        grades: {},
      })
    }

    if (n.judulkriteria) {
      studentMap.get(n.nrp)!.grades[n.judulkriteria] = {
        idnilai: n.idnilai,
        grade: n.grade !== null ? Number(n.grade) : null,
        bobot: n.bobot ?? 0,
      }
    }
  }

  const students = Array.from(studentMap.values())
  const userInitial = session.user.email.charAt(0).toUpperCase()

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .cg-root { min-height: 100dvh; background: #f5f4f0; font-family: 'Sora', system-ui, sans-serif; color: #111; }

        .cg-topbar {
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
        .cg-wordmark { font-family: 'Sora', system-ui, sans-serif; font-size: 19px; color: #111; letter-spacing: -0.3px; text-decoration: none; font-weight: 600; }
        
        .cg-nav { display: flex; align-items: center; gap: 20px; }
        .cg-nav-link { font-size: 13px; color: #666; text-decoration: none; transition: color 0.15s; }
        .cg-nav-link:hover { color: #111; }

        .cg-user { display: flex; align-items: center; gap: 10px; }
        .cg-avatar { width: 30px; height: 30px; border-radius: 50%; background: #141414; color: #efefef; font-size: 12px; font-weight: 500; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .cg-email { font-size: 13px; color: #999; }

        .cg-body { max-width: 1200px; margin: 0 auto; padding: 36px 40px 80px; }

        .cg-breadcrumbs {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #888;
          margin-bottom: 16px;
        }
        .cg-bc-link { color: #888; text-decoration: none; transition: color 0.15s; }
        .cg-bc-link:hover { color: #111; }
        .cg-bc-sep { color: #ccc; }
        .cg-bc-cur { color: #111; font-weight: 500; }

        .cg-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 28px;
          flex-wrap: wrap;
        }
        .cg-title { font-size: 28px; font-weight: 600; color: #111; margin-bottom: 6px; }
        .cg-subtitle { font-size: 14px; color: #777; font-weight: 300; }

        .cg-badge-year {
          font-size: 12px;
          background: #e8e6e0;
          color: #444;
          padding: 2px 8px;
          border-radius: 6px;
          margin-left: 8px;
          font-weight: 400;
        }

        .cg-logout {
          font-family: 'Sora', system-ui, sans-serif;
          font-size: 13px;
          color: #999;
          background: none;
          border: 0.5px solid rgba(0,0,0,0.12);
          border-radius: 6px;
          padding: 5px 12px;
          cursor: pointer;
        }
        .cg-logout:hover { color: #111; border-color: rgba(0,0,0,0.3); }

        @media (max-width: 768px) {
          .cg-body { padding: 24px 20px 60px; }
          .cg-topbar { padding: 0 20px; }
          .cg-email { display: none; }
        }
      `}</style>

      <div className="cg-root">
        <header className="cg-topbar">
          <Link href="/dashboard" className="cg-wordmark">evaluations</Link>
          <nav className="cg-nav">
            <Link href="/admin" className="cg-nav-link">
              Dashboard
            </Link>
            <Link href="/admin/evaluations" className="cg-nav-link">
              Evaluations
            </Link>
            <Link href="/admin/kuliah" className="cg-nav-link">
              Kelola Kuliah
            </Link>
          </nav>
          <div className="cg-user">
            <span className="cg-email">{session.user.email}</span>
            <div className="cg-avatar">{userInitial}</div>
            <LogoutButton className="cg-logout" />
          </div>
        </header>

        <main className="cg-body">
          <div className="cg-breadcrumbs">
            <Link href="/admin" className="cg-bc-link">Admin</Link>
            <span className="cg-bc-sep">/</span>
            <Link href="/admin/kuliah" className="cg-bc-link">Kelola Kuliah</Link>
            <span className="cg-bc-sep">/</span>
            <span className="cg-bc-cur">Input Nilai {course.matkul}</span>
          </div>

          <div className="cg-header">
            <div>
              <h1 className="cg-title">
                Input Nilai Mahasiswa: {course.matkul}
                <span className="cg-badge-year">{course.tahun}</span>
              </h1>
              <p className="cg-subtitle">
                Isi nilai kriteria (maksimal sesuai bobot kriteria). Nilai akhir dihitung otomatis dari penjumlahan seluruh nilai kriteria (Total 100 poin).
              </p>
            </div>

            <Link
              href={`/admin/kuliah/${course.idkuliah}/edit`}
              style={{
                fontSize: "12px",
                color: "#111",
                background: "#fff",
                border: "0.5px solid rgba(0,0,0,0.15)",
                borderRadius: "8px",
                padding: "8px 14px",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              ⚙️ Atur Kriteria &amp; Bobot
            </Link>
          </div>

          <GradeMatrixEditor
            idkuliah={course.idkuliah}
            matkul={course.matkul ?? ""}
            tahun={course.tahun ?? ""}
            criteriaList={criteriaList}
            initialStudents={students}
          />
        </main>
      </div>
    </>
  )
}
