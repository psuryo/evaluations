import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/app/src/lib/prisma"
import LogoutButton from "../dashboard/LogoutButton"

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

async function getGradesBySubject(nrp: string | null, isAdmin: boolean) {
  const whereClause = isAdmin && !nrp ? {} : { nrp: nrp ?? undefined }

  const nilaiRecords = await prisma.nilai.findMany({
    where: whereClause,
    include: {
      kuliah: { select: { matkul: true, tahun: true } },
      usernilai: { select: { nama: true, nrp: true } },
    },
    orderBy: [{ idkuliah: "asc" }, { nrp: "asc" }],
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
          criteria: { judulkriteria: string; kriteria: string; bobot: number | null; grade: number | null }[]
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
      judulkriteria: n.judulkriteria ?? "—",
      kriteria: n.kriteria ?? "—",
      bobot: n.bobot,
      grade: n.grade !== null ? Number(n.grade) : null,
    })
  }

  return Array.from(subjectMap.values()).map((s) => ({
    ...s,
    students: Array.from(s.students.values()).map((st) => {
      const gradesWithValue = st.criteria.filter((c) => c.grade !== null)
      const finalGrade =
        gradesWithValue.length > 0
          ? gradesWithValue.reduce((acc, c) => acc + c.grade!, 0)
          : null

      return { ...st, finalGrade }
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

  // Admin can pass ?viewAs=NRP to see a specific student's view
  const viewingAs = isAdmin && viewAs ? viewAs : null

  let nrp: string | null = null
  if (viewingAs) {
    nrp = viewingAs
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

  // When viewingAs, fetch student name for context
  const viewingStudent = viewingAs
    ? await prisma.userNilai.findUnique({
        where: { nrp: viewingAs },
        select: { nama: true, nrp: true },
      })
    : null

  const subjects = await getGradesBySubject(nrp, isAdmin && !viewingAs)
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
        .gr-subtitle { font-size: 14px; color: #aaa; font-weight: 300; margin-bottom: 36px; }

        .gr-section-label { font-size: 11px; font-weight: 500; letter-spacing: 0.07em; text-transform: uppercase; color: #bbb; margin-bottom: 14px; }

        .gr-subject-list { display: flex; flex-direction: column; gap: 16px; }

        .gr-subject-card { background: #fff; border: 0.5px solid rgba(0,0,0,0.07); border-radius: 12px; overflow: hidden; }

        .gr-subject-header {
          padding: 18px 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          border-bottom: 0.5px solid rgba(0,0,0,0.06);
        }
        .gr-subject-info { display: flex; flex-direction: column; gap: 3px; }
        .gr-subject-name { font-size: 15px; font-weight: 500; color: #111; }
        .gr-subject-year { font-size: 12px; color: #bbb; font-weight: 300; }
        .gr-subject-count { font-size: 12px; color: #bbb; }

        .gr-student-block { border-bottom: 0.5px solid rgba(0,0,0,0.05); }
        .gr-student-block:last-child { border-bottom: none; }

        .gr-student-header {
          padding: 12px 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #fafafa;
          border-bottom: 0.5px solid rgba(0,0,0,0.04);
        }
        .gr-student-left { display: flex; align-items: center; gap: 10px; }
        .gr-student-avatar { width: 26px; height: 26px; border-radius: 50%; background: #f0ede8; color: #888; font-size: 11px; font-weight: 500; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .gr-student-nama { font-size: 13px; font-weight: 500; color: #333; }
        .gr-student-nrp { font-size: 11px; color: #ccc; font-family: monospace; }

        .gr-final-badge {
          font-size: 12px;
          font-weight: 600;
          color: #1f6b45;
          background: #f0faf5;
          border: 0.5px solid #a8d8bc;
          border-radius: 20px;
          padding: 3px 10px;
          white-space: nowrap;
        }
        .gr-final-na {
          font-size: 12px;
          color: #ccc;
        }

        .gr-criteria-table { width: 100%; border-collapse: collapse; }
        .gr-criteria-table th {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #bbb;
          text-align: left;
          padding: 8px 22px;
          border-bottom: 0.5px solid rgba(0,0,0,0.05);
        }
        .gr-criteria-table th:last-child { text-align: right; }
        .gr-criteria-table td {
          font-size: 13px;
          color: #444;
          padding: 9px 22px;
          border-bottom: 0.5px solid rgba(0,0,0,0.04);
        }
        .gr-criteria-table tr:last-child td { border-bottom: none; }
        .gr-criteria-table td:last-child { text-align: right; }

        .gr-grade-pill {
          display: inline-block;
          font-size: 12px;
          font-weight: 600;
          padding: 2px 9px;
          border-radius: 20px;
          background: #f5f5f5;
          color: #555;
        }
        .gr-grade-high { background: #f0faf5; color: #1f6b45; }
        .gr-grade-mid  { background: #fdf8ee; color: #8a6200; }
        .gr-grade-low  { background: #fff1f1; color: #b02020; }

        .gr-bobot { font-size: 11px; color: #bbb; }

        .gr-empty { text-align: center; padding: 72px 24px; color: #ccc; font-size: 14px; font-weight: 300; }

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
          .gr-criteria-table th:nth-child(2),
          .gr-criteria-table td:nth-child(2),
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
            {viewingAs
              ? `Viewing as student`
              : isAdmin
              ? "All student grades by subject"
              : "Your grades by subject"}
          </p>

          {viewingAs && (
            <div className="gr-impersonate-banner">
              <span>
                Viewing grades for{" "}
                <strong>{viewingStudent?.nama ?? viewingAs}</strong>{" "}
                <span style={{ opacity: 0.6, fontFamily: "monospace", fontSize: "12px" }}>({viewingAs})</span>
              </span>
              <Link href="/admin" className="gr-back-link">← Back to admin</Link>
            </div>
          )}

          {subjects.length === 0 ? (
            <div className="gr-empty">No grades recorded yet.</div>
          ) : (
            <>
              <p className="gr-section-label">{subjects.length} subject{subjects.length !== 1 ? "s" : ""}</p>
              <div className="gr-subject-list">
                {subjects.map((subject) => (
                  <div key={subject.idkuliah} className="gr-subject-card">
                    <div className="gr-subject-header">
                      <div className="gr-subject-info">
                        <span className="gr-subject-name">{subject.matkul}</span>
                        <span className="gr-subject-year">{subject.tahun}</span>
                      </div>
                      <span className="gr-subject-count">
                        {subject.students.length} student{subject.students.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {subject.students.map((student) => (
                      <div key={student.nrp} className="gr-student-block">
                        <div className="gr-student-header">
                          <div className="gr-student-left">
                            <div className="gr-student-avatar">
                              {student.nama.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="gr-student-nama">{student.nama}</div>
                              <div className="gr-student-nrp">{student.nrp}</div>
                            </div>
                          </div>
                          {student.finalGrade !== null ? (
                            <span className="gr-final-badge">
                              Final: {student.finalGrade.toFixed(2)}
                            </span>
                          ) : (
                            <span className="gr-final-na">—</span>
                          )}
                        </div>

                        <table className="gr-criteria-table">
                          <thead>
                            <tr>
                              <th>Judul Kriteria</th>
                              <th>Kriteria</th>
                              <th>Bobot</th>
                              <th>Grade</th>
                            </tr>
                          </thead>
                          <tbody>
                            {student.criteria.map((c, i) => {
                              const g = c.grade
                              const pillClass =
                                g === null
                                  ? "gr-grade-pill"
                                  : g >= 80
                                  ? "gr-grade-pill gr-grade-high"
                                  : g >= 60
                                  ? "gr-grade-pill gr-grade-mid"
                                  : "gr-grade-pill gr-grade-low"

                              return (
                                <tr key={i}>
                                  <td>{c.judulkriteria}</td>
                                  <td>{c.kriteria}</td>
                                  <td>
                                    <span className="gr-bobot">
                                      {c.bobot !== null ? c.bobot : "—"}
                                    </span>
                                  </td>
                                  <td>
                                    <span className={pillClass}>
                                      {g !== null ? g.toFixed(2) : "—"}
                                    </span>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </main>
      </div>
    </>
  )
}
