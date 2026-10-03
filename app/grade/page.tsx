import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/app/src/lib/prisma"
import LogoutButton from "../dashboard/LogoutButton"
import { getImpersonatedEmail } from "@/app/src/lib/impersonate"
import ImpersonationBackButton from "../dashboard/ImpersonationBackButton"
import CollapsibleGradeList, { SubjectGrade } from "./CollapsibleGradeList"

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

async function getGradesBySubject(nrp: string | null, isAdmin: boolean): Promise<SubjectGrade[]> {
  const whereClause = isAdmin && !nrp ? {} : { nrp: nrp ?? undefined }

  const nilaiRecords = await prisma.nilai.findMany({
    where: whereClause,
    include: {
      kuliah: { select: { matkul: true, tahun: true } },
      usernilai: { select: { nama: true, nrp: true } },
    },
    // Order courses by idkuliah desc (most recent first)
    // and order criteria by idnilai asc (exact creation order)
    orderBy: [{ idkuliah: "desc" }, { nrp: "asc" }, { idnilai: "asc" }],
  })

  // Group by idkuliah
  const subjectMap = new Map<
    number,
    {
      idkuliah: number
      matkul: string
      tahun: string
      students: Map<
        string,
        {
          nrp: string
          nama: string
          criteria: {
            idnilai?: number
            judulkriteria: string
            kriteria: string
            bobot: number | null
            grade: number | null
          }[]
        }
      >
    }
  >()

  for (const n of nilaiRecords) {
    if (!n.idkuliah) continue

    if (!subjectMap.has(n.idkuliah)) {
      subjectMap.set(n.idkuliah, {
        idkuliah: n.idkuliah,
        matkul: n.kuliah?.matkul ?? "Untitled",
        tahun: n.kuliah?.tahun ?? "—",
        students: new Map(),
      })
    }

    const subject = subjectMap.get(n.idkuliah)!
    const nrpKey = n.nrp ?? "unknown"

    if (!subject.students.has(nrpKey)) {
      subject.students.set(nrpKey, {
        nrp: nrpKey,
        nama: n.usernilai?.nama ?? nrpKey,
        criteria: [],
      })
    }

    subject.students.get(nrpKey)!.criteria.push({
      idnilai: n.idnilai,
      judulkriteria: n.judulkriteria ?? "—",
      kriteria: n.kriteria ?? "—",
      bobot: n.bobot,
      grade: n.grade !== null ? Number(n.grade) : null,
    })
  }

  return Array.from(subjectMap.values())
    .sort((a, b) => b.idkuliah - a.idkuliah)
    .map((s) => ({
      ...s,
      students: Array.from(s.students.values()).map((st) => {
        // Ensure criteria are strictly sorted by creation order (idnilai asc) with natural sort fallback
        const sortedCriteria = [...st.criteria].sort((a, b) => {
          if (a.idnilai !== undefined && b.idnilai !== undefined && a.idnilai !== b.idnilai) {
            return a.idnilai - b.idnilai
          }
          return a.judulkriteria.localeCompare(b.judulkriteria, undefined, { numeric: true, sensitivity: "base" })
        })
        const gradesWithValue = sortedCriteria.filter((c) => c.grade !== null)
        const finalGrade =
          gradesWithValue.length > 0
            ? gradesWithValue.reduce((acc, c) => acc + c.grade!, 0)
            : null

        return { ...st, criteria: sortedCriteria, finalGrade }
      }),
    }))
}

export default async function GradePage({
  searchParams,
}: {
  searchParams: Promise<{ viewAs?: string }>
}) {
  const session = await getServerSession()
  if (!session?.user?.email) redirect("/login")

  const isAdmin = !!ADMIN_EMAIL && session.user.email === ADMIN_EMAIL
  const { viewAs } = await searchParams
  
  // Check for impersonation cookie
  const impersonatedEmail = await getImpersonatedEmail()
  const isImpersonating = !!impersonatedEmail

  // Admin can pass ?viewAs=NRP to see a specific student's view
  const legacyViewingAs = isAdmin && viewAs ? viewAs : null

  let nrp: string | null = null
  let viewingStudentEmail: string | null = null
  
  if (impersonatedEmail) {
    // Using impersonation cookie
    const student = await prisma.userNilai.findUnique({
      where: { email: impersonatedEmail },
      select: { nrp: true },
    })
    nrp = student?.nrp ?? null
    viewingStudentEmail = impersonatedEmail
  } else if (legacyViewingAs) {
    nrp = legacyViewingAs
  } else if (!isAdmin) {
    const student = await prisma.userNilai.findUnique({
      where: { email: session.user.email },
      select: { nrp: true },
    })
    if (!student) redirect("/dashboard")
    nrp = student.nrp

    // Block access until all evaluations are submitted
    // Courses without a group_id are auto-submitted — only those with group_id require evaluation
    const groupEntries = await prisma.group.findMany({
      where: { nrp },
      select: { idkuliah: true, group_id: true },
    })

    const requiresEvalIds = groupEntries
      .filter((g) => g.group_id)
      .map((g) => g.idkuliah)
      .filter(Boolean) as number[]

    const submittedCount = await prisma.submission.count({
      where: { nrp, idkuliah: { in: requiresEvalIds } },
    })

    if (submittedCount < requiresEvalIds.length) redirect("/dashboard")
  }

  // Fetch viewing student info
  let viewingStudent: { nrp: string; nama: string | null } | null = null
  if (isImpersonating && nrp) {
    viewingStudent = await prisma.userNilai.findUnique({
      where: { nrp },
      select: { nrp: true, nama: true },
    })
  } else if (legacyViewingAs) {
    viewingStudent = await prisma.userNilai.findUnique({
      where: { nrp: legacyViewingAs },
      select: { nrp: true, nama: true },
    })
  }

  // Define viewingAs for JSX: either the impersonated/legacy viewed NRP or null
  const viewingAs = isImpersonating || legacyViewingAs ? viewingStudent?.nrp ?? legacyViewingAs : null
  const isGlobalAdminView = isAdmin && !legacyViewingAs && !isImpersonating

  const subjects = await getGradesBySubject(nrp, isGlobalAdminView)
  const userInitial = session.user.email.charAt(0).toUpperCase()

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .gr-root { min-height: 100dvh; background: #f5f4f0; font-family: 'Sora', system-ui, sans-serif; color: #111; }

        .gr-topbar {
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
        .gr-wordmark { font-family: 'Sora', system-ui, sans-serif; font-size: 19px; color: #111; letter-spacing: -0.3px; text-decoration: none; }
        .gr-user { display: flex; align-items: center; gap: 10px; }
        .gr-avatar { width: 30px; height: 30px; border-radius: 50%; background: #141414; color: #efefef; font-size: 12px; font-weight: 500; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .gr-email { font-size: 13px; color: #999; }

        .gr-body { max-width: 860px; margin: 0 auto; padding: 48px 40px 80px; }

        .gr-title { font-size: 30px; font-weight: 600; color: #111; margin-bottom: 4px; }
        .gr-subtitle { font-size: 14px; color: #aaa; font-weight: 300; margin-bottom: 32px; }

        .gr-collapsible-wrapper { display: flex; flex-direction: column; gap: 14px; }

        .gr-list-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .gr-section-label {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: #999;
        }

        .gr-toggle-all-btn {
          font-family: 'Sora', system-ui, sans-serif;
          font-size: 12px;
          font-weight: 500;
          color: #666;
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.12);
          border-radius: 6px;
          padding: 4px 10px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .gr-toggle-all-btn:hover {
          color: #111;
          border-color: rgba(0,0,0,0.3);
          background: #fdfdfc;
        }

        .gr-subject-list { display: flex; flex-direction: column; gap: 12px; }

        .gr-subject-card {
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.08);
          border-radius: 12px;
          overflow: hidden;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .gr-subject-card:hover {
          border-color: rgba(0,0,0,0.16);
        }
        .gr-subject-card.gr-card-open {
          border-color: rgba(0,0,0,0.14);
          box-shadow: 0 2px 8px rgba(0,0,0,0.03);
        }

        .gr-subject-header {
          width: 100%;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          background: #fff;
          border: none;
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          transition: background 0.15s ease;
        }
        .gr-subject-header:hover {
          background: #faf9f6;
        }
        .gr-subject-header.is-open {
          border-bottom: 0.5px solid rgba(0,0,0,0.06);
          background: #faf9f6;
        }
        .gr-subject-header:focus-visible {
          outline: 2px solid #111;
          outline-offset: -2px;
        }

        .gr-subject-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .gr-subject-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .gr-subject-name { font-size: 15px; font-weight: 600; color: #111; }
        .gr-subject-year {
          font-size: 11px;
          color: #777;
          background: #f0ede8;
          border-radius: 4px;
          padding: 2px 7px;
          font-weight: 500;
          letter-spacing: 0.02em;
        }
        .gr-subject-meta { font-size: 12px; color: #999; font-weight: 300; }
        .gr-subject-count { font-size: 12px; color: #888; font-weight: 500; }

        .gr-subject-header-right {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-shrink: 0;
        }

        .gr-header-grade-preview {
          display: flex;
          align-items: center;
        }

        .gr-chevron-wrapper {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #f5f4f0;
          color: #666;
          transition: transform 0.2s ease, background 0.15s ease, color 0.15s ease;
        }
        .gr-subject-header:hover .gr-chevron-wrapper {
          background: #ebe9e3;
          color: #111;
        }
        .gr-chevron-wrapper.is-open {
          transform: rotate(180deg);
          background: #111;
          color: #fff;
        }

        .gr-subject-content {
          animation: grFadeIn 0.18s ease-out;
        }

        @keyframes grFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .gr-student-block { border-bottom: 0.5px solid rgba(0,0,0,0.05); }
        .gr-student-block:last-child { border-bottom: none; }

        .gr-student-header {
          padding: 12px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #fbfbf9;
          border-bottom: 0.5px solid rgba(0,0,0,0.04);
        }
        .gr-student-left { display: flex; align-items: center; gap: 10px; }
        .gr-student-avatar { width: 26px; height: 26px; border-radius: 50%; background: #e8e5df; color: #666; font-size: 11px; font-weight: 500; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .gr-student-nama { font-size: 13px; font-weight: 500; color: #333; }
        .gr-student-nrp { font-size: 11px; color: #aaa; font-family: monospace; }

        .gr-final-badge {
          font-size: 12px;
          font-weight: 600;
          color: #1f6b45;
          background: #edf8f2;
          border: 0.5px solid #a8d8bc;
          border-radius: 20px;
          padding: 3px 10px;
          white-space: nowrap;
        }
        .gr-final-na {
          font-size: 12px;
          color: #aaa;
          background: #f5f5f3;
          border: 0.5px solid rgba(0,0,0,0.06);
          border-radius: 20px;
          padding: 3px 10px;
          white-space: nowrap;
        }

        .gr-criteria-table { width: 100%; border-collapse: collapse; }
        .gr-criteria-table th {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #999;
          text-align: left;
          padding: 10px 18px;
          background: #fdfdfc;
          border-bottom: 0.5px solid rgba(0,0,0,0.05);
        }
        .gr-criteria-table th:last-child { text-align: right; }
        .gr-criteria-table td {
          font-size: 13px;
          color: #333;
          padding: 10px 18px;
          border-bottom: 0.5px solid rgba(0,0,0,0.04);
        }
        .gr-criteria-table tr:last-child td { border-bottom: none; }
        .gr-criteria-table td:last-child { text-align: right; }

        .gr-td-num {
          font-size: 12px;
          font-weight: 600;
          color: #888;
          text-align: center;
          width: 36px;
        }
        .gr-td-judul { font-weight: 500; color: #111; }
        .gr-td-kriteria { color: #666; }

        .gr-grade-pill {
          display: inline-block;
          font-size: 12px;
          font-weight: 600;
          padding: 2px 9px;
          border-radius: 20px;
          background: #f5f5f5;
          color: #555;
        }
        .gr-grade-high { background: #edf8f2; color: #1f6b45; }
        .gr-grade-mid  { background: #fdf8ee; color: #8a6200; }
        .gr-grade-low  { background: #fff1f1; color: #b02020; }

        .gr-bobot { font-size: 11px; color: #999; }

        .gr-student-empty, .gr-criteria-empty {
          padding: 24px;
          text-align: center;
          color: #aaa;
          font-size: 13px;
          font-weight: 300;
        }

        .gr-empty { text-align: center; padding: 72px 24px; color: #aaa; font-size: 14px; font-weight: 300; }

        .gr-logout {
          font-family: 'Sora', system-ui, sans-serif;
          font-size: 13px;
          color: #999;
          background: none;
          border: 0.5px solid rgba(0,0,0,0.12);
          border-radius: 6px;
          padding: 5px 12px;
          cursor: pointer;
        }
        .gr-logout:hover { color: #111; border-color: rgba(0,0,0,0.3); }

        .gr-impersonate-banner {
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
        .gr-impersonate-banner strong { font-weight: 600; }
        .gr-back-link {
          font-size: 12px;
          color: #7a5200;
          text-decoration: none;
          border: 0.5px solid #e8c96a;
          border-radius: 6px;
          padding: 4px 10px;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .gr-back-link:hover { background: #fff3d0; }

        @media (max-width: 640px) {
          .gr-body { padding: 28px 20px 60px; }
          .gr-topbar { padding: 0 20px; }
          .gr-email { display: none; }
          .gr-subject-header { padding: 14px 16px; }
          .gr-criteria-table th:nth-child(3),
          .gr-criteria-table td:nth-child(3) { display: none; }
        }
      `}</style>

      <div className="gr-root">
        <header className="gr-topbar">
          <Link href="/dashboard" className="gr-wordmark">evaluations</Link>
          <div className="gr-user">
            <span className="gr-email">{session.user.email}</span>
            <div className="gr-avatar">{userInitial}</div>
            <LogoutButton className="gr-logout" />
          </div>
        </header>

        <main className="gr-body">
          <h1 className="gr-title">Grades</h1>
          <p className="gr-subtitle">
            {isImpersonating || viewingAs
              ? `Viewing as student`
              : isAdmin
              ? "All student grades by subject"
              : "Your grades by subject"}
          </p>

          {(isImpersonating || viewingAs) && (
            <div className="gr-impersonate-banner">
              <span>
                Viewing grades for{" "}
                <strong>{viewingStudent?.nama ?? viewingAs ?? "user"}</strong>{" "}
                <span style={{ opacity: 0.6, fontFamily: "monospace", fontSize: "12px" }}>({viewingStudent?.nrp})</span>
              </span>
              {isImpersonating ? (
                <ImpersonationBackButton />
              ) : (
                <Link href="/admin" className="gr-back-link">← Back to admin</Link>
              )}
            </div>
          )}

          <CollapsibleGradeList
            subjects={subjects}
            isAdminView={isGlobalAdminView}
          />
        </main>
      </div>
    </>
  )
}
