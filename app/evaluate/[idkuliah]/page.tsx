import { getServerSession } from "next-auth"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/app/src/lib/prisma"
import EvaluationForm from "../EvaluationForm"

async function getEvaluationData(nrp: string, idkuliah: number) {
  const [course, groupMembership, kriteriaList, alreadySubmitted] =
    await Promise.all([
      prisma.kuliah.findUnique({ where: { idkuliah } }),
      prisma.group.findFirst({ where: { nrp, idkuliah } }),
      prisma.kriteria.findMany({ orderBy: { bobot: "desc" } }),
      prisma.submission.findFirst({ where: { nrp, idkuliah } }),
    ])

  if (!course) return null

  if (!groupMembership?.group_id) {
    return { course, peers: [], kriteriaList, alreadySubmitted: !!alreadySubmitted, noGroup: true }
  }

  const groupMembers = await prisma.group.findMany({
    where: { group_id: groupMembership.group_id, idkuliah, NOT: { nrp } },
    select: { nrp: true },
  })

  const peerNrps = groupMembers.map((m) => m.nrp).filter(Boolean) as string[]

  const peers = await prisma.userNilai.findMany({
    where: { nrp: { in: peerNrps } },
    select: { nrp: true, nama: true },
  })

  return { course, peers, kriteriaList, alreadySubmitted: !!alreadySubmitted, noGroup: false }
}

export default async function EvaluateCourse({
  params,
}: {
  params: { idkuliah: string }
}) {
  const session = await getServerSession()
  if (!session?.user?.email) redirect("/login")

  const idkuliah = parseInt(params.idkuliah)
  if (isNaN(idkuliah)) notFound()

  const student = await prisma.userNilai.findUnique({
    where: { email: session.user.email },
  })
  if (!student) redirect("/evaluate")

  const data = await getEvaluationData(student.nrp, idkuliah)
  if (!data) notFound()

  const userInitial = (session.user.email ?? "?").charAt(0).toUpperCase()

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .ev-root { min-height: 100dvh; background: #f5f4f0; font-family: 'DM Sans', system-ui, sans-serif; color: #111; }

        .ev-topbar {
          background: #fff;
          border-bottom: 0.5px solid rgba(0,0,0,0.08);
          padding: 0 40px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky; top: 0; z-index: 10;
        }
        .ev-topbar-left { display: flex; align-items: center; gap: 12px; }
        .ev-back { font-size: 13px; color: #bbb; text-decoration: none; transition: color 0.15s; }
        .ev-back:hover { color: #555; }
        .ev-divider { font-size: 13px; color: #ddd; }
        .ev-wordmark { font-family: 'Instrument Serif', Georgia, serif; font-size: 19px; color: #111; letter-spacing: -0.3px; text-decoration: none; }
        .ev-user { display: flex; align-items: center; gap: 10px; }
        .ev-avatar { width: 30px; height: 30px; border-radius: 50%; background: #141414; color: #efefef; font-size: 12px; font-weight: 500; display: flex; align-items: center; justify-content: center; }
        .ev-email { font-size: 13px; color: #999; }

        .ev-body { max-width: 600px; margin: 0 auto; padding: 48px 40px 80px; }

        .ev-course-tag {
          display: inline-flex;
          align-items: center;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #aaa;
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.08);
          border-radius: 20px;
          padding: 4px 12px;
          margin-bottom: 16px;
        }
        .ev-heading { font-family: 'Instrument Serif', Georgia, serif; font-size: 30px; font-weight: 400; color: #111; margin-bottom: 4px; }
        .ev-sub { font-size: 14px; color: #aaa; font-weight: 300; margin-bottom: 36px; line-height: 1.5; }
        .ev-sub strong { font-weight: 500; color: #777; }

        .ev-no-group {
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.07);
          border-radius: 12px;
          padding: 32px 24px;
          text-align: center;
          color: #aaa;
          font-size: 14px;
          font-weight: 300;
          line-height: 1.6;
        }

        @media (max-width: 640px) {
          .ev-body { padding: 28px 20px 60px; }
          .ev-topbar { padding: 0 20px; }
          .ev-email { display: none; }
        }
      `}</style>

      <div className="ev-root">
        <header className="ev-topbar">
          <div className="ev-topbar-left">
            <Link href="/evaluate" className="ev-back">← All courses</Link>
            <span className="ev-divider">/</span>
            <Link href="/dashboard" className="ev-wordmark">evaluations</Link>
          </div>
          <div className="ev-user">
            <span className="ev-email">{session.user.email}</span>
            <div className="ev-avatar">{userInitial}</div>
          </div>
        </header>

        <div className="ev-body">
          <span className="ev-course-tag">{data.course.tahun ?? "—"}</span>
          <h1 className="ev-heading">{data.course.matkul ?? "Untitled course"}</h1>
          <p className="ev-sub">
            Distribute <strong>100 points</strong> across your group members based on their contribution to the project.
            Consider each grading dimension carefully.
          </p>

          {data.noGroup ? (
            <div className="ev-no-group">
              You are not assigned to a group for this course yet.<br />
              Contact your administrator.
            </div>
          ) : (
            <EvaluationForm
              evaluatorNrp={student.nrp}
              peers={data.peers}
              kriteriaList={data.kriteriaList}
              alreadySubmitted={data.alreadySubmitted}
              idkuliah={idkuliah}
            />
          )}
        </div>
      </div>
    </>
  )
}
