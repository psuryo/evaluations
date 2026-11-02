"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface Item {
  id: number
  nama: string
  keterangan: string | null
  tahun: string | null
  jumlahTim: number
  jumlahKriteria: number
  jumlahMahasiswa: number
}

export default function KelompokList() {
  const router = useRouter()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [nama, setNama] = useState("")
  const [tahun, setTahun] = useState("")
  const [keterangan, setKeterangan] = useState("")
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/kelompok")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setItems(data.items)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/admin/kelompok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama, tahun, keterangan }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/admin/kelompok/${data.item.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat penilaian")
      setSaving(false)
    }
  }

  async function remove(item: Item) {
    if (!confirm(`Hapus penilaian "${item.nama}" beserta semua kelompok dan nilainya?`)) return
    const res = await fetch(`/api/admin/kelompok/${item.id}`, { method: "DELETE" })
    if (res.ok) load()
    else setError("Gagal menghapus penilaian")
  }

  return (
    <>
      <div className="kp-head">
        <div>
          <h1 className="kp-title">Penilaian Kelompok</h1>
          <p className="kp-sub">
            Buat kelompok mahasiswa, tentukan kriteria kelompok &amp; individu, lalu lihat nilai total per
            mahasiswa.
          </p>
        </div>
        <button id="btn-new-kelompok" className="kp-btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Batal" : "+ Penilaian Baru"}
        </button>
      </div>

      {error && <div className="kp-alert err">{error}</div>}

      {showForm && (
        <form className="kp-card" onSubmit={create}>
          <h2>Penilaian baru</h2>
          <p className="hint">Kelompok dan kriteria diatur di halaman berikutnya.</p>
          <div className="kp-grid2">
            <div className="kp-field">
              <label className="kp-label" htmlFor="kp-nama">Nama penilaian</label>
              <input id="kp-nama" className="kp-input" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="mis. Proyek Akhir Basis Data" required />
            </div>
            <div className="kp-field">
              <label className="kp-label" htmlFor="kp-tahun">Tahun / semester</label>
              <input id="kp-tahun" className="kp-input" value={tahun} onChange={(e) => setTahun(e.target.value)} placeholder="mis. 2026 Ganjil" />
            </div>
          </div>
          <div className="kp-field">
            <label className="kp-label" htmlFor="kp-ket">Keterangan</label>
            <textarea id="kp-ket" className="kp-textarea" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
          </div>
          <button id="btn-create-kelompok" className="kp-btn" disabled={saving || !nama.trim()}>
            {saving ? "Membuat…" : "Buat & atur kelompok →"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="kp-empty">Memuat…</div>
      ) : items.length === 0 ? (
        <div className="kp-empty">Belum ada penilaian kelompok.</div>
      ) : (
        items.map((i) => (
          <div key={i.id} className="kp-list-item">
            <div>
              <div className="kp-list-name">{i.nama}</div>
              <div className="kp-list-meta">
                {i.tahun || "—"}
                {i.keterangan ? ` · ${i.keterangan}` : ""}
              </div>
              <div className="kp-chips">
                <span className="kp-pill blue">{i.jumlahTim} kelompok</span>
                <span className="kp-pill green">{i.jumlahMahasiswa} mahasiswa</span>
                <span className="kp-pill amber">{i.jumlahKriteria} kriteria</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Link href={`/admin/kelompok/${i.id}`} className="kp-btn sm">Buka →</Link>
              <button className="kp-btn sm danger" onClick={() => remove(i)}>Hapus</button>
            </div>
          </div>
        ))
      )}
    </>
  )
}
