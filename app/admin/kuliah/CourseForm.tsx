"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface CriteriaItem {
  id?: number
  judulkriteria: string
  kriteria: string
  bobot: number | ""
}

interface StudentOption {
  nrp: string
  nama: string | null
  email: string | null
}

interface CourseFormProps {
  initialData?: {
    idkuliah?: number
    matkul: string
    tahun: string
    criteriaList: CriteriaItem[]
    students?: string[]
  }
  isEditing?: boolean
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
  {
    name: "Peer Evaluation (Kontribusi 40, Keaktifan 30, Kerjasama 30 — Total: 100 Poin)",
    criteria: [
      { judulkriteria: "Kontribusi Tugas", kriteria: "Kualitas dan kuantitas kontribusi dalam penyelesaian tugas kelompok", bobot: 40 },
      { judulkriteria: "Keaktifan Diskusi", kriteria: "Keaktifan memberikan ide, gagasan, dan solusi dalam forum diskusi", bobot: 30 },
      { judulkriteria: "Kerjasama Tim", kriteria: "Sikap kooperatif, tepat waktu, dan tanggung jawab terhadap pembagian tugas", bobot: 30 },
    ],
  },
]

export default function CourseForm({ initialData, isEditing = false }: CourseFormProps) {
  const router = useRouter()

  const [matkul, setMatkul] = useState(initialData?.matkul ?? "")
  const [tahun, setTahun] = useState(initialData?.tahun ?? new Date().getFullYear().toString())
  const [criteriaList, setCriteriaList] = useState<CriteriaItem[]>(
    initialData?.criteriaList && initialData.criteriaList.length > 0
      ? initialData.criteriaList
      : [
          { judulkriteria: "Tugas & Proyek", kriteria: "Penugasan berkala dan implementasi proyek", bobot: 30 },
          { judulkriteria: "UTS", kriteria: "Ujian Tengah Semester", bobot: 35 },
          { judulkriteria: "UAS", kriteria: "Ujian Akhir Semester", bobot: 35 },
        ]
  )

  // Student enrollment state
  const [studentMode, setStudentMode] = useState<"none" | "paste" | "select">("none")
  const [pastedNrps, setPastedNrps] = useState("")
  const [availableStudents, setAvailableStudents] = useState<StudentOption[]>([])
  const [selectedStudents, setSelectedStudents] = useState<string[]>(initialData?.students ?? [])
  const [studentSearch, setStudentSearch] = useState("")
  const [loadingStudents, setLoadingStudents] = useState(false)

  // Form submission state
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [successMsg, setSuccessMsg] = useState("")

  // Fetch available students when student selection mode is opened
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

  // Calculate current sum of weights
  const totalBobot = criteriaList.reduce((acc, curr) => {
    const b = typeof curr.bobot === "number" ? curr.bobot : 0
    return acc + b
  }, 0)

  const isExact100 = totalBobot === 100
  const isUnder100 = totalBobot < 100
  const isOver100 = totalBobot > 100

  // Add new criteria row
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

  // Remove criteria row
  const removeCriteriaRow = (index: number) => {
    if (criteriaList.length <= 1) {
      setErrorMsg("Minimal harus ada 1 kriteria penilaian.")
      return
    }
    const updated = criteriaList.filter((_, i) => i !== index)
    setCriteriaList(updated)
  }

  // Update specific criteria field
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

  // Move criteria row position
  const moveRow = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= criteriaList.length) return
    const updated = [...criteriaList]
    const temp = updated[index]
    updated[index] = updated[targetIndex]
    updated[targetIndex] = temp
    setCriteriaList(updated)
  }

  // Apply template preset
  const applyTemplate = (index: number) => {
    const template = PRESET_TEMPLATES[index]
    if (!template) return
    setCriteriaList(template.criteria.map((c) => ({ ...c })))
    setErrorMsg("")
  }

  // Auto balance weights to equal 100%
  const autoBalance = () => {
    if (criteriaList.length === 0) return
    const count = criteriaList.length
    const base = Math.floor(100 / count)
    const remainder = 100 % count

    const updated = criteriaList.map((c, i) => ({
      ...c,
      bobot: base + (i < remainder ? 1 : 0),
    }))
    setCriteriaList(updated)
    setErrorMsg("")
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg("")
    setSuccessMsg("")

    if (!matkul.trim()) {
      setErrorMsg("Nama mata kuliah wajib diisi.")
      return
    }
    if (!tahun.trim()) {
      setErrorMsg("Tahun / semester akademik wajib diisi.")
      return
    }
    if (criteriaList.length === 0) {
      setErrorMsg("Minimal 1 kriteria penilaian harus dibuat.")
      return
    }

    // Check each criteria validity
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

    // CRITICAL: Strict 100% validation check
    if (totalBobot !== 100) {
      setErrorMsg(
        `Total keseluruhan bobot harus tepat 100%. Saat ini akumulasi adalah ${totalBobot}% (${
          isUnder100 ? `kurang ${100 - totalBobot}%` : `kelebihan ${totalBobot - 100}%`
        }).`
      )
      return
    }

    // Gather student NRPs
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
      const url = isEditing && initialData?.idkuliah
        ? `/api/admin/kuliah/${initialData.idkuliah}`
        : "/api/admin/kuliah"
      const method = isEditing ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matkul: matkul.trim(),
          tahun: tahun.trim(),
          kriteriaList: criteriaList.map((c) => ({
            judulkriteria: c.judulkriteria.trim(),
            kriteria: c.kriteria.trim(),
            bobot: Number(c.bobot),
          })),
          students: studentList,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Gagal menyimpan kuliah.")
      }

      setSuccessMsg(
        isEditing
          ? "Kuliah dan kriteria berhasil diperbarui!"
          : "Kuliah baru berhasil dibuat dengan bobot 100%!"
      )

      setTimeout(() => {
        router.push("/admin/kuliah")
        router.refresh()
      }, 1200)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan saat memproses data."
      setErrorMsg(message)
    } finally {
      setSubmitting(false)
    }
  }

  // Filter available students for search
  const filteredStudents = availableStudents.filter(
    (s) =>
      s.nrp.toLowerCase().includes(studentSearch.toLowerCase()) ||
      (s.nama && s.nama.toLowerCase().includes(studentSearch.toLowerCase()))
  )

  return (
    <>
      <style>{`
        .cf-container { display: flex; flex-direction: column; gap: 28px; }
        
        .cf-card {
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.08);
          border-radius: 14px;
          padding: 28px 32px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        }

        .cf-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 22px;
          padding-bottom: 14px;
          border-bottom: 0.5px solid rgba(0,0,0,0.06);
        }

        .cf-card-title {
          font-size: 17px;
          font-weight: 600;
          color: #111;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .cf-card-subtitle {
          font-size: 13px;
          color: #888;
          font-weight: 300;
          margin-top: 2px;
        }

        .cf-grid-2 {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 20px;
        }

        .cf-form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .cf-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #555;
        }

        .cf-input, .cf-select {
          font-family: inherit;
          font-size: 14px;
          padding: 10px 14px;
          border: 0.5px solid rgba(0,0,0,0.18);
          border-radius: 8px;
          background: #fafaf8;
          color: #111;
          outline: none;
          transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
        }
        .cf-input:focus, .cf-select:focus {
          border-color: #111;
          background: #fff;
          box-shadow: 0 0 0 2px rgba(0,0,0,0.05);
        }

        /* Preset Template Pills */
        .cf-presets {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 24px;
        }
        .cf-preset-btn {
          font-family: inherit;
          font-size: 12px;
          padding: 6px 14px;
          border-radius: 20px;
          background: #f4f3ef;
          color: #444;
          border: 0.5px solid rgba(0,0,0,0.1);
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .cf-preset-btn:hover {
          background: #111;
          color: #fff;
          border-color: #111;
        }

        /* Criteria Table Builder */
        .cf-crit-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 18px;
        }
        .cf-crit-th {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #888;
          text-align: left;
          padding: 10px 12px;
          border-bottom: 1px solid rgba(0,0,0,0.08);
        }
        .cf-crit-row {
          border-bottom: 0.5px solid rgba(0,0,0,0.05);
          transition: background 0.15s;
        }
        .cf-crit-row:hover { background: #fafaf8; }
        .cf-crit-td {
          padding: 10px 12px;
          vertical-align: middle;
        }

        .cf-row-num {
          font-size: 12px;
          font-weight: 600;
          color: #888;
          width: 28px;
          text-align: center;
          display: inline-block;
        }

        .cf-btn-icon {
          background: none;
          border: none;
          color: #888;
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          font-size: 13px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: color 0.15s, background 0.15s;
        }
        .cf-btn-icon:hover {
          background: #eae9e4;
          color: #111;
        }
        .cf-btn-icon.delete:hover {
          background: #fde8e8;
          color: #c0392b;
        }

        /* Bobot Gauge & Progress Bar */
        .cf-bobot-card {
          border-radius: 12px;
          padding: 20px 24px;
          margin-top: 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: all 0.3s ease;
        }
        .cf-bobot-card.exact {
          background: #f0faf5;
          border: 1px solid #a8d8bc;
          color: #1f6b45;
        }
        .cf-bobot-card.under {
          background: #fdf8ee;
          border: 1px solid #e8d08a;
          color: #8a6200;
        }
        .cf-bobot-card.over {
          background: #fdf2f2;
          border: 1px solid #f8b4b4;
          color: #b91c1c;
        }

        .cf-bobot-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .cf-bobot-title {
          font-size: 15px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .cf-bobot-val {
          font-size: 26px;
          font-weight: 700;
          font-family: 'Sora', monospace;
        }

        .cf-progress-track {
          width: 100%;
          height: 10px;
          background: rgba(0,0,0,0.06);
          border-radius: 99px;
          overflow: hidden;
          position: relative;
        }
        .cf-progress-bar {
          height: 100%;
          border-radius: 99px;
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s ease;
        }
        .cf-progress-bar.exact { background: #2d8a5e; }
        .cf-progress-bar.under { background: #c97d10; }
        .cf-progress-bar.over { background: #dc2626; }

        .cf-bobot-help {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          gap: 12px;
        }

        .cf-btn-balance {
          font-family: inherit;
          font-size: 11px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 6px;
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.15);
          color: #333;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .cf-btn-balance:hover {
          background: #111;
          color: #fff;
        }

        /* Action Buttons */
        .cf-btn-add {
          font-family: inherit;
          font-size: 13px;
          font-weight: 500;
          color: #111;
          background: #f4f3ef;
          border: 0.5px solid rgba(0,0,0,0.12);
          border-radius: 8px;
          padding: 8px 16px;
          cursor: pointer;
          transition: all 0.15s;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .cf-btn-add:hover {
          background: #e8e6e0;
        }

        .cf-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 10px;
        }

        .cf-btn-cancel {
          font-family: inherit;
          font-size: 13px;
          font-weight: 500;
          color: #666;
          background: none;
          border: 0.5px solid rgba(0,0,0,0.15);
          border-radius: 8px;
          padding: 10px 20px;
          text-decoration: none;
          transition: color 0.15s, border-color 0.15s;
        }
        .cf-btn-cancel:hover { color: #111; border-color: rgba(0,0,0,0.4); }

        .cf-btn-submit {
          font-family: inherit;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          background: #111;
          border: none;
          border-radius: 8px;
          padding: 11px 24px;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.1s;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .cf-btn-submit:hover:not(:disabled) { opacity: 0.85; }
        .cf-btn-submit:active:not(:disabled) { transform: scale(0.99); }
        .cf-btn-submit:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          background: #777;
        }

        .cf-alert {
          padding: 14px 18px;
          border-radius: 8px;
          font-size: 13px;
          line-height: 1.5;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .cf-alert.error { background: #fdf2f2; border: 0.5px solid #f8b4b4; color: #b91c1c; }
        .cf-alert.success { background: #f0faf5; border: 0.5px solid #a8d8bc; color: #1f6b45; }

        @media (max-width: 768px) {
          .cf-grid-2 { grid-template-columns: 1fr; }
          .cf-card { padding: 20px; }
        }
      `}</style>

      <form onSubmit={handleSubmit} className="cf-container">
        {errorMsg && (
          <div className="cf-alert error">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="cf-alert success">
            <span>✓</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* SECTION 1: INFORMASI MATA KULIAH */}
        <div className="cf-card">
          <div className="cf-card-header">
            <div>
              <h2 className="cf-card-title">📚 Informasi Mata Kuliah</h2>
              <p className="cf-card-subtitle">Nama mata kuliah dan tahun akademik atau semester</p>
            </div>
          </div>

          <div className="cf-grid-2">
            <div className="cf-form-group">
              <label className="cf-label" htmlFor="matkul">
                Nama Mata Kuliah *
              </label>
              <input
                id="matkul"
                className="cf-input"
                type="text"
                placeholder="Contoh: Kecerdasan Buatan, Pemrograman Web"
                value={matkul}
                onChange={(e) => setMatkul(e.target.value)}
                required
              />
            </div>

            <div className="cf-form-group">
              <label className="cf-label" htmlFor="tahun">
                Tahun / Semester Akademik *
              </label>
              <input
                id="tahun"
                className="cf-input"
                type="text"
                placeholder="Contoh: 2025/2026 Ganjil, 2026"
                value={tahun}
                onChange={(e) => setTahun(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: KRITERIA & BOBOT PENILAIAN */}
        <div className="cf-card">
          <div className="cf-card-header">
            <div>
              <h2 className="cf-card-title">⚖️ Kriteria Penilaian &amp; Bobot (Nilai Maksimal)</h2>
              <p className="cf-card-subtitle">
                Tentukan judul kriteria, rubrik, dan nilai maksimal (bobot). Total nilai maksimal semua kriteria wajib 100 poin.
              </p>
            </div>
            <button
              type="button"
              className="cf-btn-balance"
              onClick={autoBalance}
              title="Distribusikan nilai maksimal secara merata ke semua kriteria"
            >
              ⚡ Bagi Rata (Auto-Balance 100 Poin)
            </button>
          </div>

          {/* Quick Preset Templates */}
          <div>
            <label className="cf-label" style={{ marginBottom: "8px", display: "block" }}>
              Pilihan Cepat Template Standar:
            </label>
            <div className="cf-presets">
              {PRESET_TEMPLATES.map((tmpl, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="cf-preset-btn"
                  onClick={() => applyTemplate(idx)}
                >
                  <span>✨</span>
                  <span>{tmpl.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Criteria List Builder Table */}
          <div style={{ overflowX: "auto" }}>
            <table className="cf-crit-table">
              <thead>
                <tr>
                  <th className="cf-crit-th" style={{ width: "40px" }}>#</th>
                  <th className="cf-crit-th" style={{ width: "25%" }}>Judul Kriteria *</th>
                  <th className="cf-crit-th" style={{ width: "45%" }}>Deskripsi / Rubrik Penilaian *</th>
                  <th className="cf-crit-th" style={{ width: "15%" }}>Bobot (Max Poin) *</th>
                  <th className="cf-crit-th" style={{ width: "15%", textAlign: "right" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {criteriaList.map((crit, idx) => (
                  <tr key={idx} className="cf-crit-row">
                    <td className="cf-crit-td">
                      <span className="cf-row-num">{idx + 1}</span>
                    </td>
                    <td className="cf-crit-td">
                      <input
                        type="text"
                        className="cf-input"
                        style={{ padding: "8px 10px", width: "100%" }}
                        placeholder="e.g. Tugas 1 / UTS / UAS"
                        value={crit.judulkriteria}
                        onChange={(e) => updateCriteriaField(idx, "judulkriteria", e.target.value)}
                        required
                      />
                    </td>
                    <td className="cf-crit-td">
                      <input
                        type="text"
                        className="cf-input"
                        style={{ padding: "8px 10px", width: "100%" }}
                        placeholder="e.g. Pemahaman konsep dan implementasi solusi"
                        value={crit.kriteria}
                        onChange={(e) => updateCriteriaField(idx, "kriteria", e.target.value)}
                        required
                      />
                    </td>
                    <td className="cf-crit-td">
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          className="cf-input"
                          style={{
                            padding: "8px 10px",
                            width: "70px",
                            fontFamily: "monospace",
                            fontWeight: 600,
                            textAlign: "center",
                          }}
                          placeholder="30"
                          value={crit.bobot}
                          onChange={(e) => updateCriteriaField(idx, "bobot", e.target.value)}
                          required
                        />
                        <span style={{ fontSize: "12px", color: "#666", fontWeight: 500 }}>poin</span>
                      </div>
                    </td>
                    <td className="cf-crit-td" style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
                        <button
                          type="button"
                          className="cf-btn-icon"
                          title="Pindah ke atas"
                          disabled={idx === 0}
                          style={{ opacity: idx === 0 ? 0.3 : 1 }}
                          onClick={() => moveRow(idx, "up")}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="cf-btn-icon"
                          title="Pindah ke bawah"
                          disabled={idx === criteriaList.length - 1}
                          style={{ opacity: idx === criteriaList.length - 1 ? 0.3 : 1 }}
                          onClick={() => moveRow(idx, "down")}
                        >
                          ▼
                        </button>
                        <button
                          type="button"
                          className="cf-btn-icon delete"
                          title="Hapus kriteria ini"
                          disabled={criteriaList.length <= 1}
                          style={{ opacity: criteriaList.length <= 1 ? 0.3 : 1 }}
                          onClick={() => removeCriteriaRow(idx)}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            className="cf-btn-add"
            onClick={addCriteriaRow}
          >
            <span>+</span> Tambah Kriteria
          </button>

          {/* LIVE BOBOT GAUGE & STRICT REQUIREMENT CHECK */}
          <div
            className={`cf-bobot-card ${
              isExact100 ? "exact" : isUnder100 ? "under" : "over"
            }`}
          >
            <div className="cf-bobot-top">
              <div className="cf-bobot-title">
                {isExact100 ? (
                  <>
                    <span style={{ fontSize: "18px" }}>✅</span>
                    <span>Total Nilai Maksimal Sesuai Syarat (100 Poin)</span>
                  </>
                ) : isUnder100 ? (
                  <>
                    <span style={{ fontSize: "18px" }}>⚠️</span>
                    <span>Total Nilai Maksimal Belum Mencapai 100 Poin</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: "18px" }}>🚫</span>
                    <span>Total Nilai Maksimal Melebihi Batas (100 Poin)</span>
                  </>
                )}
              </div>
              <div className="cf-bobot-val">{totalBobot} / 100 Poin</div>
            </div>

            <div className="cf-progress-track">
              <div
                className={`cf-progress-bar ${
                  isExact100 ? "exact" : isUnder100 ? "under" : "over"
                }`}
                style={{ width: `${Math.min(100, Math.max(0, totalBobot))}%` }}
              />
            </div>

            <div className="cf-bobot-help">
              <span>
                {isExact100 && "Kuliah siap disimpan. Total nilai maksimal tepat 100 poin."}
                {isUnder100 &&
                  `Kurang ${100 - totalBobot} poin lagi untuk mencapai total 100. Tambahkan bobot pada kriteria di atas atau klik tombol Bagi Rata.`}
                {isOver100 &&
                  `Kelebihan ${totalBobot - 100} poin. Kurangi bobot pada salah satu kriteria agar total tepat 100 poin.`}
              </span>
              {!isExact100 && (
                <button
                  type="button"
                  className="cf-btn-balance"
                  onClick={autoBalance}
                >
                  ⚡ Sesuaikan Otomatis
                </button>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 3: PENDAFTARAN MAHASISWA (OPSIONAL) */}
        {!isEditing && (
          <div className="cf-card">
            <div className="cf-card-header">
              <div>
                <h2 className="cf-card-title">👥 Pendaftaran Mahasiswa (Opsional)</h2>
                <p className="cf-card-subtitle">
                  Daftarkan mahasiswa yang mengambil mata kuliah ini agar langsung siap dinilai
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
              <button
                type="button"
                className="cf-preset-btn"
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
                className="cf-preset-btn"
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
                className="cf-preset-btn"
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
              <div className="cf-form-group">
                <label className="cf-label" htmlFor="pastedNrps">
                  Masukkan Daftar NRP Mahasiswa (Pisahkan dengan koma atau baris baru)
                </label>
                <textarea
                  id="pastedNrps"
                  className="cf-input"
                  style={{ minHeight: "100px", fontFamily: "monospace", fontSize: "13px" }}
                  placeholder={"5803024001\n5803024002\n5803024003"}
                  value={pastedNrps}
                  onChange={(e) => setPastedNrps(e.target.value)}
                />
                <span style={{ fontSize: "11px", color: "#888" }}>
                  {pastedNrps.trim()
                    ? `${pastedNrps.split(/[\n,;]+/).filter((s) => s.trim()).length} NRP terdeteksi`
                    : "0 NRP"}
                </span>
              </div>
            )}

            {studentMode === "select" && (
              <div className="cf-form-group">
                <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                  <input
                    type="text"
                    className="cf-input"
                    placeholder="Cari berdasarkan nama atau NRP..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="cf-btn-balance"
                    onClick={() =>
                      setSelectedStudents(
                        selectedStudents.length === filteredStudents.length
                          ? []
                          : filteredStudents.map((s) => s.nrp)
                      )
                    }
                  >
                    {selectedStudents.length === filteredStudents.length
                      ? "Batal Pilih Semua"
                      : "Pilih Semua Hasil"}
                  </button>
                </div>

                {loadingStudents ? (
                  <p style={{ fontSize: "13px", color: "#888", padding: "12px 0" }}>
                    Memuat daftar mahasiswa...
                  </p>
                ) : (
                  <div
                    style={{
                      maxHeight: "220px",
                      overflowY: "auto",
                      border: "0.5px solid rgba(0,0,0,0.1)",
                      borderRadius: "8px",
                      padding: "8px",
                    }}
                  >
                    {filteredStudents.length === 0 ? (
                      <p style={{ fontSize: "12px", color: "#999", padding: "10px" }}>
                        Tidak ada mahasiswa yang cocok.
                      </p>
                    ) : (
                      filteredStudents.map((s) => {
                        const isChecked = selectedStudents.includes(s.nrp)
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
                              background: isChecked ? "#f0ede8" : "transparent",
                              fontSize: "13px",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedStudents([...selectedStudents, s.nrp])
                                } else {
                                  setSelectedStudents(selectedStudents.filter((x) => x !== s.nrp))
                                }
                              }}
                            />
                            <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#111" }}>
                              {s.nrp}
                            </span>
                            <span style={{ color: "#444" }}>{s.nama || "—"}</span>
                          </label>
                        )
                      })
                    )}
                  </div>
                )}
                <span style={{ fontSize: "12px", color: "#1f6b45", fontWeight: 500, marginTop: "4px" }}>
                  {selectedStudents.length} mahasiswa dipilih
                </span>
              </div>
            )}
          </div>
        )}

        {/* SUBMIT & CANCEL ACTIONS */}
        <div className="cf-actions">
          <Link href="/admin/kuliah" className="cf-btn-cancel">
            Batal
          </Link>
          <button
            type="submit"
            className="cf-btn-submit"
            disabled={submitting || !isExact100 || !matkul.trim() || !tahun.trim()}
          >
            {submitting ? (
              <>
                <span className="cf-spinner">⏳</span>
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <span>✓</span>
                <span>{isEditing ? "Simpan Perubahan Kuliah" : "Buat Kuliah Baru (Bobot 100%)"}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </>
  )
}
