"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { computeTotal } from "@/app/src/lib/kelompokScoring"

type Tipe = "KELOMPOK" | "INDIVIDU"
interface Student { nrp: string; nama: string | null; email: string | null }
interface CopyAssessmentItem {
  id: number
  nama: string
  tahun: string | null
  jumlahTim: number
  jumlahMahasiswa: number
}
interface KriteriaDraft { id?: number; key: string; nama: string; tipe: Tipe; bobot: string }
interface TimDraft { id?: number; key: string; nama: string; anggota: string[] }
interface Loaded {
  penilaian: { id: number; nama: string; keterangan: string | null; tahun: string | null }
  kriteria: { id: number; nama: string; tipe: Tipe; bobot: number }[]
  tim: { id: number; nama: string; anggota: { nrp: string; nama: string; email: string }[] }[]
  nilaiTim: { kriteriaId: number; timId: number; nilai: number | null; keterangan: string | null }[]
  nilaiIndividu: { kriteriaId: number; nrp: string; nilai: number | null; keterangan: string | null }[]
}

let keyCounter = 0
const newKey = () => `k${++keyCounter}`

export default function KelompokEditor({ id }: { id: number }) {
  const [tab, setTab] = useState<"kelompok" | "kriteria" | "nilai" | "rekap">("kelompok")
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)

  // draft configuration
  const [info, setInfo] = useState({ nama: "", tahun: "", keterangan: "" })
  const [kriteria, setKriteria] = useState<KriteriaDraft[]>([])
  const [tim, setTim] = useState<TimDraft[]>([])
  const [dirty, setDirty] = useState(false)

  // scores (string inputs)
  const [sTim, setSTim] = useState<Record<string, string>>({})
  const [sInd, setSInd] = useState<Record<string, string>>({})
  const [nTim, setNTim] = useState<Record<string, string>>({}) // keterangan per kriteria × kelompok
  const [nInd, setNInd] = useState<Record<string, string>>({}) // keterangan per kriteria × mahasiswa
  const [scoresDirty, setScoresDirty] = useState(false)

  // batch paste NRP
  const [paste, setPaste] = useState<{ key: string; text: string } | null>(null)
  const [pasteMsg, setPasteMsg] = useState<{ key: string; text: string; ok: boolean } | null>(null)

  const [picker, setPicker] = useState<{ key: string; q: string } | null>(null)

  // tampilan input nilai
  const [nilaiQ, setNilaiQ] = useState("")
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({})

  // modal copy kelompok dari penilaian lain
  const [copyModalOpen, setCopyModalOpen] = useState(false)
  const [copyList, setCopyList] = useState<CopyAssessmentItem[]>([])
  const [copySelectedId, setCopySelectedId] = useState<string>("")
  const [copyPreview, setCopyPreview] = useState<{
    penilaian: { id: number; nama: string; tahun: string | null }
    tim: { id: number; nama: string; anggota: { nrp: string; nama: string }[] }[]
  } | null>(null)
  const [copyMode, setCopyMode] = useState<"replace" | "append">("replace")
  const [copyLoading, setCopyLoading] = useState(false)
  const [copySubmitting, setCopySubmitting] = useState(false)
  const [copyModalError, setCopyModalError] = useState("")

  const load = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/admin/kelompok/${id}`),
        fetch("/api/admin/students"),
      ])
      const d1 = await r1.json()
      const d2 = await r2.json()
      if (!r1.ok) throw new Error(d1.error)
      const l = d1 as Loaded
      setLoaded(l)
      setStudents(d2.students ?? [])
      setInfo({
        nama: l.penilaian.nama,
        tahun: l.penilaian.tahun ?? "",
        keterangan: l.penilaian.keterangan ?? "",
      })
      setKriteria(
        l.kriteria.map((k) => ({ id: k.id, key: newKey(), nama: k.nama, tipe: k.tipe, bobot: String(k.bobot) }))
      )
      setTim(
        l.tim.map((t) => ({ id: t.id, key: newKey(), nama: t.nama, anggota: t.anggota.map((a) => a.nrp) }))
      )
      const a: Record<string, string> = {}
      const na: Record<string, string> = {}
      for (const n of l.nilaiTim) {
        if (n.nilai !== null) a[`${n.kriteriaId}:${n.timId}`] = String(n.nilai)
        if (n.keterangan) na[`${n.kriteriaId}:${n.timId}`] = n.keterangan
      }
      const b: Record<string, string> = {}
      const nb: Record<string, string> = {}
      for (const n of l.nilaiIndividu) {
        if (n.nilai !== null) b[`${n.kriteriaId}:${n.nrp}`] = String(n.nilai)
        if (n.keterangan) nb[`${n.kriteriaId}:${n.nrp}`] = n.keterangan
      }
      setSTim(a)
      setSInd(b)
      setNTim(na)
      setNInd(nb)
      setDirty(false)
      setScoresDirty(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data")
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const studentMap = useMemo(() => new Map(students.map((s) => [s.nrp, s])), [students])
  const assigned = useMemo(() => new Set(tim.flatMap((t) => t.anggota)), [tim])

  // ── actions
  function flash(msg: string) {
    setNotice(msg)
    setTimeout(() => setNotice(""), 3500)
  }

  /** Tambah banyak anggota sekaligus dari teks hasil copy-paste (pisah baris/spasi/koma/titik koma/tab). */
  function addBatch(timKey: string, text: string) {
    const nrps = Array.from(new Set(text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)))
    if (nrps.length === 0) {
      setPasteMsg({ key: timKey, text: "Tidak ada NRP yang terbaca.", ok: false })
      return
    }
    const target = tim.find((t) => t.key === timKey)
    const added: string[] = []
    const unknown: string[] = []
    const other: string[] = []
    for (const nrp of nrps) {
      if (!studentMap.has(nrp)) unknown.push(nrp)
      else if (target?.anggota.includes(nrp)) continue
      else if (assigned.has(nrp)) other.push(nrp)
      else added.push(nrp)
    }
    if (added.length > 0) mutateTim(timKey, (x) => ({ ...x, anggota: [...x.anggota, ...added] }))
    const parts = [`${added.length} mahasiswa ditambahkan`]
    if (other.length) parts.push(`${other.length} sudah di kelompok lain (${other.join(", ")})`)
    if (unknown.length) parts.push(`${unknown.length} NRP tidak ditemukan (${unknown.join(", ")})`)
    setPasteMsg({ key: timKey, text: parts.join(" · "), ok: unknown.length + other.length === 0 })
    if (unknown.length + other.length === 0) setPaste(null)
    else setPaste({ key: timKey, text: [...unknown, ...other].join("\n") })
  }

  async function openCopyModal() {
    setCopyModalOpen(true)
    setCopyModalError("")
    setCopySelectedId("")
    setCopyPreview(null)
    setCopyMode("replace")
    setCopyLoading(true)
    try {
      const res = await fetch("/api/admin/kelompok")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const filtered = (data.items as CopyAssessmentItem[]).filter(
        (i) => i.id !== id && i.jumlahTim > 0
      )
      setCopyList(filtered)
      if (filtered.length > 0) {
        setCopySelectedId(String(filtered[0].id))
        loadCopyPreview(filtered[0].id)
      }
    } catch (e) {
      setCopyModalError(e instanceof Error ? e.message : "Gagal memuat daftar penilaian")
    } finally {
      setCopyLoading(false)
    }
  }

  async function loadCopyPreview(sourceId: number) {
    setCopyLoading(true)
    setCopyModalError("")
    try {
      const res = await fetch(`/api/admin/kelompok/${sourceId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCopyPreview(data)
    } catch (e) {
      setCopyModalError(e instanceof Error ? e.message : "Gagal memuat detail kelompok")
    } finally {
      setCopyLoading(false)
    }
  }

  function handleSelectCopySource(sourceIdStr: string) {
    setCopySelectedId(sourceIdStr)
    if (!sourceIdStr) {
      setCopyPreview(null)
      return
    }
    loadCopyPreview(Number(sourceIdStr))
  }

  function applyCopyToEditor() {
    if (!copyPreview || copyPreview.tim.length === 0) return
    if (copyMode === "replace") {
      const newTimList: TimDraft[] = copyPreview.tim.map((t) => ({
        key: newKey(),
        nama: t.nama,
        anggota: t.anggota.map((a) => a.nrp),
      }))
      setTim(newTimList)
      setDirty(true)
      setCopyModalOpen(false)
      flash(
        `Berhasil menyalin ${newTimList.length} kelompok ke editor. Silakan periksa lalu klik "Simpan konfigurasi" di bawah.`
      )
    } else {
      const assignedNrp = new Set(tim.flatMap((t) => t.anggota))
      let skipped = 0
      const appendTim: TimDraft[] = copyPreview.tim.map((t) => {
        const validAnggota: string[] = []
        for (const a of t.anggota) {
          if (assignedNrp.has(a.nrp)) {
            skipped++
          } else {
            validAnggota.push(a.nrp)
            assignedNrp.add(a.nrp)
          }
        }
        return {
          key: newKey(),
          nama: t.nama,
          anggota: validAnggota,
        }
      })
      setTim((prev) => [...prev, ...appendTim])
      setDirty(true)
      setCopyModalOpen(false)
      let msg = `Berhasil menambahkan ${appendTim.length} kelompok ke editor.`
      if (skipped > 0) msg += ` (${skipped} mahasiswa dilewati karena sudah ada di kelompok lain).`
      msg += ` Klik "Simpan konfigurasi" di bawah untuk menyimpan.`
      flash(msg)
    }
  }

  async function copyAndSaveDirectly() {
    if (!copySelectedId || !copyPreview) return
    const confirmed = confirm(
      copyMode === "replace"
        ? `Apakah Anda yakin ingin menyalin ${copyPreview.tim.length} kelompok dan MENGGANTIKAN seluruh kelompok yang ada di database saat ini?`
        : `Tambahkan ${copyPreview.tim.length} kelompok dari "${copyPreview.penilaian.nama}" dan langsung simpan ke database?`
    )
    if (!confirmed) return

    setCopySubmitting(true)
    setCopyModalError("")
    try {
      const res = await fetch(`/api/admin/kelompok/${id}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcePenilaianId: Number(copySelectedId),
          mode: copyMode,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCopyModalOpen(false)
      await load()
      flash(data.message || "Kelompok berhasil disalin dan disimpan.")
    } catch (e) {
      setCopyModalError(e instanceof Error ? e.message : "Gagal menyalin kelompok")
    } finally {
      setCopySubmitting(false)
    }
  }

  async function saveConfig() {
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/admin/kelompok/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...info,
          kriteria: kriteria.map((k) => ({ id: k.id, nama: k.nama, tipe: k.tipe, bobot: Number(k.bobot) || 0 })),
          tim: tim.map((t) => ({ id: t.id, nama: t.nama, anggota: t.anggota })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await load()
      flash("Konfigurasi tersimpan")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan")
    } finally {
      setBusy(false)
    }
  }

  async function saveScores() {
    if (!loaded) return
    setBusy(true)
    setError("")
    const toNum = (v: string | undefined) => (v === undefined || v.trim() === "" ? null : Number(v))
    try {
      const tPayload = []
      const iPayload = []
      for (const k of loaded.kriteria) {
        if (k.tipe === "KELOMPOK") {
          for (const t of loaded.tim) {
            const kk = `${k.id}:${t.id}`
            tPayload.push({ kriteriaId: k.id, timId: t.id, nilai: toNum(sTim[kk]), keterangan: nTim[kk] ?? "" })
          }
        } else {
          for (const t of loaded.tim)
            for (const a of t.anggota)
              iPayload.push({ kriteriaId: k.id, nrp: a.nrp, nilai: toNum(sInd[`${k.id}:${a.nrp}`]), keterangan: nInd[`${k.id}:${a.nrp}`] ?? "" })
        }
      }
      const res = await fetch(`/api/admin/kelompok/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tim: tPayload, individu: iPayload }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setScoresDirty(false)
      flash("Nilai tersimpan")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan nilai")
    } finally {
      setBusy(false)
    }
  }

  // ── config mutators
  const mutateTim = (key: string, fn: (t: TimDraft) => TimDraft) => {
    setTim((prev) => prev.map((t) => (t.key === key ? fn(t) : t)))
    setDirty(true)
  }
  const mutateKrit = (key: string, patch: Partial<KriteriaDraft>) => {
    setKriteria((prev) => prev.map((k) => (k.key === key ? { ...k, ...patch } : k)))
    setDirty(true)
  }
  const addKrit = (tipe: Tipe) => {
    setKriteria((p) => [...p, { key: newKey(), nama: "", tipe, bobot: "" }])
    setDirty(true)
  }

  // ── recap
  const recap = useMemo(() => {
    if (!loaded) return []
    const nt = new Map<string, number | null>()
    const ni = new Map<string, number | null>()
    const parse = (v: string | undefined) => (v === undefined || v.trim() === "" ? null : Number(v))
    for (const k of loaded.kriteria) {
      if (k.tipe === "KELOMPOK") for (const t of loaded.tim) nt.set(`${k.id}:${t.id}`, parse(sTim[`${k.id}:${t.id}`]))
      else for (const t of loaded.tim) for (const a of t.anggota) ni.set(`${k.id}:${a.nrp}`, parse(sInd[`${k.id}:${a.nrp}`]))
    }
    return loaded.tim
      .flatMap((t) =>
        t.anggota.map((a) => {
          const r = computeTotal({ nrp: a.nrp, timId: t.id }, loaded.kriteria, nt, ni)
          return { ...a, tim: t.nama, timId: t.id, ...r, nt, ni }
        })
      )
      .sort((x, y) => y.total - x.total)
  }, [loaded, sTim, sInd])

  function exportCsv() {
    if (!loaded) return
    const head = ["NRP", "Nama", "Kelompok", ...loaded.kriteria.map((k) => `${k.nama} (${k.tipe}, ${k.bobot}%)`), "Nilai Total"]
    const rows = recap.map((r) => [
      r.nrp, r.nama, r.tim,
      ...loaded.kriteria.map((k) => {
        const v = k.tipe === "KELOMPOK" ? r.nt.get(`${k.id}:${r.timId}`) : r.ni.get(`${k.id}:${r.nrp}`)
        return v ?? ""
      }),
      r.total.toFixed(2),
    ])
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }))
    a.download = `${loaded.penilaian.nama}.csv`
    a.click()
  }

  if (!loaded) {
    return error ? <div className="kp-alert err">{error}</div> : <div className="kp-empty">Memuat…</div>
  }

  const totalBobot = kriteria.reduce((s, k) => s + (Number(k.bobot) || 0), 0)
  const kGroup = kriteria.filter((k) => k.tipe === "KELOMPOK")
  const kInd = kriteria.filter((k) => k.tipe === "INDIVIDU")
  const lGroup = loaded.kriteria.filter((k) => k.tipe === "KELOMPOK")
  const lInd = loaded.kriteria.filter((k) => k.tipe === "INDIVIDU")

  const filteredStudents = (q: string) => {
    const s = q.trim().toLowerCase()
    return students
      .filter((st) => !assigned.has(st.nrp))
      .filter((st) => !s || st.nrp.toLowerCase().includes(s) || (st.nama ?? "").toLowerCase().includes(s))
      .slice(0, 50)
  }

  const renderKritSection = (title: string, hint: string, list: KriteriaDraft[], tipe: Tipe) => (
    <div className="kp-card">
      <h2>{title}</h2>
      <p className="hint">{hint}</p>
      {list.length === 0 && <p className="hint">Belum ada kriteria.</p>}
      {list.map((k) => (
        <div key={k.key} className="kp-krit-row">
          <input className="kp-input" placeholder="Nama kriteria" value={k.nama} onChange={(e) => mutateKrit(k.key, { nama: e.target.value })} />
          <input className="kp-input" type="number" min={0} step="any" placeholder="Bobot %" value={k.bobot} onChange={(e) => mutateKrit(k.key, { bobot: e.target.value })} />
          <button className="kp-btn sm danger" title="Hapus" onClick={() => { setKriteria((p) => p.filter((x) => x.key !== k.key)); setDirty(true) }}>✕</button>
        </div>
      ))}
      <button className="kp-btn sm ghost" onClick={() => addKrit(tipe)}>+ Tambah kriteria</button>
    </div>
  )

  return (
    <>
      <Link href="/admin/kelompok" className="kp-back">← Semua penilaian kelompok</Link>
      <div className="kp-head">
        <div>
          <h1 className="kp-title">{loaded.penilaian.nama}</h1>
          <p className="kp-sub">
            {loaded.penilaian.tahun || "—"} · {loaded.tim.length} kelompok ·{" "}
            {loaded.tim.reduce((s, t) => s + t.anggota.length, 0)} mahasiswa
          </p>
        </div>
      </div>

      {error && <div className="kp-alert err">{error}</div>}
      {notice && <div className="kp-alert ok">{notice}</div>}
      {dirty && tab !== "kelompok" && tab !== "kriteria" && (
        <div className="kp-alert warn">Ada perubahan kelompok/kriteria yang belum disimpan. Simpan konfigurasi dulu agar muncul di sini.</div>
      )}

      <div className="kp-tabs" role="tablist">
        {([["kelompok", "1. Kelompok"], ["kriteria", "2. Kriteria"], ["nilai", "3. Input Nilai"], ["rekap", "4. Rekap Nilai Total"]] as const).map(([k, label]) => (
          <button key={k} id={`tab-${k}`} role="tab" className={`kp-tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {/* ── KELOMPOK ── */}
      {tab === "kelompok" && (
        <>
          <div className="kp-card">
            <h2>Informasi penilaian</h2>
            <div className="kp-grid2" style={{ marginTop: 12 }}>
              <div className="kp-field">
                <label className="kp-label">Nama</label>
                <input className="kp-input" value={info.nama} onChange={(e) => { setInfo({ ...info, nama: e.target.value }); setDirty(true) }} />
              </div>
              <div className="kp-field">
                <label className="kp-label">Tahun / semester</label>
                <input className="kp-input" value={info.tahun} onChange={(e) => { setInfo({ ...info, tahun: e.target.value }); setDirty(true) }} />
              </div>
            </div>
            <label className="kp-label">Keterangan</label>
            <textarea className="kp-textarea" value={info.keterangan} onChange={(e) => { setInfo({ ...info, keterangan: e.target.value }); setDirty(true) }} />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "20px 0 12px", flexWrap: "wrap", gap: 10 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Kelompok Mahasiswa</h2>
              <span className="hint" style={{ margin: "2px 0 0", display: "inline-block" }}>
                {tim.length} kelompok terdaftar · {assigned.size} mahasiswa
              </span>
            </div>
            <button
              id="btn-open-copy"
              type="button"
              className="kp-btn ghost sm"
              onClick={openCopyModal}
              title="Salin semua kelompok beserta anggotanya dari penilaian lain"
            >
              📋 Salin dari Penilaian Lain
            </button>
          </div>

          {tim.length === 0 && (
            <div className="kp-card" style={{ textAlign: "center", padding: "36px 20px" }}>
              <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>Belum ada kelompok</p>
              <p className="hint" style={{ marginBottom: 18 }}>
                Mulai dengan menambah kelompok secara manual atau salin seluruh kelompok beserta anggotanya dari penilaian sebelumnya.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <button
                  id="btn-add-tim-empty"
                  type="button"
                  className="kp-btn"
                  onClick={() => {
                    setTim((p) => [...p, { key: newKey(), nama: `Kelompok ${p.length + 1}`, anggota: [] }])
                    setDirty(true)
                  }}
                >
                  + Tambah kelompok manual
                </button>
                <button
                  id="btn-copy-empty"
                  type="button"
                  className="kp-btn ghost"
                  onClick={openCopyModal}
                >
                  📋 Salin Kelompok dari Penilaian Lain
                </button>
              </div>
            </div>
          )}

          {tim.map((t, idx) => (
            <div key={t.key} className="kp-card">
              <div className="kp-team-head">
                <input className="kp-input" style={{ fontWeight: 600 }} value={t.nama} placeholder={`Kelompok ${idx + 1}`} onChange={(e) => mutateTim(t.key, (x) => ({ ...x, nama: e.target.value }))} />
                <span className="kp-pill blue">{t.anggota.length} anggota</span>
                <button className="kp-btn sm danger" onClick={() => { if (confirm(`Hapus ${t.nama || "kelompok ini"}?`)) { setTim((p) => p.filter((x) => x.key !== t.key)); setDirty(true) } }}>Hapus</button>
              </div>
              <div className="kp-members">
                {t.anggota.length === 0 && <span className="hint" style={{ fontSize: 12, color: "#bbb" }}>Belum ada anggota</span>}
                {t.anggota.map((nrp) => (
                  <span key={nrp} className="kp-member">
                    {studentMap.get(nrp)?.nama ?? nrp} <small>{nrp}</small>
                    <button title="Keluarkan" onClick={() => mutateTim(t.key, (x) => ({ ...x, anggota: x.anggota.filter((n) => n !== nrp) }))}>✕</button>
                  </span>
                ))}
              </div>
              <div className="kp-picker">
                <input
                  className="kp-input"
                  placeholder="Cari mahasiswa (NRP / nama) untuk ditambahkan…"
                  value={picker?.key === t.key ? picker.q : ""}
                  onFocus={() => setPicker({ key: t.key, q: "" })}
                  onChange={(e) => setPicker({ key: t.key, q: e.target.value })}
                  onBlur={() => setTimeout(() => setPicker((p) => (p?.key === t.key ? null : p)), 150)}
                />
                {picker?.key === t.key && (
                  <div className="kp-dropdown">
                    {filteredStudents(picker.q).length === 0 ? (
                      <div className="none">Tidak ada mahasiswa tersedia</div>
                    ) : (
                      filteredStudents(picker.q).map((s) => (
                        <button key={s.nrp} onMouseDown={(e) => e.preventDefault()} onClick={() => mutateTim(t.key, (x) => ({ ...x, anggota: [...x.anggota, s.nrp] }))}>
                          <span>{s.nama ?? s.nrp}</span>
                          <small>{s.nrp}</small>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <div style={{ marginTop: 10 }}>
                {paste?.key === t.key ? (
                  <>
                    <textarea
                      className="kp-textarea"
                      autoFocus
                      placeholder={"Tempel daftar NRP di sini (satu per baris, atau dipisah spasi/koma/tab)\nmis. dari kolom Excel"}
                      value={paste.text}
                      onChange={(e) => setPaste({ key: t.key, text: e.target.value })}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button className="kp-btn sm" onClick={() => addBatch(t.key, paste.text)}>Tambahkan</button>
                      <button className="kp-btn sm ghost" onClick={() => { setPaste(null); setPasteMsg(null) }}>Tutup</button>
                    </div>
                  </>
                ) : (
                  <button className="kp-btn sm ghost" onClick={() => { setPaste({ key: t.key, text: "" }); setPasteMsg(null) }}>Tempel banyak NRP</button>
                )}
                {pasteMsg?.key === t.key && (
                  <div className={`kp-alert ${pasteMsg.ok ? "ok" : "warn"}`} style={{ marginTop: 10, marginBottom: 0 }}>{pasteMsg.text}</div>
                )}
              </div>
            </div>
          ))}
          {tim.length > 0 && (
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <button
                id="btn-add-tim"
                type="button"
                className="kp-btn ghost"
                onClick={() => {
                  setTim((p) => [...p, { key: newKey(), nama: `Kelompok ${p.length + 1}`, anggota: [] }])
                  setDirty(true)
                }}
              >
                + Tambah kelompok
              </button>
              <button
                id="btn-copy-bottom"
                type="button"
                className="kp-btn ghost"
                onClick={openCopyModal}
              >
                📋 Salin Kelompok dari Penilaian Lain
              </button>
            </div>
          )}
        </>
      )}

      {/* ── KRITERIA ── */}
      {tab === "kriteria" && (
        <>
          {renderKritSection("Kriteria penilaian kelompok", "Satu nilai untuk seluruh kelompok; semua anggota mendapat nilai yang sama.", kGroup, "KELOMPOK")}
          {renderKritSection("Kriteria penilaian individu", "Nilai diberikan terpisah untuk setiap mahasiswa.", kInd, "INDIVIDU")}
          <div className={`kp-sum ${Math.abs(totalBobot - 100) < 0.001 ? "ok" : "warn"}`}>
            Total bobot: <b>{totalBobot}%</b> {Math.abs(totalBobot - 100) < 0.001 ? "✓" : "— disarankan 100%. Nilai total tetap dinormalisasi terhadap total bobot."}
          </div>
        </>
      )}

      {/* ── NILAI ── */}
      {tab === "nilai" && (
        <>
          {loaded.kriteria.length === 0 || loaded.tim.length === 0 ? (
            <div className="kp-empty">Tambahkan kelompok dan kriteria terlebih dahulu, lalu simpan konfigurasi.</div>
          ) : (
            <>
              <div className="kp-card" style={{ padding: "14px 18px" }}>
                <input
                  id="nilai-search"
                  className="kp-input"
                  placeholder="Cari kelompok, nama, atau NRP mahasiswa…"
                  value={nilaiQ}
                  onChange={(e) => setNilaiQ(e.target.value)}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button className="kp-btn sm ghost" onClick={() => setCollapsed(Object.fromEntries(loaded.tim.map((t) => [t.id, false])))}>Buka semua</button>
                  <button className="kp-btn sm ghost" onClick={() => setCollapsed(Object.fromEntries(loaded.tim.map((t) => [t.id, true])))}>Tutup semua</button>
                </div>
              </div>
              {loaded.tim
                .filter((t) => {
                  const q = nilaiQ.trim().toLowerCase()
                  if (!q) return true
                  return (
                    t.nama.toLowerCase().includes(q) ||
                    t.anggota.some((a) => a.nrp.toLowerCase().includes(q) || a.nama.toLowerCase().includes(q))
                  )
                })
                .map((t) => {
                  const slots = lGroup.length + lInd.length * t.anggota.length
                  const filled =
                    lGroup.filter((k) => (sTim[`${k.id}:${t.id}`] ?? "").trim() !== "").length +
                    t.anggota.reduce((s, a) => s + lInd.filter((k) => (sInd[`${k.id}:${a.nrp}`] ?? "").trim() !== "").length, 0)
                  const complete = slots > 0 && filled === slots
                  const q = nilaiQ.trim().toLowerCase()
                  const open = q ? true : !collapsed[t.id]
                  return (
                    <div key={t.id} className="kp-card" id={`nilai-tim-${t.id}`}>
                      <div className="kp-team-toggle" onClick={() => setCollapsed({ ...collapsed, [t.id]: open })}>
                        <div>
                          <h2 style={{ marginBottom: 2 }}>{t.nama}</h2>
                          <span className="kp-mono">{t.anggota.map((a) => a.nama).join(", ") || "Belum ada anggota"}</span>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span className={`kp-pill ${complete ? "green" : "amber"}`}>{filled}/{slots} terisi</span>
                          <span style={{ color: "#999" }}>{open ? "▲" : "▼"}</span>
                        </div>
                      </div>

                      {open && (
                        <div style={{ marginTop: 16 }}>
                          {lGroup.length > 0 && (
                            <>
                              <p className="kp-label">Nilai kelompok · sekali untuk seluruh anggota</p>
                              {lGroup.map((k) => (
                                <div key={k.id} className="kp-nilai-row">
                                  <div className="kp-nilai-label">{k.nama} <span className="kp-mono">{k.bobot}%</span></div>
                                  <input className="kp-input kp-score" type="number" min={0} max={100} step="any" placeholder="Nilai" value={sTim[`${k.id}:${t.id}`] ?? ""} onChange={(e) => { setSTim({ ...sTim, [`${k.id}:${t.id}`]: e.target.value }); setScoresDirty(true) }} />
                                  <textarea className="kp-textarea kp-note" placeholder="Keterangan penilaian" value={nTim[`${k.id}:${t.id}`] ?? ""} onChange={(e) => { setNTim({ ...nTim, [`${k.id}:${t.id}`]: e.target.value }); setScoresDirty(true) }} />
                                </div>
                              ))}
                            </>
                          )}

                          {lInd.length > 0 && t.anggota.length > 0 && (
                            <>
                              <p className="kp-label" style={{ marginTop: 18 }}>Nilai individu</p>
                              <div className="kp-table-wrap">
                                <table className="kp-table">
                                  <thead><tr><th>Mahasiswa</th>{lInd.map((k) => <th key={k.id}>{k.nama} ({k.bobot}%)</th>)}</tr></thead>
                                  <tbody>
                                    {t.anggota.map((a) => (
                                      <tr key={a.nrp}>
                                        <td style={{ verticalAlign: "top" }}>{a.nama}<br /><span className="kp-mono">{a.nrp}</span></td>
                                        {lInd.map((k) => (
                                          <td key={k.id} className="num">
                                            <input className="kp-input kp-score" type="number" min={0} max={100} step="any" placeholder="Nilai" value={sInd[`${k.id}:${a.nrp}`] ?? ""} onChange={(e) => { setSInd({ ...sInd, [`${k.id}:${a.nrp}`]: e.target.value }); setScoresDirty(true) }} />
                                            <textarea className="kp-textarea kp-note" placeholder="Keterangan penilaian" value={nInd[`${k.id}:${a.nrp}`] ?? ""} onChange={(e) => { setNInd({ ...nInd, [`${k.id}:${a.nrp}`]: e.target.value }); setScoresDirty(true) }} />
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
            </>
          )}
        </>
      )}

      {/* ── REKAP ── */}
      {tab === "rekap" && (
        <div className="kp-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <h2>Nilai total per mahasiswa</h2>
              <p className="hint" style={{ marginBottom: 0 }}>Σ (nilai × bobot) ÷ Σ bobot. Nilai kosong dihitung 0.</p>
            </div>
            <button className="kp-btn sm ghost" onClick={exportCsv} disabled={recap.length === 0}>Unduh CSV</button>
          </div>
          {recap.length === 0 ? (
            <div className="kp-empty">Belum ada anggota kelompok.</div>
          ) : (
            <div className="kp-table-wrap">
              <table className="kp-table">
                <thead>
                  <tr>
                    <th>#</th><th>Mahasiswa</th><th>Kelompok</th>
                    {loaded.kriteria.map((k) => <th key={k.id} className="num" title={k.tipe}>{k.nama} · {k.bobot}%</th>)}
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recap.map((r, i) => (
                    <tr key={r.nrp}>
                      <td className="kp-rank">{i + 1}</td>
                      <td>{r.nama} <span className="kp-mono">{r.nrp}</span></td>
                      <td>{r.tim}</td>
                      {loaded.kriteria.map((k) => {
                        const v = k.tipe === "KELOMPOK" ? r.nt.get(`${k.id}:${r.timId}`) : r.ni.get(`${k.id}:${r.nrp}`)
                        return <td key={k.id} className="num">{v ?? <span style={{ color: "#ccc" }}>—</span>}</td>
                      })}
                      <td className="num kp-total">{r.total.toFixed(2)}{!r.complete && <span title="Ada nilai yang belum diisi" style={{ color: "#c97d10" }}> *</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {dirty && <p className="hint" style={{ marginTop: 12 }}>Rekap memakai konfigurasi yang sudah tersimpan.</p>}
          {scoresDirty && <p className="hint" style={{ marginTop: 12 }}>Ada nilai yang belum disimpan (tetap dihitung di tabel ini).</p>}
        </div>
      )}

      {/* ── save bar ── */}
      {(tab === "kelompok" || tab === "kriteria") && (
        <div className="kp-savebar">
          <button id="btn-save-config" className="kp-btn" disabled={busy || !dirty} onClick={saveConfig}>{busy ? "Menyimpan…" : dirty ? "Simpan konfigurasi" : "Tersimpan ✓"}</button>
        </div>
      )}
      {tab === "nilai" && loaded.tim.length > 0 && loaded.kriteria.length > 0 && (
        <div className="kp-savebar">
          <button id="btn-save-scores" className="kp-btn" disabled={busy || !scoresDirty} onClick={saveScores}>{busy ? "Menyimpan…" : scoresDirty ? "Simpan nilai" : "Tersimpan ✓"}</button>
        </div>
      )}

      {/* ── Modal Copy Kelompok dari Penilaian Lain ── */}
      {copyModalOpen && (
        <div className="kp-modal-backdrop" onClick={() => !copySubmitting && setCopyModalOpen(false)}>
          <div className="kp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="kp-modal-head">
              <h3 className="kp-modal-title">Salin Kelompok dari Penilaian Lain</h3>
              <button
                type="button"
                className="kp-modal-close"
                onClick={() => setCopyModalOpen(false)}
                disabled={copySubmitting}
                aria-label="Tutup modal"
              >
                ✕
              </button>
            </div>

            <div className="kp-modal-body">
              <p className="hint" style={{ marginTop: 0, marginBottom: 14 }}>
                Pilih penilaian yang ingin disalin. Semua kelompok beserta anggotanya akan disalin ke penilaian ini.
              </p>

              {copyModalError && <div className="kp-alert err">{copyModalError}</div>}

              {copyList.length === 0 && !copyLoading ? (
                <div className="kp-empty" style={{ padding: "20px 0" }}>
                  Tidak ada penilaian lain yang memiliki kelompok untuk disalin.
                </div>
              ) : (
                <>
                  <div className="kp-field">
                    <label className="kp-label" htmlFor="select-copy-source">Pilih Penilaian Sumber</label>
                    <select
                      id="select-copy-source"
                      className="kp-select"
                      value={copySelectedId}
                      onChange={(e) => handleSelectCopySource(e.target.value)}
                      disabled={copyLoading || copySubmitting}
                    >
                      {copyList.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nama} {item.tahun ? `(${item.tahun})` : ""} — {item.jumlahTim} kelompok, {item.jumlahMahasiswa} mahasiswa
                        </option>
                      ))}
                    </select>
                  </div>

                  {copyLoading && (
                    <div className="hint" style={{ textAlign: "center", padding: 10 }}>
                      Memuat detail kelompok…
                    </div>
                  )}

                  {copyPreview && (
                    <>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
                        <span className="kp-pill blue">{copyPreview.tim.length} kelompok</span>
                        <span className="kp-pill green">
                          {copyPreview.tim.reduce((s, t) => s + t.anggota.length, 0)} mahasiswa
                        </span>
                      </div>

                      <div className="kp-copy-preview">
                        {copyPreview.tim.map((t, idx) => (
                          <div key={t.id || idx} className="kp-copy-team-item">
                            <div className="kp-copy-team-name">
                              {t.nama} <span style={{ fontWeight: 400, color: "#888" }}>({t.anggota.length} anggota)</span>
                            </div>
                            <div className="kp-copy-team-members">
                              {t.anggota.length === 0 ? (
                                <span style={{ color: "#aaa", fontStyle: "italic" }}>Tidak ada anggota</span>
                              ) : (
                                t.anggota.map((a) => `${a.nama} (${a.nrp})`).join(", ")
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {tim.length > 0 && (
                        <div className="kp-radio-group">
                          <label className="kp-radio-label">
                            <input
                              type="radio"
                              name="copyMode"
                              value="replace"
                              checked={copyMode === "replace"}
                              onChange={() => setCopyMode("replace")}
                              disabled={copySubmitting}
                            />
                            <div>
                              <div className="kp-radio-text-title">Gantikan semua kelompok saat ini</div>
                              <div className="kp-radio-text-sub">
                                Semua {tim.length} kelompok saat ini di halaman ini akan digantikan dengan {copyPreview.tim.length} kelompok di atas.
                              </div>
                            </div>
                          </label>
                          <label className="kp-radio-label">
                            <input
                              type="radio"
                              name="copyMode"
                              value="append"
                              checked={copyMode === "append"}
                              onChange={() => setCopyMode("append")}
                              disabled={copySubmitting}
                            />
                            <div>
                              <div className="kp-radio-text-title">Tambahkan ke kelompok saat ini</div>
                              <div className="kp-radio-text-sub">
                                Kelompok di atas akan ditambahkan tanpa menghapus kelompok saat ini. Mahasiswa yang sudah terdaftar akan dilewati.
                              </div>
                            </div>
                          </label>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            <div className="kp-modal-footer">
              <button
                type="button"
                className="kp-btn sm ghost"
                onClick={() => setCopyModalOpen(false)}
                disabled={copySubmitting}
              >
                Batal
              </button>
              {copyPreview && copyPreview.tim.length > 0 && (
                <>
                  <button
                    type="button"
                    className="kp-btn sm"
                    onClick={applyCopyToEditor}
                    disabled={copySubmitting || copyLoading}
                    title="Terapkan ke editor agar bisa diperiksa sebelum disimpan"
                  >
                    Salin ke Editor
                  </button>
                  <button
                    type="button"
                    className="kp-btn sm ghost"
                    onClick={copyAndSaveDirectly}
                    disabled={copySubmitting || copyLoading}
                    title="Langsung simpan kelompok ke database"
                  >
                    {copySubmitting ? "Menyimpan…" : "Salin & Langsung Simpan"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
