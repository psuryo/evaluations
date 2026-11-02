import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/app/src/lib/prisma"
import { requireAdmin } from "@/app/src/lib/adminAuth"

type Ctx = { params: Promise<{ id: string }> }

async function parseId(ctx: Ctx): Promise<number | null> {
  const { id } = await ctx.params
  const n = parseInt(id, 10)
  return isNaN(n) ? null : n
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin()
  if (denied) return denied
  const id = await parseId(ctx)
  if (id === null) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 })

  try {
    const p = await prisma.kelompokPenilaian.findUnique({
      where: { id },
      include: {
        kriteria: { orderBy: [{ urutan: "asc" }, { id: "asc" }] },
        tim: {
          orderBy: { id: "asc" },
          include: {
            anggota: { include: { usernilai: { select: { nama: true, email: true } } }, orderBy: { nrp: "asc" } },
            nilai: true,
          },
        },
      },
    })
    if (!p) return NextResponse.json({ error: "Penilaian tidak ditemukan" }, { status: 404 })

    const kriteriaIds = p.kriteria.map((k) => k.id)
    const nilaiIndividu = await prisma.kelompokNilaiIndividu.findMany({
      where: { kriteriaId: { in: kriteriaIds } },
    })

    return NextResponse.json({
      penilaian: { id: p.id, nama: p.nama, keterangan: p.keterangan, tahun: p.tahun },
      kriteria: p.kriteria.map((k) => ({ id: k.id, nama: k.nama, tipe: k.tipe, bobot: k.bobot })),
      tim: p.tim.map((t) => ({
        id: t.id,
        nama: t.nama,
        anggota: t.anggota.map((a) => ({
          nrp: a.nrp,
          nama: a.usernilai?.nama ?? a.nrp,
          email: a.usernilai?.email ?? "",
        })),
      })),
      nilaiTim: p.tim.flatMap((t) =>
        t.nilai.map((n) => ({ kriteriaId: n.kriteriaId, timId: n.timId, nilai: n.nilai, keterangan: n.keterangan }))
      ),
      nilaiIndividu: nilaiIndividu.map((n) => ({
        kriteriaId: n.kriteriaId,
        nrp: n.nrp,
        nilai: n.nilai,
        keterangan: n.keterangan,
      })),
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Gagal mengambil data penilaian" }, { status: 500 })
  }
}

interface KriteriaIn {
  id?: number
  nama: string
  tipe: string
  bobot: number
}
interface TimIn {
  id?: number
  nama: string
  anggota: string[]
}

/** Simpan konfigurasi: info, kriteria, kelompok + anggota. */
export async function PUT(req: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin()
  if (denied) return denied
  const id = await parseId(ctx)
  if (id === null) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 })

  try {
    const body = await req.json()
    const nama = String(body.nama ?? "").trim()
    if (!nama) return NextResponse.json({ error: "Nama penilaian wajib diisi" }, { status: 400 })

    const kriteria: KriteriaIn[] = Array.isArray(body.kriteria) ? body.kriteria : []
    const tim: TimIn[] = Array.isArray(body.tim) ? body.tim : []

    for (const k of kriteria) {
      if (!String(k.nama ?? "").trim())
        return NextResponse.json({ error: "Nama kriteria tidak boleh kosong" }, { status: 400 })
      if (k.tipe !== "KELOMPOK" && k.tipe !== "INDIVIDU")
        return NextResponse.json({ error: "Tipe kriteria tidak valid" }, { status: 400 })
      if (isNaN(Number(k.bobot)) || Number(k.bobot) < 0)
        return NextResponse.json({ error: "Bobot kriteria tidak valid" }, { status: 400 })
    }

    const seen = new Set<string>()
    for (const t of tim) {
      if (!String(t.nama ?? "").trim())
        return NextResponse.json({ error: "Nama kelompok tidak boleh kosong" }, { status: 400 })
      for (const nrp of t.anggota ?? []) {
        if (seen.has(nrp))
          return NextResponse.json(
            { error: `Mahasiswa ${nrp} terdaftar di lebih dari satu kelompok` },
            { status: 400 }
          )
        seen.add(nrp)
      }
    }

    const existingUsers = await prisma.userNilai.findMany({
      where: { nrp: { in: Array.from(seen) } },
      select: { nrp: true },
    })
    if (existingUsers.length !== seen.size) {
      const ok = new Set(existingUsers.map((u) => u.nrp))
      const missing = Array.from(seen).filter((n) => !ok.has(n))
      return NextResponse.json({ error: `NRP tidak ditemukan: ${missing.join(", ")}` }, { status: 400 })
    }

    const current = await prisma.kelompokPenilaian.findUnique({
      where: { id },
      include: { kriteria: true, tim: true },
    })
    if (!current) return NextResponse.json({ error: "Penilaian tidak ditemukan" }, { status: 404 })

    await prisma.$transaction(
      async (tx) => {
        await tx.kelompokPenilaian.update({
          where: { id },
          data: {
            nama,
            keterangan: body.keterangan ? String(body.keterangan).trim() : null,
            tahun: body.tahun ? String(body.tahun).trim() : null,
          },
        })

        // ── Kriteria
        const keepK = new Set(kriteria.filter((k) => k.id).map((k) => k.id!))
        await tx.kelompokKriteria.deleteMany({
          where: { penilaianId: id, id: { notIn: Array.from(keepK) } },
        })
        for (let i = 0; i < kriteria.length; i++) {
          const k = kriteria[i]
          const data = { nama: k.nama.trim(), tipe: k.tipe, bobot: Number(k.bobot), urutan: i }
          if (k.id && current.kriteria.some((c) => c.id === k.id)) {
            // jika tipe berubah, nilai lama tidak relevan
            const old = current.kriteria.find((c) => c.id === k.id)!
            if (old.tipe !== k.tipe) {
              await tx.kelompokNilaiTim.deleteMany({ where: { kriteriaId: k.id } })
              await tx.kelompokNilaiIndividu.deleteMany({ where: { kriteriaId: k.id } })
            }
            await tx.kelompokKriteria.update({ where: { id: k.id }, data })
          } else {
            await tx.kelompokKriteria.create({ data: { ...data, penilaianId: id } })
          }
        }

        // ── Kelompok
        const keepT = new Set(tim.filter((t) => t.id).map((t) => t.id!))
        await tx.kelompokTim.deleteMany({
          where: { penilaianId: id, id: { notIn: Array.from(keepT) } },
        })
        await tx.kelompokAnggota.deleteMany({ where: { penilaianId: id } })
        for (const t of tim) {
          let timId: number
          if (t.id && current.tim.some((c) => c.id === t.id)) {
            await tx.kelompokTim.update({ where: { id: t.id }, data: { nama: t.nama.trim() } })
            timId = t.id
          } else {
            const created = await tx.kelompokTim.create({
              data: { penilaianId: id, nama: t.nama.trim() },
            })
            timId = created.id
          }
          const anggota = Array.from(new Set(t.anggota ?? []))
          if (anggota.length > 0) {
            await tx.kelompokAnggota.createMany({
              data: anggota.map((nrp) => ({ timId, penilaianId: id, nrp })),
            })
          }
        }

        // bersihkan nilai individu milik mahasiswa yang sudah dikeluarkan
        const allK = await tx.kelompokKriteria.findMany({
          where: { penilaianId: id },
          select: { id: true },
        })
        await tx.kelompokNilaiIndividu.deleteMany({
          where: {
            kriteriaId: { in: allK.map((k) => k.id) },
            nrp: { notIn: Array.from(seen) },
          },
        })
      },
      { timeout: 30000, maxWait: 10000 }
    )

    return NextResponse.json({ message: "Konfigurasi berhasil disimpan" })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Gagal menyimpan konfigurasi" }, { status: 500 })
  }
}

/** Simpan nilai: { tim: [{kriteriaId,timId,nilai}], individu: [{kriteriaId,nrp,nilai}] } */
export async function POST(req: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin()
  if (denied) return denied
  const id = await parseId(ctx)
  if (id === null) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 })

  try {
    const body = await req.json()
    const tim: { kriteriaId: number; timId: number; nilai: number | null; keterangan?: string | null }[] = body.tim ?? []
    const individu: { kriteriaId: number; nrp: string; nilai: number | null; keterangan?: string | null }[] = body.individu ?? []
    const normKet = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)

    const [kriteria, timList, anggota] = await Promise.all([
      prisma.kelompokKriteria.findMany({ where: { penilaianId: id } }),
      prisma.kelompokTim.findMany({ where: { penilaianId: id }, select: { id: true } }),
      prisma.kelompokAnggota.findMany({ where: { penilaianId: id }, select: { nrp: true } }),
    ])
    const kMap = new Map(kriteria.map((k) => [k.id, k]))
    const timIds = new Set(timList.map((t) => t.id))
    const nrps = new Set(anggota.map((a) => a.nrp))

    const norm = (v: unknown): number | null | "invalid" => {
      if (v === null || v === undefined || v === "") return null
      const n = Number(v)
      if (isNaN(n) || n < 0 || n > 100) return "invalid"
      return n
    }

    const ops = []
    for (const r of tim) {
      const k = kMap.get(r.kriteriaId)
      if (!k || k.tipe !== "KELOMPOK" || !timIds.has(r.timId)) continue
      const v = norm(r.nilai)
      if (v === "invalid")
        return NextResponse.json({ error: "Nilai harus antara 0 - 100" }, { status: 400 })
      ops.push(
        prisma.kelompokNilaiTim.upsert({
          where: { kriteriaId_timId: { kriteriaId: r.kriteriaId, timId: r.timId } },
          create: { kriteriaId: r.kriteriaId, timId: r.timId, nilai: v, keterangan: normKet(r.keterangan) },
          update: { nilai: v, keterangan: normKet(r.keterangan) },
        })
      )
    }
    for (const r of individu) {
      const k = kMap.get(r.kriteriaId)
      if (!k || k.tipe !== "INDIVIDU" || !nrps.has(r.nrp)) continue
      const v = norm(r.nilai)
      if (v === "invalid")
        return NextResponse.json({ error: "Nilai harus antara 0 - 100" }, { status: 400 })
      ops.push(
        prisma.kelompokNilaiIndividu.upsert({
          where: { kriteriaId_nrp: { kriteriaId: r.kriteriaId, nrp: r.nrp } },
          create: { kriteriaId: r.kriteriaId, nrp: r.nrp, nilai: v, keterangan: normKet(r.keterangan) },
          update: { nilai: v, keterangan: normKet(r.keterangan) },
        })
      )
    }

    const BATCH = 100
    for (let i = 0; i < ops.length; i += BATCH) {
      await prisma.$transaction(ops.slice(i, i + BATCH))
    }
    return NextResponse.json({ message: "Nilai berhasil disimpan", count: ops.length })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Gagal menyimpan nilai" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin()
  if (denied) return denied
  const id = await parseId(ctx)
  if (id === null) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 })
  try {
    await prisma.kelompokAnggota.deleteMany({ where: { penilaianId: id } })
    await prisma.kelompokPenilaian.delete({ where: { id } })
    return NextResponse.json({ message: "Penilaian dihapus" })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Gagal menghapus penilaian" }, { status: 500 })
  }
}
