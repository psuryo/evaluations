"use client"

import { useState } from "react"
import Link from "next/link"

interface Criteria {
  judulkriteria: string
  kriteria: string
  bobot: number
}

interface CourseItem {
  idkuliah: number
  matkul: string
  tahun: string
  criteriaList: Criteria[]
  totalBobot: number
  totalCriteria: number
  studentCount: number
  groupCount: number
  submissionCount: number
}

interface CourseListProps {
  initialCourses: CourseItem[]
}

export default function CourseList({ initialCourses }: CourseListProps) {
  const [courses, setCourses] = useState<CourseItem[]>(initialCourses)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedYear, setSelectedYear] = useState<string>("all")
  const [expandedCourseId, setExpandedCourseId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Extract unique years for filter tabs
  const availableYears = Array.from(new Set(courses.map((c) => c.tahun).filter(Boolean))).sort().reverse()

  // Filter courses
  const filteredCourses = courses.filter((c) => {
    const matchesSearch =
      c.matkul.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.tahun.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.criteriaList.some((crit) =>
        crit.judulkriteria.toLowerCase().includes(searchTerm.toLowerCase()) ||
        crit.kriteria.toLowerCase().includes(searchTerm.toLowerCase())
      )

    const matchesYear = selectedYear === "all" || c.tahun === selectedYear
    return matchesSearch && matchesYear
  })

  // Toggle criteria breakdown expansion
  const toggleExpand = (idkuliah: number) => {
    setExpandedCourseId(expandedCourseId === idkuliah ? null : idkuliah)
  }

  // Handle delete course
  const handleDelete = async (idkuliah: number, matkulName: string) => {
    const confirmed = window.confirm(
      `Apakah Anda yakin ingin menghapus mata kuliah "${matkulName}"?\n\nSemua kriteria, data nilai, kelompok, dan evaluasi terkait akan ikut terhapus.`
    )
    if (!confirmed) return

    setDeletingId(idkuliah)
    setStatusMsg(null)

    try {
      const res = await fetch(`/api/admin/kuliah/${idkuliah}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Gagal menghapus kuliah.")
      }

      setCourses(courses.filter((c) => c.idkuliah !== idkuliah))
      setStatusMsg({ type: "success", text: `Kuliah "${matkulName}" berhasil dihapus.` })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal menghapus mata kuliah."
      setStatusMsg({ type: "error", text: message })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <style>{`
        .cl-container { display: flex; flex-direction: column; gap: 20px; }

        .cl-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.08);
          border-radius: 12px;
          padding: 16px 20px;
        }

        .cl-search-box {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #fafaf8;
          border: 0.5px solid rgba(0,0,0,0.12);
          border-radius: 8px;
          padding: 8px 14px;
          flex: 1;
          min-width: 260px;
        }
        .cl-search-input {
          border: none;
          background: transparent;
          outline: none;
          font-family: inherit;
          font-size: 13px;
          color: #111;
          width: 100%;
        }

        .cl-filter-tabs {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .cl-tab-btn {
          font-family: inherit;
          font-size: 12px;
          padding: 6px 12px;
          border-radius: 20px;
          border: 0.5px solid rgba(0,0,0,0.1);
          background: #f4f3ef;
          color: #555;
          cursor: pointer;
          transition: all 0.15s;
        }
        .cl-tab-btn:hover { background: #e8e6e0; color: #111; }
        .cl-tab-btn.active {
          background: #111;
          color: #fff;
          border-color: #111;
        }

        .cl-cards-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .cl-card {
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.08);
          border-radius: 12px;
          overflow: hidden;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .cl-card:hover {
          border-color: rgba(0,0,0,0.15);
          box-shadow: 0 2px 8px rgba(0,0,0,0.03);
        }

        .cl-card-main {
          padding: 20px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          cursor: pointer;
          user-select: none;
        }

        .cl-course-info {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
        }
        .cl-course-title-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .cl-course-name {
          font-size: 16px;
          font-weight: 600;
          color: #111;
        }
        .cl-course-year {
          font-size: 12px;
          color: #777;
          background: #f4f3ef;
          padding: 2px 8px;
          border-radius: 6px;
          font-weight: 400;
        }

        .cl-badges-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 2px;
        }
        .cl-badge {
          font-size: 11px;
          font-weight: 500;
          padding: 3px 8px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .cl-badge.ok {
          background: #f0faf5;
          color: #1f6b45;
          border: 0.5px solid #a8d8bc;
        }
        .cl-badge.warn {
          background: #fdf8ee;
          color: #8a6200;
          border: 0.5px solid #e8d08a;
        }
        .cl-badge.info {
          background: #f4f3ef;
          color: #555;
        }

        .cl-card-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        .cl-action-btn {
          font-family: inherit;
          font-size: 12px;
          font-weight: 500;
          color: #333;
          background: #fafaf8;
          border: 0.5px solid rgba(0,0,0,0.12);
          border-radius: 6px;
          padding: 6px 12px;
          text-decoration: none;
          transition: all 0.15s;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
        }
        .cl-action-btn:hover {
          background: #111;
          color: #fff;
          border-color: #111;
        }
        .cl-action-btn.delete {
          color: #b91c1c;
          border-color: rgba(185, 28, 28, 0.2);
        }
        .cl-action-btn.delete:hover {
          background: #b91c1c;
          color: #fff;
          border-color: #b91c1c;
        }

        /* Criteria Expandable Section */
        .cl-crit-panel {
          background: #fafaf8;
          border-top: 0.5px solid rgba(0,0,0,0.08);
          padding: 18px 24px;
        }
        .cl-crit-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .cl-crit-title {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #666;
        }

        .cl-crit-table {
          width: 100%;
          border-collapse: collapse;
          background: #fff;
          border-radius: 8px;
          overflow: hidden;
          border: 0.5px solid rgba(0,0,0,0.06);
        }
        .cl-crit-table th {
          font-size: 11px;
          font-weight: 600;
          color: #888;
          text-align: left;
          padding: 10px 14px;
          background: #f4f3ef;
          border-bottom: 0.5px solid rgba(0,0,0,0.06);
        }
        .cl-crit-table td {
          font-size: 13px;
          color: #333;
          padding: 10px 14px;
          border-bottom: 0.5px solid rgba(0,0,0,0.04);
        }
        .cl-crit-table tr:last-child td { border-bottom: none; }

        .cl-bobot-pill {
          font-family: monospace;
          font-size: 12px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 12px;
          background: #eef8f2;
          color: #1f6b45;
          display: inline-block;
        }

        .cl-empty {
          text-align: center;
          padding: 60px 24px;
          background: #fff;
          border-radius: 12px;
          border: 0.5px dashed rgba(0,0,0,0.15);
        }
        .cl-empty-title { font-size: 16px; font-weight: 600; color: #333; margin-bottom: 6px; }
        .cl-empty-sub { font-size: 13px; color: #888; margin-bottom: 20px; }

        .cl-status-alert {
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .cl-status-alert.success { background: #f0faf5; color: #1f6b45; border: 0.5px solid #a8d8bc; }
        .cl-status-alert.error { background: #fdf2f2; color: #b91c1c; border: 0.5px solid #f8b4b4; }

        @media (max-width: 640px) {
          .cl-card-main { flex-direction: column; align-items: flex-start; }
          .cl-card-actions { width: 100%; justify-content: flex-end; margin-top: 10px; }
        }
      `}</style>

      <div className="cl-container">
        {statusMsg && (
          <div className={`cl-status-alert ${statusMsg.type}`}>
            <span>{statusMsg.type === "success" ? "✓" : "⚠️"}</span>
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Filter and Search Controls */}
        <div className="cl-controls">
          <div className="cl-search-box">
            <span>🔍</span>
            <input
              type="text"
              className="cl-search-input"
              placeholder="Cari nama mata kuliah, tahun, atau kriteria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                style={{ background: "none", border: "none", color: "#888", cursor: "pointer" }}
              >
                ✕
              </button>
            )}
          </div>

          <div className="cl-filter-tabs">
            <button
              type="button"
              className={`cl-tab-btn ${selectedYear === "all" ? "active" : ""}`}
              onClick={() => setSelectedYear("all")}
            >
              Semua Tahun ({courses.length})
            </button>
            {availableYears.map((yr) => (
              <button
                key={yr}
                type="button"
                className={`cl-tab-btn ${selectedYear === yr ? "active" : ""}`}
                onClick={() => setSelectedYear(yr)}
              >
                {yr} ({courses.filter((c) => c.tahun === yr).length})
              </button>
            ))}
          </div>
        </div>

        {/* Courses List */}
        {filteredCourses.length === 0 ? (
          <div className="cl-empty">
            <p className="cl-empty-title">Tidak Ada Mata Kuliah yang Ditemukan</p>
            <p className="cl-empty-sub">
              {searchTerm || selectedYear !== "all"
                ? "Coba ubah kata kunci pencarian atau filter tahun akademik."
                : "Belum ada mata kuliah yang dibuat. Buat mata kuliah pertama Anda sekarang."}
            </p>
            <Link
              href="/admin/kuliah/new"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "10px 20px",
                background: "#111",
                color: "#fff",
                borderRadius: "8px",
                textDecoration: "none",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              <span>+</span> Buat Kuliah Baru (Bobot 100%)
            </Link>
          </div>
        ) : (
          <div className="cl-cards-list">
            {filteredCourses.map((c) => {
              const isExpanded = expandedCourseId === c.idkuliah
              const is100 = c.totalBobot === 100

              return (
                <div key={c.idkuliah} className="cl-card">
                  <div className="cl-card-main" onClick={() => toggleExpand(c.idkuliah)}>
                    <div className="cl-course-info">
                      <div className="cl-course-title-row">
                        <span className="cl-course-name">{c.matkul}</span>
                        <span className="cl-course-year">{c.tahun}</span>
                      </div>

                      <div className="cl-badges-row">
                        <span className={`cl-badge ${is100 ? "ok" : "warn"}`}>
                          {is100 ? "✓ Bobot: 100%" : `⚠️ Bobot: ${c.totalBobot}%`}
                        </span>
                        <span className="cl-badge info">
                          📋 {c.totalCriteria} Kriteria Penilaian
                        </span>
                        <span className="cl-badge info">
                          👥 {c.studentCount} Mahasiswa
                        </span>
                        {c.groupCount > 0 && (
                          <span className="cl-badge info">
                            🧩 {c.groupCount} Kelompok
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="cl-card-actions" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/admin/kuliah/${c.idkuliah}/nilai`}
                        className="cl-action-btn"
                        style={{ background: "#111", color: "#fff", borderColor: "#111" }}
                        title="Input nilai mahasiswa per kriteria"
                      >
                        📝 Input Nilai
                      </Link>
                      <Link
                        href={`/admin/kuliah/${c.idkuliah}/edit`}
                        className="cl-action-btn"
                        title="Edit kriteria dan bobot kuliah ini"
                      >
                        ⚙️ Kriteria &amp; Bobot
                      </Link>
                      <Link
                        href={`/grade`}
                        className="cl-action-btn"
                        title="Lihat rekap seluruh nilai"
                      >
                        📊 Rekap
                      </Link>
                      <button
                        type="button"
                        className="cl-action-btn delete"
                        disabled={deletingId === c.idkuliah}
                        onClick={() => handleDelete(c.idkuliah, c.matkul)}
                        title="Hapus mata kuliah ini"
                      >
                        {deletingId === c.idkuliah ? "Menghapus..." : "🗑️ Hapus"}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleExpand(c.idkuliah)}
                        className="cl-action-btn"
                        style={{ padding: "6px 8px" }}
                        title="Lihat detail kriteria"
                      >
                        {isExpanded ? "▲" : "▼"}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Criteria Breakdown Panel */}
                  {isExpanded && (
                    <div className="cl-crit-panel">
                      <div className="cl-crit-header">
                        <span className="cl-crit-title">Rincian Kriteria &amp; Bobot Penilaian</span>
                        <span style={{ fontSize: "12px", color: is100 ? "#1f6b45" : "#8a6200", fontWeight: 600 }}>
                          Akumulasi Bobot: {c.totalBobot}% / 100% {is100 ? "✓" : "(Perlu Penyesuaian)"}
                        </span>
                      </div>

                      {c.criteriaList.length === 0 ? (
                        <p style={{ fontSize: "13px", color: "#999", padding: "10px 0" }}>
                          Belum ada kriteria penilaian yang tersimpan untuk mata kuliah ini.
                        </p>
                      ) : (
                        <table className="cl-crit-table">
                          <thead>
                            <tr>
                              <th style={{ width: "35px" }}>#</th>
                              <th style={{ width: "30%" }}>Judul Kriteria</th>
                              <th style={{ width: "55%" }}>Deskripsi / Rubrik Penilaian</th>
                              <th style={{ width: "15%", textAlign: "right" }}>Bobot</th>
                            </tr>
                          </thead>
                          <tbody>
                            {c.criteriaList.map((crit, idx) => (
                              <tr key={idx}>
                                <td style={{ fontWeight: 600, color: "#888" }}>{idx + 1}</td>
                                <td style={{ fontWeight: 500, color: "#111" }}>{crit.judulkriteria}</td>
                                <td style={{ color: "#555" }}>{crit.kriteria}</td>
                                <td style={{ textAlign: "right" }}>
                                  <span className="cl-bobot-pill">{crit.bobot}%</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
