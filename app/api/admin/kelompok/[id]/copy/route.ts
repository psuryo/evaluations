import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/app/src/lib/prisma"
import { requireAdmin } from "@/app/src/lib/adminAuth"

type Ctx = { params: Promise<{ id: string }> }

async function parseId(ctx: Ctx): Promise<number | null> {
  const { id } = await ctx.params
  const n = parseInt(id, 10)
  return isNaN(n) ? null : n
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin()
  if (denied) return denied

  const targetId = await parseId(ctx)
  if (targetId === null) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 })

  try {
    const body = await req.json()
    const sourceId = parseInt(String(body.sourcePenilaianId), 10)
    const mode: "replace" | "append" = body.mode === "append" ? "append" : "replace"

    if (isNaN(sourceId) || sourceId <= 0) {
      return NextResponse.json({ error: "Pilih penilaian sumber yang valid" }, { status: 400 })
    }

    if (sourceId === targetId) {
      return NextResponse.json({ error: "Tidak dapat menyalin dari penilaian yang sama" }, { status: 400 })
    }

    const [target, source] = await Promise.all([
      prisma.kelompokPenilaian.findUnique({ where: { id: targetId } }),
      prisma.kelompokPenilaian.findUnique({
        where: { id: sourceId },
        include: {
          tim: {
            orderBy: { id: "asc" },
            include: {
              anggota: {
                orderBy: { nrp: "asc" },
              },
            },
          },
        },
      }),
    ])

    if (!target) return NextResponse.json({ error: "Penilaian tujuan tidak ditemukan" }, { status: 404 })
    if (!source) return NextResponse.json({ error: "Penilaian sumber tidak ditemukan" }, { status: 404 })

    if (source.tim.length === 0) {
      return NextResponse.json(
        { error: `Penilaian "${source.nama}" tidak memiliki kelompok untuk disalin` },
        { status: 400 }
      )
    }

    let copiedTeamsCount = 0
    let copiedMembersCount = 0
    let skippedMembersCount = 0

    await prisma.$transaction(
      async (tx) => {
        let assignedNrp = new Set<string>()

        if (mode === "replace") {
          // Hapus semua anggota dan tim di target penilaian
          await tx.kelompokAnggota.deleteMany({ where: { penilaianId: targetId } })
          await tx.kelompokTim.deleteMany({ where: { penilaianId: targetId } })
        } else {
          // Ambil anggota yang sudah ada di target agar tidak ada duplikasi
          const existingAnggota = await tx.kelompokAnggota.findMany({
            where: { penilaianId: targetId },
            select: { nrp: true },
          })
          assignedNrp = new Set(existingAnggota.map((a) => a.nrp))
        }

        for (const t of source.tim) {
          const membersToInsert: string[] = []
          for (const a of t.anggota) {
            if (mode === "append" && assignedNrp.has(a.nrp)) {
              skippedMembersCount++
            } else {
              membersToInsert.push(a.nrp)
              assignedNrp.add(a.nrp)
            }
          }

          const newTim = await tx.kelompokTim.create({
            data: {
              penilaianId: targetId,
              nama: t.nama,
            },
          })
          copiedTeamsCount++

          if (membersToInsert.length > 0) {
            await tx.kelompokAnggota.createMany({
              data: membersToInsert.map((nrp) => ({
                timId: newTim.id,
                penilaianId: targetId,
                nrp,
              })),
            })
            copiedMembersCount += membersToInsert.length
          }
        }

        // Jika mode replace, hapus juga nilai individu untuk mahasiswa yang tidak lagi di penilaian ini
        if (mode === "replace") {
          const kriteriaTarget = await tx.kelompokKriteria.findMany({
            where: { penilaianId: targetId },
            select: { id: true },
          })
          if (kriteriaTarget.length > 0) {
            await tx.kelompokNilaiIndividu.deleteMany({
              where: {
                kriteriaId: { in: kriteriaTarget.map((k) => k.id) },
                nrp: { notIn: Array.from(assignedNrp) },
              },
            })
          }
        }
      },
      { timeout: 30000, maxWait: 10000 }
    )

    let msg = `Berhasil menyalin ${copiedTeamsCount} kelompok (${copiedMembersCount} mahasiswa) dari "${source.nama}".`
    if (skippedMembersCount > 0) {
      msg += ` ${skippedMembersCount} mahasiswa dilewati karena sudah terdaftar di kelompok lain.`
    }

    return NextResponse.json({
      message: msg,
      copiedTeams: copiedTeamsCount,
      copiedMembers: copiedMembersCount,
      skippedMembers: skippedMembersCount,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Gagal menyalin kelompok" }, { status: 500 })
  }
}

