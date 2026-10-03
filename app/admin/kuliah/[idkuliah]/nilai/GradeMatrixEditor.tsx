"use client"

import { useState } from "react"

interface Criteria {
  judulkriteria: string
  kriteria: string
  bobot: number
}

interface StudentGradeItem {
  idnilai: number
  grade: number | null
  bobot: number
  kriteria?: string | null
}

interface StudentRow {
  nrp: string
  nama: string
  email: string
  grades: Record<string, StudentGradeItem>
}

interface GradeMatrixEditorProps {
  idkuliah: number
  matkul: string
  tahun?: string
  criteriaList: Criteria[]
  initialStudents: StudentRow[]
}

export default function GradeMatrixEditor({
  idkuliah,
  matkul,
  criteriaList,
  initialStudents,
}: GradeMatrixEditorProps) {
  // State for all grades: Record<idnilai, string | number>
  const [gradesMap, setGradesMap] = useState<Record<number, string | number>>(() => {
    const map: Record<number, string | number> = {}
    for (const st of initialStudents) {
      for (const crit of criteriaList) {
        const item = st.grades[crit.judulkriteria]
        if (item) {
          map[item.idnilai] = item.grade !== null ? item.grade : ""
        }
      }
    }
    return map
  })

  // State for all criteria comments / custom rubrics: Record<idnilai, string>
  const [commentsMap, setCommentsMap] = useState<Record<number, string>>(() => {
    const map: Record<number, string> = {}
    for (const st of initialStudents) {
      for (const crit of criteriaList) {
        const item = st.grades[crit.judulkriteria]
        if (item) {
          map[item.idnilai] = item.kriteria ?? crit.kriteria ?? ""
        }
      }
    }
    return map
  })

  const students = initialStudents
  const [viewMode, setViewMode] = useState<"single" | "table">("single")
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0)
  const [searchTerm, setSearchTerm] = useState("")
  const [saving, setSaving] = useState(false)
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Modal for quick editing comment in table view
  const [tableCommentModal, setTableCommentModal] = useState<{
    idnilai: number
    studentNama: string
    studentNrp: string
    judulkriteria: string
    defaultKriteria: string
    comment: string
  } | null>(null)

  // Modal / box for adding new students
  const [showAddModal, setShowAddModal] = useState(false)
  const [newStudentNrps, setNewStudentNrps] = useState("")
  const [enrolling, setEnrolling] = useState(false)

  // Filter students for search dropdown or table view
  const filteredStudents = students.filter(
    (s) =>
      s.nrp.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.nama.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const currentStudent = students[currentStudentIndex] ?? null

  // Handle grade change - constrained between 0 and criteria bobot (max score)
  const handleGradeChange = (idnilai: number, maxBobot: number, val: string | number) => {
    setToastMsg(null)
    const clean = val === "" ? "" : Math.max(0, Math.min(maxBobot, parseFloat(String(val)) || 0))
    setGradesMap((prev) => ({
      ...prev,
      [idnilai]: clean,
    }))
  }

  // Handle criteria comment / rubric change for a student
  const handleCommentChange = (idnilai: number, val: string) => {
    setToastMsg(null)
    setCommentsMap((prev) => ({
      ...prev,
      [idnilai]: val,
    }))
  }

  // Calculate final grade for a student: direct sum of all criteria grades
  const calculateFinalGrade = (student: StudentRow): number | null => {
    let totalScore = 0
    let hasAnyGrade = false

    for (const crit of criteriaList) {
      const item = student.grades[crit.judulkriteria]
      if (!item) continue
      const val = gradesMap[item.idnilai]
      if (val !== "" && val !== undefined && val !== null && !isNaN(Number(val))) {
        hasAnyGrade = true
        totalScore += Number(val)
      }
    }

    if (!hasAnyGrade) return null
    return Math.round(totalScore * 100) / 100
  }

  // Check how many criteria are filled for a student
  const getFilledCriteriaCount = (student: StudentRow): number => {
    let count = 0
    for (const crit of criteriaList) {
      const item = student.grades[crit.judulkriteria]
      if (!item) continue
      const val = gradesMap[item.idnilai]
      if (val !== "" && val !== undefined && val !== null && !isNaN(Number(val))) {
        count++
      }
    }
    return count
  }

  // Save all grades and comments
  const handleSaveAll = async (showToast = true) => {
    setSaving(true)
    if (showToast) setToastMsg(null)

    const updates = Object.entries(gradesMap).map(([idnilaiStr, gradeVal]) => {
      const idnilai = parseInt(idnilaiStr, 10)
      return {
        idnilai,
        grade: gradeVal === "" ? null : Number(gradeVal),
        kriteria: commentsMap[idnilai] !== undefined ? commentsMap[idnilai] : undefined,
      }
    })

    try {
      const res = await fetch(`/api/admin/kuliah/${idkuliah}/nilai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Gagal menyimpan nilai")
      }

      if (showToast) {
        setToastMsg({ type: "success", text: "Seluruh nilai dan catatan komentar berhasil disimpan ke database!" })
      }
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan."
      if (showToast) setToastMsg({ type: "error", text: msg })
      return false
    } finally {
      setSaving(false)
    }
  }

  // Save & proceed to next student
  const handleSaveAndNext = async () => {
    await handleSaveAll(false)
    if (currentStudentIndex < students.length - 1) {
      setCurrentStudentIndex(currentStudentIndex + 1)
      setToastMsg({ type: "success", text: `Nilai & komentar disimpan! Melanjutkan ke mahasiswa berikutnya.` })
    } else {
      setToastMsg({ type: "success", text: `Nilai & komentar disimpan! Anda telah berada di mahasiswa terakhir.` })
    }
  }

  // Enroll new students
  const handleEnrollStudents = async () => {
    if (!newStudentNrps.trim()) return
    setEnrolling(true)
    setToastMsg(null)

    try {
      const res = await fetch(`/api/admin/kuliah/${idkuliah}/nilai`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nrps: newStudentNrps }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal mendaftarkan mahasiswa")

      setToastMsg({ type: "success", text: data.message || "Mahasiswa berhasil ditambahkan!" })
      setShowAddModal(false)
      setNewStudentNrps("")

      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mendaftarkan mahasiswa."
      setToastMsg({ type: "error", text: msg })
    } finally {
      setEnrolling(false)
    }
  }

  // Overall grading progress calculation
  const totalGradedStudents = students.filter(
    (s) => getFilledCriteriaCount(s) === criteriaList.length
  ).length

  return (
    <>
      <style>{`
        .gm-container { display: flex; flex-direction: column; gap: 20px; }

        /* Top Toolbar */
        .gm-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 14px;
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.08);
          border-radius: 12px;
          padding: 14px 20px;
        }

        .gm-view-toggle {
          display: flex;
          align-items: center;
          background: #f4f3ef;
          padding: 3px;
          border-radius: 8px;
          border: 0.5px solid rgba(0,0,0,0.08);
        }
        .gm-toggle-btn {
          font-family: inherit;
          font-size: 12px;
          font-weight: 500;
          padding: 6px 14px;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: #666;
          cursor: pointer;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .gm-toggle-btn.active {
          background: #fff;
          color: #111;
          font-weight: 600;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }

        .gm-btn {
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: none;
        }
        .gm-btn.primary { background: #111; color: #fff; }
        .gm-btn.primary:hover:not(:disabled) { background: #333; }
        .gm-btn.primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .gm-btn.secondary { background: #f4f3ef; color: #111; border: 0.5px solid rgba(0,0,0,0.12); }
        .gm-btn.secondary:hover { background: #e8e6e0; }

        /* SINGLE VIEW LAYOUT */
        .gm-single-layout {
          display: grid;
          grid-template-columns: 310px 1fr;
          gap: 20px;
          align-items: start;
        }

        /* Sidebar */
        .gm-student-sidebar {
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.08);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-height: calc(100vh - 180px);
          overflow-y: auto;
          position: sticky;
          top: 80px;
        }

        .gm-search-input {
          width: 100%;
          padding: 8px 12px;
          font-family: inherit;
          font-size: 12px;
          border: 0.5px solid rgba(0,0,0,0.15);
          border-radius: 6px;
          outline: none;
          box-sizing: border-box;
          background: #fafaf8;
        }
        .gm-search-input:focus { border-color: #111; background: #fff; }

        .gm-student-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s;
          border: 0.5px solid transparent;
          text-align: left;
          width: 100%;
          background: none;
          font-family: inherit;
        }
        .gm-student-item:hover { background: #f7f6f2; }
        .gm-student-item.active {
          background: #f0faf5;
          border-color: #a8d8bc;
        }

        .gm-item-name { font-size: 13px; font-weight: 600; color: #111; }
        .gm-item-nrp { font-size: 11px; color: #888; font-family: monospace; }
        .gm-item-grade {
          font-size: 12px;
          font-weight: 700;
          font-family: monospace;
          color: #1f6b45;
          background: #fff;
          padding: 2px 6px;
          border-radius: 4px;
          border: 0.5px solid #a8d8bc;
        }
        .gm-item-pending { font-size: 11px; color: #aaa; }

        /* Main Single Student Canvas */
        .gm-student-canvas { display: flex; flex-direction: column; gap: 16px; }

        /* Student Hero Banner */
        .gm-student-hero {
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.08);
          border-radius: 12px;
          padding: 20px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .gm-hero-left { display: flex; align-items: center; gap: 14px; }
        .gm-hero-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #141414;
          color: #fff;
          font-size: 17px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .gm-hero-name { font-size: 18px; font-weight: 600; color: #111; }
        .gm-hero-meta { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #888; margin-top: 2px; }
        .gm-hero-nrp { font-family: monospace; font-weight: 600; color: #444; }

        .gm-hero-score-badge {
          background: #fdfdfc;
          border: 0.5px solid rgba(0,0,0,0.12);
          border-radius: 10px;
          padding: 12px 18px;
          text-align: right;
        }
        .gm-hero-score-label { font-size: 11px; text-transform: uppercase; color: #888; font-weight: 600; letter-spacing: 0.05em; }
        .gm-hero-score-val { font-size: 26px; font-weight: 700; color: #1f6b45; font-family: monospace; }

        /* Criteria Rubric Cards */
        .gm-criteria-cards { display: flex; flex-direction: column; gap: 14px; }
        .gm-crit-card {
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.08);
          border-radius: 12px;
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .gm-crit-card:hover { border-color: rgba(0,0,0,0.18); box-shadow: 0 2px 8px rgba(0,0,0,0.03); }

        .gm-crit-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .gm-crit-header-left { display: flex; align-items: center; gap: 10px; }
        .gm-crit-badge-num {
          font-size: 11px;
          font-weight: 600;
          color: #777;
          background: #f4f3ef;
          padding: 2px 8px;
          border-radius: 4px;
        }
        .gm-crit-judul { font-size: 16px; font-weight: 600; color: #111; }
        .gm-crit-max-badge {
          font-size: 12px;
          color: #1f6b45;
          background: #edf8f2;
          border: 0.5px solid #a8d8bc;
          border-radius: 6px;
          padding: 3px 10px;
          font-weight: 500;
        }

        .gm-crit-rubrik-box {
          background: #fafaf8;
          border: 0.5px solid rgba(0,0,0,0.08);
          border-radius: 8px;
          padding: 12px 16px;
          font-size: 13px;
          color: #333;
          line-height: 1.5;
        }

        .gm-crit-comment-textarea {
          width: 100%;
          font-family: inherit;
          font-size: 13px;
          padding: 8px 10px;
          border: 0.5px solid rgba(0,0,0,0.18);
          border-radius: 6px;
          background: #fff;
          color: #111;
          outline: none;
          box-sizing: border-box;
          line-height: 1.4;
          resize: vertical;
          transition: border-color 0.15s;
        }
        .gm-crit-comment-textarea:focus {
          border-color: #111;
          box-shadow: 0 0 0 2px rgba(0,0,0,0.06);
        }

        .gm-crit-input-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          padding-top: 6px;
          border-top: 0.5px solid rgba(0,0,0,0.06);
        }

        .gm-crit-presets { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .gm-crit-preset-btn {
          font-family: inherit;
          font-size: 11px;
          font-weight: 500;
          color: #555;
          background: #f4f3ef;
          border: 0.5px solid rgba(0,0,0,0.1);
          border-radius: 5px;
          padding: 4px 8px;
          cursor: pointer;
          transition: all 0.12s;
        }
        .gm-crit-preset-btn:hover { background: #111; color: #fff; border-color: #111; }

        .gm-crit-input-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .gm-crit-number-input {
          width: 90px;
          padding: 8px 10px;
          font-family: monospace;
          font-size: 16px;
          font-weight: 700;
          text-align: center;
          border: 1px solid rgba(0,0,0,0.2);
          border-radius: 8px;
          background: #fff;
          color: #111;
          outline: none;
          transition: all 0.15s;
        }
        .gm-crit-number-input:focus {
          border-color: #111;
          box-shadow: 0 0 0 3px rgba(0,0,0,0.08);
        }

        /* Bottom Student Navigation Bar */
        .gm-bottom-nav {
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.08);
          border-radius: 12px;
          padding: 16px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          position: sticky;
          bottom: 20px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.08);
        }

        /* TABLE VIEW STYLES */
        .gm-table-wrap {
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.08);
          border-radius: 12px;
          overflow-x: auto;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        }
        .gm-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .gm-th {
          background: #f9f8f5;
          padding: 12px 14px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #777;
          border-bottom: 1px solid rgba(0,0,0,0.08);
          white-space: nowrap;
        }
        .gm-td { padding: 10px 14px; border-bottom: 0.5px solid rgba(0,0,0,0.04); vertical-align: middle; }
        .gm-tr:hover { background: #fafaf8; }
        .gm-tr:last-child .gm-td { border-bottom: none; }

        .gm-cell-flex {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .gm-input-grade-table {
          width: 58px;
          padding: 6px 6px;
          font-family: monospace;
          font-size: 13px;
          font-weight: 600;
          text-align: center;
          border: 0.5px solid rgba(0,0,0,0.18);
          border-radius: 6px;
          background: #fafaf8;
          color: #111;
          outline: none;
        }
        .gm-input-grade-table:focus { border-color: #111; background: #fff; }

        .gm-cell-comment-btn {
          background: none;
          border: 0.5px solid rgba(0,0,0,0.12);
          border-radius: 5px;
          padding: 4px 6px;
          font-size: 12px;
          cursor: pointer;
          color: #888;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .gm-cell-comment-btn:hover {
          background: #f0ede8;
          color: #111;
          border-color: rgba(0,0,0,0.3);
        }
        .gm-cell-comment-btn.has-custom {
          background: #edf8f2;
          color: #1f6b45;
          border-color: #a8d8bc;
          font-weight: 600;
        }

        .gm-badge-grade {
          font-family: monospace;
          font-size: 13px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 20px;
          display: inline-block;
        }
        .gm-badge-grade.high { background: #f0faf5; color: #1f6b45; border: 0.5px solid #a8d8bc; }
        .gm-badge-grade.mid  { background: #fdf8ee; color: #8a6200; border: 0.5px solid #e8d08a; }
        .gm-badge-grade.low  { background: #fff1f1; color: #b02020; border: 0.5px solid #f8b4b4; }
        .gm-badge-grade.none { color: #ccc; font-weight: 400; }

        .gm-toast { padding: 12px 18px; border-radius: 8px; font-size: 13px; display: flex; align-items: center; gap: 8px; }
        .gm-toast.success { background: #f0faf5; color: #1f6b45; border: 0.5px solid #a8d8bc; }
        .gm-toast.error   { background: #fdf2f2; color: #b91c1c; border: 0.5px solid #f8b4b4; }

        /* Modal */
        .gm-modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 20px;
        }
        .gm-modal {
          background: #fff;
          border-radius: 14px;
          padding: 24px 28px;
          width: 100%;
          max-width: 520px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        }

        @media (max-width: 900px) {
          .gm-single-layout { grid-template-columns: 1fr; }
          .gm-student-sidebar { position: static; }
          .gm-bottom-nav { flex-direction: column; gap: 10px; }
        }
      `}</style>

      <div className="gm-container">
        {toastMsg && (
          <div className={`gm-toast ${toastMsg.type}`}>
            <span>{toastMsg.type === "success" ? "✓" : "⚠️"}</span>
            <span>{toastMsg.text}</span>
          </div>
        )}

        {/* Top Controls & View Mode Toggle */}
        <div className="gm-toolbar">
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            {/* View Mode Toggle: Focus 1 Mahasiswa vs Tabel Rekap */}
            <div className="gm-view-toggle">
              <button
                type="button"
                className={`gm-toggle-btn ${viewMode === "single" ? "active" : ""}`}
                onClick={() => setViewMode("single")}
              >
                👤 Fokus 1 Mahasiswa (Kriteria &amp; Komentar Lengkap)
              </button>
              <button
                type="button"
                className={`gm-toggle-btn ${viewMode === "table" ? "active" : ""}`}
                onClick={() => setViewMode("table")}
              >
                📊 Tabel Matriks (Semua)
              </button>
            </div>

            <span style={{ fontSize: "12px", color: "#666" }}>
              Progress Penilaian: <strong>{totalGradedStudents}</strong> / {students.length} Mahasiswa Lengkap
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              className="gm-btn secondary"
              onClick={() => setShowAddModal(true)}
            >
              <span>+</span> Daftarkan Mahasiswa
            </button>
            <button
              type="button"
              className="gm-btn primary"
              disabled={saving || students.length === 0}
              onClick={() => handleSaveAll(true)}
            >
              {saving ? "Menyimpan..." : "💾 Simpan Semua Nilai & Catatan"}
            </button>
          </div>
        </div>

        {students.length === 0 ? (
          <div
            style={{
              background: "#fff",
              border: "0.5px dashed rgba(0,0,0,0.15)",
              borderRadius: "12px",
              padding: "60px 24px",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: "16px", fontWeight: 600, color: "#111", marginBottom: "6px" }}>
              Belum Ada Mahasiswa di Mata Kuliah Ini
            </p>
            <p style={{ fontSize: "13px", color: "#888", marginBottom: "20px" }}>
              Daftarkan mahasiswa terlebih dahulu agar form input nilai per kriteria muncul.
            </p>
            <button
              type="button"
              className="gm-btn primary"
              onClick={() => setShowAddModal(true)}
            >
              <span>+</span> Tambah Mahasiswa Sekarang
            </button>
          </div>
        ) : viewMode === "single" && currentStudent ? (
          /* ========================================================== */
          /* MODE 1: SINGLE STUDENT FOCUS WITH FULL CRITERIA & COMMENT VIEW */
          /* ========================================================== */
          <div className="gm-single-layout">
            {/* Left Sidebar: Student Navigation & Jump List */}
            <aside className="gm-student-sidebar">
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#111", marginBottom: "4px" }}>
                  Daftar Mahasiswa ({students.length})
                </div>
                <div style={{ fontSize: "11px", color: "#888" }}>
                  Klik nama untuk beralih mahasiswa
                </div>
              </div>

              <input
                type="text"
                placeholder="Cari nama / NRP..."
                className="gm-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {filteredStudents.map((st) => {
                  const originalIndex = students.findIndex((s) => s.nrp === st.nrp)
                  const isActive = originalIndex === currentStudentIndex
                  const finalGrade = calculateFinalGrade(st)
                  const filledCount = getFilledCriteriaCount(st)

                  return (
                    <button
                      key={st.nrp}
                      type="button"
                      className={`gm-student-item ${isActive ? "active" : ""}`}
                      onClick={() => setCurrentStudentIndex(originalIndex)}
                    >
                      <div>
                        <div className="gm-item-name">{st.nama}</div>
                        <div className="gm-item-nrp">{st.nrp}</div>
                      </div>

                      <div>
                        {finalGrade !== null ? (
                          <span className="gm-item-grade">
                            {finalGrade.toFixed(2)}
                          </span>
                        ) : (
                          <span className="gm-item-pending">
                            {filledCount}/{criteriaList.length}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </aside>

            {/* Right Main Canvas: Current Student Details, Comments & Grades */}
            <main className="gm-student-canvas">
              {/* Student Header */}
              <div className="gm-student-hero">
                <div className="gm-hero-left">
                  <div className="gm-hero-avatar">
                    {(currentStudent.nama || currentStudent.nrp).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="gm-hero-name">{currentStudent.nama}</h2>
                    <div className="gm-hero-meta">
                      <span className="gm-hero-nrp">NRP: {currentStudent.nrp}</span>
                      <span>•</span>
                      <span>{currentStudent.email}</span>
                      <span>•</span>
                      <span>Mahasiswa #{currentStudentIndex + 1} dari {students.length}</span>
                    </div>
                  </div>
                </div>

                {/* Real-time Total Score Card */}
                {(() => {
                  const finalScore = calculateFinalGrade(currentStudent)
                  const filledCount = getFilledCriteriaCount(currentStudent)

                  return (
                    <div className="gm-hero-score-badge">
                      <div className="gm-hero-score-label">Total Nilai Akhir</div>
                      <div className="gm-hero-score-val">
                        {finalScore !== null ? finalScore.toFixed(2) : "0.00"}
                        <span style={{ fontSize: "14px", fontWeight: 500, color: "#888" }}> / 100</span>
                      </div>
                      <div style={{ fontSize: "11px", color: "#777", marginTop: "2px" }}>
                        {filledCount === criteriaList.length ? "✓ Semua kriteria dinilai" : `${filledCount}/${criteriaList.length} kriteria terisi`}
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Full Criteria Rubric & Comment Cards */}
              <div className="gm-criteria-cards">
                {criteriaList.map((crit, idx) => {
                  const item = currentStudent.grades[crit.judulkriteria]
                  const currentVal = item ? gradesMap[item.idnilai] ?? "" : ""
                  const currentComment = item ? commentsMap[item.idnilai] ?? "" : crit.kriteria
                  const isCustomComment = item && currentComment !== crit.kriteria

                  return (
                    <div key={idx} className="gm-crit-card">
                      <div className="gm-crit-card-top">
                        <div className="gm-crit-header-left">
                          <span className="gm-crit-badge-num">Kriteria #{idx + 1}</span>
                          <span className="gm-crit-judul">{crit.judulkriteria}</span>
                        </div>
                        <span className="gm-crit-max-badge">
                          Nilai Maksimal: <strong>{crit.bobot} Poin</strong>
                        </span>
                      </div>

                      {/* Rubric Description & Custom Comment Box */}
                      <div className="gm-crit-rubrik-box">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                          <label
                            htmlFor={`comment-${item?.idnilai ?? idx}`}
                            style={{ fontSize: "11px", fontWeight: 600, color: "#777", textTransform: "uppercase", letterSpacing: "0.04em" }}
                          >
                            Deskripsi Rubrik / Komentar Penilaian:
                          </label>
                          {item && isCustomComment && (
                            <button
                              type="button"
                              style={{
                                fontSize: "11px",
                                color: "#1f6b45",
                                background: "#edf8f2",
                                border: "0.5px solid #a8d8bc",
                                borderRadius: "4px",
                                padding: "2px 8px",
                                cursor: "pointer",
                              }}
                              onClick={() => handleCommentChange(item.idnilai, crit.kriteria)}
                              title="Kembalikan ke deskripsi rubrik default mata kuliah"
                            >
                              ↺ Reset ke Rubrik Default
                            </button>
                          )}
                        </div>

                        {item ? (
                          <textarea
                            id={`comment-${item.idnilai}`}
                            rows={2}
                            className="gm-crit-comment-textarea"
                            placeholder="Tuliskan komentar atau sesuaikan rubrik penilaian untuk mahasiswa ini..."
                            value={currentComment}
                            onChange={(e) => handleCommentChange(item.idnilai, e.target.value)}
                          />
                        ) : (
                          <p style={{ fontSize: "13px", color: "#888" }}>{crit.kriteria || "Tidak ada deskripsi."}</p>
                        )}
                      </div>

                      {/* Input Row & Quick Presets */}
                      <div className="gm-crit-input-row">
                        {/* Quick Preset Buttons */}
                        <div className="gm-crit-presets">
                          <span style={{ fontSize: "11px", color: "#888", marginRight: "4px" }}>Preset Nilai:</span>
                          <button
                            type="button"
                            className="gm-crit-preset-btn"
                            onClick={() => item && handleGradeChange(item.idnilai, crit.bobot, 0)}
                          >
                            0 Poin
                          </button>
                          <button
                            type="button"
                            className="gm-crit-preset-btn"
                            onClick={() => item && handleGradeChange(item.idnilai, crit.bobot, Math.round(crit.bobot * 0.5))}
                          >
                            50% ({Math.round(crit.bobot * 0.5)})
                          </button>
                          <button
                            type="button"
                            className="gm-crit-preset-btn"
                            onClick={() => item && handleGradeChange(item.idnilai, crit.bobot, Math.round(crit.bobot * 0.75))}
                          >
                            75% ({Math.round(crit.bobot * 0.75)})
                          </button>
                          <button
                            type="button"
                            className="gm-crit-preset-btn"
                            onClick={() => item && handleGradeChange(item.idnilai, crit.bobot, Math.round(crit.bobot * 0.85))}
                          >
                            85% ({Math.round(crit.bobot * 0.85)})
                          </button>
                          <button
                            type="button"
                            className="gm-crit-preset-btn"
                            style={{ background: "#eef8f2", color: "#1f6b45", fontWeight: 600 }}
                            onClick={() => item && handleGradeChange(item.idnilai, crit.bobot, crit.bobot)}
                          >
                            Max ({crit.bobot} Poin)
                          </button>
                        </div>

                        {/* Number Input Box */}
                        <div className="gm-crit-input-group">
                          <label style={{ fontSize: "12px", fontWeight: 600, color: "#444" }}>
                            Beri Nilai:
                          </label>
                          {item ? (
                            <input
                              type="number"
                              min="0"
                              max={crit.bobot}
                              step="any"
                              className="gm-crit-number-input"
                              placeholder="0"
                              title={`Nilai maksimal adalah ${crit.bobot}`}
                              value={currentVal}
                              onChange={(e) => handleGradeChange(item.idnilai, crit.bobot, e.target.value)}
                            />
                          ) : (
                            <span style={{ color: "#ccc" }}>—</span>
                          )}
                          <span style={{ fontSize: "13px", fontWeight: 600, color: "#777" }}>
                            / {crit.bobot} Poin
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Bottom Sticky Student Navigation Bar */}
              <div className="gm-bottom-nav">
                <button
                  type="button"
                  className="gm-btn secondary"
                  disabled={currentStudentIndex === 0}
                  onClick={() => setCurrentStudentIndex(currentStudentIndex - 1)}
                >
                  ← Mahasiswa Sebelumnya
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button
                    type="button"
                    className="gm-btn secondary"
                    disabled={saving}
                    onClick={() => handleSaveAll(true)}
                  >
                    💾 Simpan Saat Ini
                  </button>

                  <button
                    type="button"
                    className="gm-btn primary"
                    disabled={saving}
                    onClick={handleSaveAndNext}
                  >
                    {currentStudentIndex === students.length - 1
                      ? "💾 Simpan Nilai (Mahasiswa Terakhir)"
                      : "Simpan & Mahasiswa Berikutnya →"}
                  </button>
                </div>
              </div>
            </main>
          </div>
        ) : (
          /* ========================================================== */
          /* MODE 2: OVERVIEW SPREADSHEET TABLE (ALL STUDENTS)          */
          /* ========================================================== */
          <div className="gm-table-wrap">
            <table className="gm-table">
              <thead>
                <tr>
                  <th className="gm-th" style={{ width: "40px" }}>#</th>
                  <th className="gm-th" style={{ minWidth: "130px" }}>NRP</th>
                  <th className="gm-th" style={{ minWidth: "200px" }}>Nama Mahasiswa</th>
                  {criteriaList.map((crit, idx) => (
                    <th key={idx} className="gm-th" style={{ textAlign: "center", minWidth: "120px" }}>
                      <div>{crit.judulkriteria}</div>
                      <div style={{ fontSize: "10px", color: "#888", fontWeight: 500 }}>
                        Max: {crit.bobot} poin
                      </div>
                    </th>
                  ))}
                  <th className="gm-th" style={{ textAlign: "center", minWidth: "130px" }}>
                    <div>Nilai Akhir</div>
                    <div style={{ fontSize: "10px", color: "#888", fontWeight: 500 }}>
                      (Jumlah / 100)
                    </div>
                  </th>
                  <th className="gm-th" style={{ textAlign: "center", width: "100px" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((st, sIdx) => {
                  const finalGrade = calculateFinalGrade(st)
                  const gradeBadgeClass =
                    finalGrade === null
                      ? "gm-badge-grade none"
                      : finalGrade >= 80
                      ? "gm-badge-grade high"
                      : finalGrade >= 60
                      ? "gm-badge-grade mid"
                      : "gm-badge-grade low"

                  return (
                    <tr key={st.nrp} className="gm-tr">
                      <td className="gm-td" style={{ color: "#999", fontWeight: 600 }}>
                        {sIdx + 1}
                      </td>
                      <td className="gm-td" style={{ fontFamily: "monospace", fontWeight: 600, color: "#111" }}>
                        {st.nrp}
                      </td>
                      <td className="gm-td">
                        <div style={{ fontWeight: 500, color: "#222" }}>{st.nama}</div>
                        <div style={{ fontSize: "11px", color: "#aaa" }}>{st.email}</div>
                      </td>

                      {criteriaList.map((crit, cIdx) => {
                        const item = st.grades[crit.judulkriteria]
                        const currentVal = item ? gradesMap[item.idnilai] ?? "" : ""
                        const currentComment = item ? commentsMap[item.idnilai] ?? "" : crit.kriteria
                        const hasCustomComment = item && currentComment !== crit.kriteria

                        return (
                          <td key={cIdx} className="gm-td" style={{ textAlign: "center" }}>
                            {item ? (
                              <div className="gm-cell-flex">
                                <input
                                  type="number"
                                  min="0"
                                  max={crit.bobot}
                                  step="any"
                                  className="gm-input-grade-table"
                                  placeholder={`0-${crit.bobot}`}
                                  title={`Nilai maksimal: ${crit.bobot}`}
                                  value={currentVal}
                                  onChange={(e) => handleGradeChange(item.idnilai, crit.bobot, e.target.value)}
                                />
                                <button
                                  type="button"
                                  className={`gm-cell-comment-btn ${hasCustomComment ? "has-custom" : ""}`}
                                  title={hasCustomComment ? `Komentar khusus: "${currentComment}"` : "Tambah komentar kriteria"}
                                  onClick={() => {
                                    setTableCommentModal({
                                      idnilai: item.idnilai,
                                      studentNama: st.nama,
                                      studentNrp: st.nrp,
                                      judulkriteria: crit.judulkriteria,
                                      defaultKriteria: crit.kriteria,
                                      comment: currentComment,
                                    })
                                  }}
                                >
                                  💬
                                </button>
                              </div>
                            ) : (
                              <span style={{ color: "#ccc" }}>—</span>
                            )}
                          </td>
                        )
                      })}

                      <td className="gm-td" style={{ textAlign: "center" }}>
                        <span className={gradeBadgeClass}>
                          {finalGrade !== null ? finalGrade.toFixed(2) : "—"}
                        </span>
                      </td>

                      <td className="gm-td" style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          className="gm-btn secondary"
                          style={{ fontSize: "11px", padding: "4px 8px" }}
                          onClick={() => {
                            const originalIdx = students.findIndex((s) => s.nrp === st.nrp)
                            setCurrentStudentIndex(originalIdx >= 0 ? originalIdx : 0)
                            setViewMode("single")
                          }}
                        >
                          👁️ Nilai
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal: Edit Comment in Table View */}
        {tableCommentModal && (
          <div className="gm-modal-overlay" onClick={() => setTableCommentModal(null)}>
            <div className="gm-modal" onClick={(e) => e.stopPropagation()}>
              <h2 style={{ fontSize: "17px", fontWeight: 600, color: "#111", marginBottom: "4px" }}>
                💬 Catatan Komentar Penilaian
              </h2>
              <p style={{ fontSize: "12px", color: "#666", marginBottom: "14px" }}>
                <strong>{tableCommentModal.studentNama}</strong> ({tableCommentModal.studentNrp}) •{" "}
                <span style={{ color: "#111", fontWeight: 600 }}>{tableCommentModal.judulkriteria}</span>
              </p>

              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "11px", color: "#888", marginBottom: "4px", textTransform: "uppercase" }}>
                  Rubrik Default:
                </div>
                <div style={{ fontSize: "12px", color: "#555", background: "#fafaf8", padding: "8px 10px", borderRadius: "6px", border: "0.5px solid rgba(0,0,0,0.06)" }}>
                  {tableCommentModal.defaultKriteria || "—"}
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "#333", textTransform: "uppercase" }}>
                    Komentar / Rubrik Khusus Mahasiswa:
                  </label>
                  <button
                    type="button"
                    style={{ fontSize: "11px", color: "#1f6b45", background: "none", border: "none", cursor: "pointer" }}
                    onClick={() => {
                      setTableCommentModal({
                        ...tableCommentModal,
                        comment: tableCommentModal.defaultKriteria,
                      })
                    }}
                  >
                    ↺ Gunakan Default
                  </button>
                </div>
                <textarea
                  style={{
                    width: "100%",
                    minHeight: "80px",
                    padding: "8px 10px",
                    border: "0.5px solid rgba(0,0,0,0.18)",
                    borderRadius: "6px",
                    fontFamily: "inherit",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  value={tableCommentModal.comment}
                  onChange={(e) => {
                    setTableCommentModal({
                      ...tableCommentModal,
                      comment: e.target.value,
                    })
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  className="gm-btn secondary"
                  onClick={() => setTableCommentModal(null)}
                >
                  Batal
                </button>
                <button
                  type="button"
                  className="gm-btn primary"
                  onClick={() => {
                    handleCommentChange(tableCommentModal.idnilai, tableCommentModal.comment)
                    setTableCommentModal(null)
                  }}
                >
                  Terapkan Catatan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Enroll Students */}
        {showAddModal && (
          <div className="gm-modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="gm-modal" onClick={(e) => e.stopPropagation()}>
              <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#111", marginBottom: "6px" }}>
                👥 Daftarkan Mahasiswa ke {matkul}
              </h2>
              <p style={{ fontSize: "13px", color: "#777", marginBottom: "16px" }}>
                Masukkan daftar NRP mahasiswa yang mengambil mata kuliah ini (pisahkan dengan koma atau baris baru).
              </p>

              <textarea
                style={{
                  width: "100%",
                  minHeight: "130px",
                  padding: "10px 12px",
                  border: "0.5px solid rgba(0,0,0,0.18)",
                  borderRadius: "8px",
                  fontFamily: "monospace",
                  fontSize: "13px",
                  outline: "none",
                  boxSizing: "border-box",
                  marginBottom: "16px",
                }}
                placeholder={"5803024001\n5803024002\n5803024003"}
                value={newStudentNrps}
                onChange={(e) => setNewStudentNrps(e.target.value)}
              />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  className="gm-btn secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Batal
                </button>
                <button
                  type="button"
                  className="gm-btn primary"
                  disabled={enrolling || !newStudentNrps.trim()}
                  onClick={handleEnrollStudents}
                >
                  {enrolling ? "Mendaftarkan..." : "Daftarkan Mahasiswa"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
