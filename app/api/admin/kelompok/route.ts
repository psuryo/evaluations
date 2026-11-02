import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/app/src/lib/prisma"
import { requireAdmin } from "@/app/src/lib/adminAuth"

export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied
  try {
    const items = await prisma.kelompokPenilaian.findMany({
      orderBy: { id: "desc" },
      include: {
        _count: { select: { tim: true, kriteria: true } },
        tim: { select: { _count: { select: { anggota: true } } } },
      },
    })
    return NextResponse.json({
      items: items.map((i) => ({
        id: i.id,
        nama: i.nama,
        keterangan: i.keterangan,
        tahun: i.tahun,
        created_at: i.created_at,
        jumlahTim: i._count.tim,
        jumlahKriteria: i._count.kriteria,
        jumlahMahasiswa: i.tim.reduce((s, t) => s + t._count.anggota, 0),
      })),
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Gagal mengambil data penilaian kelompok" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied
  try {
    const { nama, keterangan, tahun } = await req.json()
    if (!nama || !String(nama).trim()) {
      return NextResponse.json({ error: "Nama penilaian wajib diisi" }, { status: 400 })
    }
    const created = await prisma.kelompokPenilaian.create({
      data: {
        nama: String(nama).trim(),
        keterangan: keterangan ? String(keterangan).trim() : null,
        tahun: tahun ? String(tahun).trim() : null,
      },
    })
    return NextResponse.json({ item: created }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Gagal membuat penilaian kelompok" }, { status: 500 })
  }
}
