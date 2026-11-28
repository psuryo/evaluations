"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import MarkdownViewer from "@/app/src/components/MarkdownViewer"

interface CourseOption {
  idkuliah: number
  matkul: string
  tahun: string
}

interface CriteriaItem {
  judulkriteria: string
  kriteria: string
  bobot: number | ""
}

interface StudentOption {
  nrp: string
  nama: string | null
  email: string | null
}

const PRESET_TEMPLATES = [
  {
    name: "Standard Akademik (Tugas 30, UTS 35, UAS 35 — Total: 100 Poin)",
    criteria: [
      { judulkriteria: "Tugas & Kuis", kriteria: "Rata-rata nilai tugas individu, kelompok, dan kuis berkala", bobot: 30 },
      { judulkriteria: "UTS", kriteria: "Ujian Tengah Semester - Evaluasi teori dan pemahaman konsep", bobot: 35 },
      { judulkriteria: "UAS", kriteria: "Ujian Akhir Semester - Evaluasi komprehensif akhir semester", bobot: 35 },
    ],
  },
  {
    name: "Teori & Praktikum (Keaktifan 10, Tugas 20, UTS 30, UAS 40 — Total: 100 Poin)",
    criteria: [
      { judulkriteria: "Keaktifan", kriteria: "Partisipasi aktif dalam sesi diskusi dan kehadiran perkuliahan", bobot: 10 },
      { judulkriteria: "Tugas Praktikum", kriteria: "Penyelesaian modul laboratorium dan laporan praktikum mingguan", bobot: 20 },
      { judulkriteria: "UTS", kriteria: "Ujian Tengah Semester tertulis dan studi kasus", bobot: 30 },
      { judulkriteria: "UAS & Proyek", kriteria: "Ujian Akhir Semester dan implementasi proyek akhir", bobot: 40 },
    ],
  },
  {
    name: "Project-Based Learning (Proposal 15, Milestone 25, Final Project 40, Presentasi 20 — Total: 100 Poin)",
    criteria: [
      { judulkriteria: "Proposal Proyek", kriteria: "Dokumen proposal, latar belakang, dan perancangan sistem awal", bobot: 15 },
      { judulkriteria: "Milestone Progres", kriteria: "Pencapaian sprint/milestone berkala dan dokumentasi teknis", bobot: 25 },
      { judulkriteria: "Produk & Hasil Akhir", kriteria: "Fungsionalitas produk akhir, arsitektur kode, dan pengujian sistem", bobot: 40 },
      { judulkriteria: "Presentasi & Demo", kriteria: "Kemampuan mempresentasikan karya, tanya jawab, dan demonstrasi", bobot: 20 },
    ],
  },
]

export default function NewNilaiForm({
  availableCourses,
  initialCourseId,
}: {
  availableCourses: CourseOption[]
  initialCourseId?: number
}) {
  const router = useRouter()

  const defaultSelected =
    initialCourseId && availableCourses.some((c) => c.idkuliah === initialCourseId)
      ? String(initialCourseId)
      : availableCourses[0]
        ? String(availableCourses[0].idkuliah)
        : ""

  const [selectedCourseId, setSelectedCourseId] = useState<string>(defaultSelected)
  const [kunciJawaban, setKunciJawaban] = useState("")
  const [kunciJawabanTab, setKunciJawabanTab] = useState<"edit" | "preview">("edit")
  const [criteriaList, setCriteriaList] = useState<CriteriaItem[]>([
    { judulkriteria: "Tugas & Proyek", kriteria: "Penugasan berkala dan implementasi proyek", bobot: 30 },
    { judulkriteria: "UTS", kriteria: "Ujian Tengah Semester", bobot: 35 },
    { judulkriteria: "UAS", kriteria: "Ujian Akhir Semester", bobot: 35 },
  ])

  const [studentMode, setStudentMode] = useState<"none" | "paste" | "select">("none")
  const [pastedNrps, setPastedNrps] = useState("")
  const [availableStudents, setAvailableStudents] = useState<StudentOption[]>([])
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [studentSearch, setStudentSearch] = useState("")
  const [loadingStudents, setLoadingStudents] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    if (studentMode === "select" && availableStudents.length === 0) {
      setLoadingStudents(true)
      fetch("/api/admin/students")
        .then((res) => res.json())
        .then((data) => {
          if (data.students) setAvailableStudents(data.students)
        })
        .catch((err) => console.error("Error loading students:", err))
        .finally(() => setLoadingStudents(false))
    }
  }, [studentMode, availableStudents.length])

  const totalBobot = criteriaList.reduce((acc, curr) => {
    const b = typeof curr.bobot === "number" ? curr.bobot : 0
    return acc + b
  }, 0)

  const isExact100 = totalBobot === 100
  const isUnder100 = totalBobot < 100
  const isOver100 = totalBobot > 100

  const addCriteriaRow = () => {
    const remaining = Math.max(0, 100 - totalBobot)
    setCriteriaList([
      ...criteriaList,
      {
        judulkriteria: `Kriteria ${criteriaList.length + 1}`,
        kriteria: "",
        bobot: remaining > 0 ? remaining : "",
      },
    ])
  }

  const removeCriteriaRow = (index: number) => {
    if (criteriaList.length <= 1) {
      setErrorMsg("Minimal harus ada 1 kriteria penilaian.")
      return
    }
    setCriteriaList(criteriaList.filter((_, i) => i !== index))
  }

  const updateCriteriaField = (index: number, field: keyof CriteriaItem, value: string | number) => {
    setErrorMsg("")
    const updated = [...criteriaList]
    if (field === "bobot") {
      const num = value === "" ? "" : Math.max(0, Math.min(100, parseInt(String(value), 10) || 0))
      updated[index] = { ...updated[index], bobot: num }
    } else {
      updated[index] = { ...updated[index], [field]: value }
    }
    setCriteriaList(updated)
  }

  const moveRow = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= criteriaList.length) return
    const updated = [...criteriaList]
    const temp = updated[index]
    updated[index] = updated[targetIndex]
    updated[targetIndex] = temp
    setCriteriaList(updated)
  }

  const autoBalance = () => {
    if (criteriaList.length === 0) return
    const count = criteriaList.length
    const base = Math.floor(100 / count)
    const remainder = 100 % count
    setCriteriaList(
      criteriaList.map((c, i) => ({
        ...c,
        bobot: base + (i < remainder ? 1 : 0),
      }))
    )
    setErrorMsg("")
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (typeof text === "string") {
        setKunciJawaban(text)
        setKunciJawabanTab("edit")
      }
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  const handleDropFile = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (typeof text === "string") {
        setKunciJawaban(text)
        setKunciJawabanTab("edit")
      }
    }
    reader.readAsText(file)
  }

  const filteredStudents = availableStudents.filter(
    (s) =>
      s.nrp.toLowerCase().includes(studentSearch.toLowerCase()) ||
      (s.nama && s.nama.toLowerCase().includes(studentSearch.toLowerCase()))
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg("")

    if (!selectedCourseId) {
      setErrorMsg("Pilih mata kuliah terlebih dahulu.")
      return
    }

    for (let i = 0; i < criteriaList.length; i++) {
      const c = criteriaList[i]
      if (!c.judulkriteria.trim()) {
        setErrorMsg(`Judul kriteria pada baris #${i + 1} belum diisi.`)
        return
      }
      if (!c.kriteria.trim()) {
        setErrorMsg(`Deskripsi kriteria "${c.judulkriteria}" belum diisi.`)
        return
      }
      if (typeof c.bobot !== "number" || c.bobot <= 0) {
        setErrorMsg(`Bobot untuk "${c.judulkriteria}" harus lebih dari 0%.`)
        return
      }
    }

    if (totalBobot !== 100) {
      setErrorMsg(`Total keseluruhan bobot harus tepat 100%. Saat ini ${totalBobot}%.`)
      return
    }

    let studentList: string[] = []
    if (studentMode === "paste" && pastedNrps.trim()) {
      studentList = Array.from(
        new Set(
          pastedNrps
            .split(/[\n,;]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        )
      )
    } else if (studentMode === "select" && selectedStudents.length > 0) {
      studentList = selectedStudents
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/nilai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idkuliah: Number(selectedCourseId),
          kunci_jawaban: kunciJawaban.trim() || null,
          kriteriaList: criteriaList.map((c) => ({
            judulkriteria: c.judulkriteria.trim(),
            kriteria: c.kriteria.trim(),
            bobot: Number(c.bobot),
          })),
          students: studentList,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Gagal membuat nilai.")
      }
      router.push(`/admin/kuliah/${selectedCourseId}/nilai`)
      router.refresh()
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Terjadi kesalahan.")
      setSubmitting(false)
    }
  }

  if (availableCourses.length === 0) {
    return (
      <div
        style={{
          background: "#fff",
          border: "0.5px solid rgba(0,0,0,0.08)",
          borderRadius: "14px",
          padding: "48px 28px",
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: "16px", fontWeight: 600, color: "#111", marginBottom: "8px" }}>
          Semua Mata Kuliah Sudah Digunakan pada Tabel Nilai
        </p>
        <p style={{ fontSize: "13px", color: "#777", marginBottom: "20px" }}>
          Tidak ada mata kuliah yang belum memiliki data nilai. Buat mata kuliah baru terlebih dahulu atau kelola nilai pada mata kuliah yang sudah ada.
        </p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/admin/kuliah/new"
            style={{
              padding: "10px 18px",
              background: "#111",
              color: "#fff",
              borderRadius: "8px",
              textDecoration: "none",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            + Buat Kuliah Baru
          </Link>
          <Link
            href="/admin/kuliah"
            style={{
              padding: "10px 18px",
              background: "#f4f3ef",
              color: "#111",
              borderRadius: "8px",
              textDecoration: "none",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            Kembali ke Kelola Kuliah
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        .nnf-form { display: flex; flex-direction: column; gap: 24px; }
        .nnf-card {
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.08);
          border-radius: 14px;
          padding: 26px 30px;
        }
        .nnf-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
          padding-bottom: 12px;
          border-bottom: 0.5px solid rgba(0,0,0,0.06);
          flex-wrap: wrap;
        }
        .nnf-card-title { font-size: 16px; font-weight: 600; color: #111; }
        .nnf-card-sub { font-size: 13px; color: #888; font-weight: 300; margin-top: 2px; }
        .nnf-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #555;
          display: block;
          margin-bottom: 6px;
        }
        .nnf-input, .nnf-select {
          font-family: inherit;
          font-size: 14px;
          padding: 10px 14px;
          border: 0.5px solid rgba(0,0,0,0.18);
          border-radius: 8px;
          background: #fafaf8;
          color: #111;
          outline: none;
          width: 100%;
        }
        .nnf-input:focus, .nnf-select:focus { border-color: #111; background: #fff; }
        .nnf-presets { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
        .nnf-preset-btn {
          font-family: inherit;
          font-size: 12px;
          padding: 6px 14px;
          border-radius: 20px;
          background: #f4f3ef;
          color: #444;
          border: 0.5px solid rgba(0,0,0,0.1);
          cursor: pointer;
        }
        .nnf-preset-btn:hover { background: #111; color: #fff; border-color: #111; }
        .nnf-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
        .nnf-table th {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          color: #888;
          text-align: left;
          padding: 10px 10px;
          border-bottom: 1px solid rgba(0,0,0,0.08);
        }
        .nnf-table td { padding: 8px 10px; border-bottom: 0.5px solid rgba(0,0,0,0.05); vertical-align: middle; }
        .nnf-btn-icon {
          background: none;
          border: none;
          color: #888;
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
        }
        .nnf-btn-icon:hover { background: #eae9e4; color: #111; }
        .nnf-btn-icon.delete:hover { background: #fde8e8; color: #c0392b; }
        .nnf-btn-add {
          font-family: inherit;
          font-size: 13px;
          font-weight: 500;
          color: #111;
          background: #f4f3ef;
          border: 0.5px solid rgba(0,0,0,0.12);
          border-radius: 8px;
          padding: 8px 16px;
          cursor: pointer;
        }
        .nnf-btn-balance {
          font-family: inherit;
          font-size: 11px;
          font-weight: 600;
          padding: 5px 10px;
          border-radius: 6px;
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.15);
          color: #333;
          cursor: pointer;
        }
        .nnf-bobot-card {
          border-radius: 12px;
          padding: 16px 20px;
          margin-top: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .nnf-bobot-card.exact { background: #f0faf5; border: 1px solid #a8d8bc; color: #1f6b45; }
        .nnf-bobot-card.under { background: #fdf8ee; border: 1px solid #e8d08a; color: #8a6200; }
        .nnf-bobot-card.over { background: #fdf2f2; border: 1px solid #f8b4b4; color: #b91c1c; }
        .nnf-progress-track { width: 100%; height: 8px; background: rgba(0,0,0,0.06); border-radius: 99px; overflow: hidden; }
        .nnf-progress-bar { height: 100%; border-radius: 99px; }
        .nnf-progress-bar.exact { background: #2d8a5e; }
        .nnf-progress-bar.under { background: #c97d10; }
        .nnf-progress-bar.over { background: #dc2626; }
        .nnf-alert-error {
          padding: 12px 16px;
          border-radius: 8px;
          background: #fdf2f2;
          border: 0.5px solid #f8b4b4;
          color: #b91c1c;
          font-size: 13px;
        }
        .nnf-actions { display: flex; justify-content: flex-end; gap: 12px; }
        .nnf-btn-cancel {
          font-family: inherit;
          font-size: 13px;
          color: #666;
          border: 0.5px solid rgba(0,0,0,0.15);
          border-radius: 8px;
          padding: 10px 20px;
          text-decoration: none;
        }
        .nnf-btn-submit {
          font-family: inherit;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          background: #111;
          border: none;
          border-radius: 8px;
          padding: 11px 24px;
          cursor: pointer;
        }
        .nnf-btn-submit:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>

      <form onSubmit={handleSubmit} className="nnf-form">
        {errorMsg && <div className="nnf-alert-error">⚠️ {errorMsg}</div>}

        <div className="nnf-card">
          <div className="nnf-card-header">
            <div>
              <h2 className="nnf-card-title">1. Pilih Mata Kuliah</h2>
              <p className="nnf-card-sub">
                Hanya menampilkan mata kuliah yang belum pernah digunakan pada tabel <code>nilai</code> ({availableCourses.length} tersedia)
              </p>
            </div>
          </div>

          <label className="nnf-label" htmlFor="nnf-course">
            Mata Kuliah Tersedia *
          </label>
          <select
            id="nnf-course"
            className="nnf-select"
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            required
          >
            {availableCourses.map((c) => (
              <option key={c.idkuliah} value={String(c.idkuliah)}>
                {c.matkul} ({c.tahun})
              </option>
            ))}
          </select>
        </div>

        <div className="nnf-card">
          <div className="nnf-card-header">
            <div>
              <h2 className="nnf-card-title">2. Kriteria Penilaian &amp; Bobot (100 Poin)</h2>
              <p className="nnf-card-sub">Tentukan komponen penilaian dan bobot untuk tabel nilai</p>
            </div>
            <button type="button" className="nnf-btn-balance" onClick={autoBalance}>
              ⚡ Bagi Rata 100 Poin
            </button>
          </div>

          <div className="nnf-presets">
            {PRESET_TEMPLATES.map((tmpl, idx) => (
              <button
                key={idx}
                type="button"
                className="nnf-preset-btn"
                onClick={() => {
                  setCriteriaList(tmpl.criteria.map((c) => ({ ...c })))
                  setErrorMsg("")
                }}
              >
                ✨ {tmpl.name}
              </button>
            ))}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="nnf-table">
              <thead>
                <tr>
                  <th style={{ width: "36px" }}>#</th>
                  <th style={{ width: "26%" }}>Judul Kriteria *</th>
                  <th style={{ width: "44%" }}>Deskripsi / Rubrik *</th>
                  <th style={{ width: "16%" }}>Bobot *</th>
                  <th style={{ width: "14%", textAlign: "right" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {criteriaList.map((crit, idx) => (
                  <tr key={idx}>
                    <td style={{ color: "#888", fontWeight: 600, fontSize: "12px" }}>{idx + 1}</td>
                    <td>
                      <input
                        type="text"
                        className="nnf-input"
                        style={{ padding: "8px 10px" }}
                        value={crit.judulkriteria}
                        onChange={(e) => updateCriteriaField(idx, "judulkriteria", e.target.value)}
                        required
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="nnf-input"
                        style={{ padding: "8px 10px" }}
                        value={crit.kriteria}
                        onChange={(e) => updateCriteriaField(idx, "kriteria", e.target.value)}
                        required
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        className="nnf-input"
                        style={{ padding: "8px 10px", width: "76px", textAlign: "center" }}
                        value={crit.bobot}
                        onChange={(e) => updateCriteriaField(idx, "bobot", e.target.value)}
                        required
                      />
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="nnf-btn-icon"
                        disabled={idx === 0}
                        onClick={() => moveRow(idx, "up")}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        className="nnf-btn-icon"
                        disabled={idx === criteriaList.length - 1}
                        onClick={() => moveRow(idx, "down")}
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        className="nnf-btn-icon delete"
                        disabled={criteriaList.length <= 1}
                        onClick={() => removeCriteriaRow(idx)}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button type="button" className="nnf-btn-add" onClick={addCriteriaRow}>
            + Tambah Kriteria
          </button>

          <div className={`nnf-bobot-card ${isExact100 ? "exact" : isUnder100 ? "under" : "over"}`}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>
                {isExact100
                  ? "✅ Total Bobot Sesuai Syarat (100 Poin)"
                  : isUnder100
                    ? "⚠️ Total Bobot Belum Mencapai 100 Poin"
                    : "🚫 Total Bobot Melebihi 100 Poin"}
              </strong>
              <strong>{totalBobot} / 100 Poin</strong>
            </div>
            <div className="nnf-progress-track">
              <div
                className={`nnf-progress-bar ${isExact100 ? "exact" : isUnder100 ? "under" : "over"}`}
                style={{ width: `${Math.min(100, Math.max(0, totalBobot))}%` }}
              />
            </div>
          </div>
        </div>

        <div className="nnf-card">
          <div className="nnf-card-header">
            <div>
              <h2 className="nnf-card-title">3. Pendaftaran Mahasiswa (Opsional)</h2>
              <p className="nnf-card-sub">Daftarkan mahasiswa sekarang atau tambahkan nanti di halaman Input Nilai</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="nnf-preset-btn"
              style={{
                background: studentMode === "none" ? "#111" : "#f4f3ef",
                color: studentMode === "none" ? "#fff" : "#444",
              }}
              onClick={() => setStudentMode("none")}
            >
              Lewati (Tanpa Mahasiswa Dulu)
            </button>
            <button
              type="button"
              className="nnf-preset-btn"
              style={{
                background: studentMode === "paste" ? "#111" : "#f4f3ef",
                color: studentMode === "paste" ? "#fff" : "#444",
              }}
              onClick={() => setStudentMode("paste")}
            >
              📋 Tempel / Paste Daftar NRP
            </button>
            <button
              type="button"
              className="nnf-preset-btn"
              style={{
                background: studentMode === "select" ? "#111" : "#f4f3ef",
                color: studentMode === "select" ? "#fff" : "#444",
              }}
              onClick={() => setStudentMode("select")}
            >
              🔍 Pilih dari Database Mahasiswa
            </button>
          </div>

          {studentMode === "paste" && (
            <div>
              <label className="nnf-label" htmlFor="nnf-nrps">
                Daftar NRP Mahasiswa (pisahkan dengan koma atau baris baru)
              </label>
              <textarea
                id="nnf-nrps"
                className="nnf-input"
                style={{ minHeight: "100px", fontFamily: "monospace", fontSize: "13px" }}
                placeholder={"5803024001\n5803024002"}
                value={pastedNrps}
                onChange={(e) => setPastedNrps(e.target.value)}
              />
            </div>
          )}

          {studentMode === "select" && (
            <div>
              <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                <input
                  type="text"
                  className="nnf-input"
                  placeholder="Cari berdasarkan nama atau NRP..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
                <button
                  type="button"
                  className="nnf-btn-balance"
                  onClick={() =>
                    setSelectedStudents(
                      selectedStudents.length === filteredStudents.length
                        ? []
                        : filteredStudents.map((s) => s.nrp)
                    )
                  }
                >
                  {selectedStudents.length === filteredStudents.length ? "Batal Pilih" : "Pilih Semua"}
                </button>
              </div>
              {loadingStudents ? (
                <p style={{ fontSize: "13px", color: "#888" }}>Memuat daftar mahasiswa...</p>
              ) : (
                <div style={{ maxHeight: "220px", overflowY: "auto", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: "8px", padding: "8px" }}>
                  {filteredStudents.map((s) => {
                    const checked = selectedStudents.includes(s.nrp)
                    return (
                      <label
                        key={s.nrp}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          background: checked ? "#f0ede8" : "transparent",
                          fontSize: "13px",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStudents([...selectedStudents, s.nrp])
                            } else {
                              setSelectedStudents(selectedStudents.filter((x) => x !== s.nrp))
                            }
                          }}
                        />
                        <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{s.nrp}</span>
                        <span>{s.nama || "—"}</span>
                      </label>
                    )
                  })}
                </div>
              )}
              <p style={{ fontSize: "12px", color: "#1f6b45", marginTop: "6px" }}>
                {selectedStudents.length} mahasiswa dipilih
              </p>
            </div>
          )}
        </div>

        <div className="nnf-card">
          <div className="nnf-card-header" style={{ alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                <h2 className="nnf-card-title">4. Kunci Jawaban Ujian (Format Markdown)</h2>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#92341e",
                    background: "#fcf1ee",
                    border: "0.5px solid #f2c7bc",
                    padding: "2px 7px",
                    borderRadius: "4px",
                  }}
                >
                  Opsional (.md)
                </span>
              </div>
              <p className="nnf-card-sub">
                Unggah atau tulis kunci jawaban dalam format Markdown (.md) untuk mata kuliah yang dipilih.
              </p>
            </div>

            <div style={{ display: "flex", gap: "6px", flexShrink: 0, flexWrap: "wrap", alignItems: "center" }}>
              <label
                htmlFor="nnf-upload-md"
                className="nnf-preset-btn"
                style={{
                  cursor: "pointer",
                  background: "#f4f3ef",
                  color: "#111",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontWeight: 500,
                }}
              >
                <span>📁</span>
                <span>Upload File .md</span>
                <input
                  id="nnf-upload-md"
                  type="file"
                  accept=".md,.markdown,.txt"
                  style={{ display: "none" }}
                  onChange={handleFileUpload}
                />
              </label>
              <button
                type="button"
                className="nnf-preset-btn"
                style={{
                  background: kunciJawabanTab === "edit" ? "#111" : "#f4f3ef",
                  color: kunciJawabanTab === "edit" ? "#fff" : "#444",
                }}
                onClick={() => setKunciJawabanTab("edit")}
              >
                ✏️ Editor .md
              </button>
              <button
                type="button"
                className="nnf-preset-btn"
                style={{
                  background: kunciJawabanTab === "preview" ? "#111" : "#f4f3ef",
                  color: kunciJawabanTab === "preview" ? "#fff" : "#444",
                }}
                onClick={() => setKunciJawabanTab("preview")}
              >
                👁️ Pratinjau
              </button>
            </div>
          </div>

          {kunciJawabanTab === "edit" ? (
            <div>
              <label className="nnf-label" htmlFor="nnf-kunci">
                Isi Kunci Jawaban (Markdown .md)
              </label>
              <textarea
                id="nnf-kunci"
                className="nnf-input"
                style={{
                  minHeight: "200px",
                  fontFamily: "'Consolas', 'Monaco', monospace",
                  fontSize: "13px",
                  lineHeight: "1.6",
                  resize: "vertical",
                }}
                placeholder="# Kunci Jawaban...\n\nKetik langsung, klik 'Upload File .md', atau seret (drag-and-drop) file .md ke sini."
                value={kunciJawaban}
                onChange={(e) => setKunciJawaban(e.target.value)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDropFile}
              />
              {kunciJawaban.trim() && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontSize: "12px", color: "#888" }}>
                  <span>{kunciJawaban.length} karakter • {kunciJawaban.split("\n").length} baris</span>
                  <button
                    type="button"
                    style={{ background: "none", border: "none", color: "#c0392b", cursor: "pointer", fontSize: "12px" }}
                    onClick={() => setKunciJawaban("")}
                  >
                    Kosongkan Kunci
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                background: "#fdfdfc",
                border: "0.5px solid rgba(0,0,0,0.1)",
                borderRadius: "8px",
                padding: "20px 24px",
                minHeight: "160px",
              }}
            >
              {kunciJawaban.trim() ? (
                <MarkdownViewer content={kunciJawaban} />
              ) : (
                <p style={{ color: "#999", fontStyle: "italic", textAlign: "center", padding: "32px 0" }}>
                  Belum ada isi kunci jawaban.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="nnf-actions">
          <Link href="/admin/kuliah" className="nnf-btn-cancel">
            Batal
          </Link>
          <button
            type="submit"
            className="nnf-btn-submit"
            disabled={submitting || !isExact100 || !selectedCourseId}
          >
            {submitting ? "Menyimpan..." : "Simpan & Lanjut Input Nilai"}
          </button>
        </div>
      </form>
    </>
  )
}
