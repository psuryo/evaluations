"use client"

import { useState, useRef, useMemo } from "react"
import {
  CriteriaItem,
  StudentItem,
  ExcelParseSummary,
  parseGradeExcel,
  downloadGradeTemplateBrowser,
} from "@/app/src/lib/excelGradeUtils"

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

interface ExcelGradeImportModalProps {
  isOpen: boolean
  onClose: () => void
  idkuliah: number
  matkul: string
  tahun?: string
  criteriaList: CriteriaItem[]
  students: StudentRow[]
  onApplyGrades: (
    updates: { idnilai: number; grade: number | null; kriteria?: string | null }[],
    newNrps: string[]
  ) => void
  onSaveDirect: (
    updates: { idnilai: number; grade: number | null; kriteria?: string | null }[],
    newNrps: string[]
  ) => Promise<boolean>
}

export default function ExcelGradeImportModal({
  isOpen,
  onClose,
  idkuliah,
  matkul,
  tahun = "",
  criteriaList,
  students,
  onApplyGrades,
  onSaveDirect,
}: ExcelGradeImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [summary, setSummary] = useState<ExcelParseSummary | null>(null)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [autoEnrollNewStudents, setAutoEnrollNewStudents] = useState(true)
  const [filterTab, setFilterTab] = useState<"all" | "ready" | "new" | "warning">("all")
  const [previewSearch, setPreviewSearch] = useState("")
  const [errorMsg, setErrorMsg] = useState("")

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Mapping NRP -> StudentRow untuk lookup cepat idnilai per kriteria
  const studentMap = useMemo(() => {
    const map = new Map<string, StudentRow>()
    for (const s of students) {
      map.set(s.nrp.trim().toLowerCase(), s)
    }
    return map
  }, [students])

  if (!isOpen) return null

  // Handle file reading
  const handleFileChange = async (selectedFile: File) => {
    setFile(selectedFile)
    setParsing(true)
    setErrorMsg("")
    setSummary(null)

    try {
      const arrayBuffer = await selectedFile.arrayBuffer()
      const studentItems: StudentItem[] = students.map((s) => ({
        nrp: s.nrp,
        nama: s.nama,
        email: s.email,
        grades: s.grades,
      }))

      const result = parseGradeExcel(arrayBuffer, selectedFile.name, criteriaList, studentItems)
      setSummary(result)
      if (result.hasErrors && result.errors.length > 0) {
        setErrorMsg(result.errors.join("\n"))
      }
    } catch (err) {
      console.error("Gagal membaca file Excel:", err)
      setErrorMsg("Gagal membaca file Excel. Pastikan file berformat .xlsx atau .xls yang valid.")
    } finally {
      setParsing(false)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0]
      if (
        droppedFile.name.endsWith(".xlsx") ||
        droppedFile.name.endsWith(".xls") ||
        droppedFile.name.endsWith(".csv")
      ) {
        handleFileChange(droppedFile)
      } else {
        setErrorMsg("Format file tidak didukung. Harap unggah file .xlsx atau .xls.")
      }
    }
  }

  const resetFile = () => {
    setFile(null)
    setSummary(null)
    setErrorMsg("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // Siapkan daftar updates (idnilai, grade & kriteria) untuk mahasiswa yang sudah terdaftar
  const preparedUpdates = useMemo(() => {
    if (!summary) return { existingUpdates: [], newNrps: [] }

    const updates: { idnilai: number; grade: number | null; kriteria?: string | null }[] = []
    const newNrps: string[] = []

    for (const row of summary.rows) {
      const st = studentMap.get(row.nrp.toLowerCase())
      if (st) {
        // Mahasiswa terdaftar
        for (const mc of summary.matchedCriteria) {
          const gradeInfo = row.matchedGrades[mc.judulkriteria]
          const descInfo = row.matchedComments[mc.judulkriteria]
          if (gradeInfo && gradeInfo.isValid && gradeInfo.value !== null) {
            const item = st.grades[mc.judulkriteria]
            if (item) {
              updates.push({
                idnilai: item.idnilai,
                grade: gradeInfo.value,
                kriteria: descInfo ? descInfo.value : undefined,
              })
            }
          }
        }
      } else {
        // Mahasiswa baru
        newNrps.push(row.nrp)
      }
    }

    return { existingUpdates: updates, newNrps }
  }, [summary, studentMap])

  // Filter baris untuk tabel preview
  const filteredRows = useMemo(() => {
    if (!summary) return []
    return summary.rows.filter((r) => {
      // Filter berdasarkan tab
      if (filterTab === "ready" && (r.status !== "valid" || !r.isEnrolled)) return false
      if (filterTab === "new" && r.isEnrolled) return false
      if (filterTab === "warning" && r.status !== "warning" && r.status !== "error") return false

      // Filter pencarian
      if (previewSearch.trim()) {
        const q = previewSearch.trim().toLowerCase()
        return r.nrp.toLowerCase().includes(q) || r.nama.toLowerCase().includes(q)
      }
      return true
    })
  }, [summary, filterTab, previewSearch])

  // Action: Terapkan ke Matriks Nilai (Draft editor)
  const handleApply = () => {
    if (!summary) return
    const nrpsToEnroll = autoEnrollNewStudents ? preparedUpdates.newNrps : []
    onApplyGrades(preparedUpdates.existingUpdates, nrpsToEnroll)
    onClose()
  }

  // Action: Simpan Langsung ke Database
  const handleSaveDirectly = async () => {
    if (!summary) return
    setSaving(true)
    setErrorMsg("")
    try {
      const nrpsToEnroll = autoEnrollNewStudents ? preparedUpdates.newNrps : []
      const success = await onSaveDirect(preparedUpdates.existingUpdates, nrpsToEnroll)
      if (success) {
        onClose()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan nilai ke database"
      setErrorMsg(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "880px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#fff",
          }}
        >
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#111", margin: 0 }}>
              📥 Import Nilai Mahasiswa dari Excel
            </h2>
            <p style={{ fontSize: "13px", color: "#666", margin: "4px 0 0 0" }}>
              Mata Kuliah: <strong>{matkul}</strong> {tahun && `(${tahun})`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              background: "none",
              border: "none",
              fontSize: "20px",
              color: "#888",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: "6px",
            }}
            title="Tutup"
          >
            ✕
          </button>
        </div>

        {/* Body Modal */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          {/* Download Template Banner */}
          <div
            style={{
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "10px",
              padding: "14px 18px",
              marginBottom: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontWeight: 600, color: "#166534", fontSize: "13px" }}>
                📄 Belum memiliki template Excel?
              </div>
              <div style={{ color: "#15803d", fontSize: "12px", marginTop: "2px" }}>
                Unduh template resmi dengan kolom kriteria dan daftar mahasiswa mata kuliah ini sudah terisi otomatis.
              </div>
            </div>
            <button
              type="button"
              className="gm-btn secondary"
              style={{
                background: "#fff",
                color: "#166534",
                borderColor: "#86efac",
                fontWeight: 600,
                fontSize: "12px",
                padding: "7px 14px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
              onClick={() =>
                downloadGradeTemplateBrowser({
                  matkul,
                  tahun,
                  criteriaList,
                  students: students.map((s) => ({ nrp: s.nrp, nama: s.nama, email: s.email, grades: s.grades })),
                })
              }
            >
              <span>⬇️</span> Unduh Template Excel (.xlsx)
            </button>
          </div>

          {errorMsg && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                padding: "12px 16px",
                color: "#991b1b",
                fontSize: "13px",
                marginBottom: "16px",
                whiteSpace: "pre-line",
              }}
            >
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Upload Dropzone */}
          {!file ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: "2px dashed #d1d5db",
                borderRadius: "12px",
                padding: "36px 20px",
                textAlign: "center",
                cursor: "pointer",
                background: "#f9fafb",
                transition: "all 0.15s ease",
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileChange(e.target.files[0])
                  }
                }}
              />
              <div style={{ fontSize: "36px", marginBottom: "8px" }}>📊</div>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "#111", margin: "0 0 4px" }}>
                Pilih atau seret file spreadsheet Excel ke sini
              </p>
              <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>
                Mendukung format <strong>.xlsx</strong>, <strong>.xls</strong>, atau <strong>.csv</strong>
              </p>
            </div>
          ) : (
            <div>
              {/* Info File Terpilih */}
              <div
                style={{
                  background: "#f3f4f6",
                  borderRadius: "10px",
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "20px" }}>📄</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "13px", color: "#111" }}>{file.name}</div>
                    <div style={{ fontSize: "11px", color: "#6b7280" }}>
                      {(file.size / 1024).toFixed(1)} KB · Sheet:{" "}
                      <strong>{summary?.sheetName || "Memuat..."}</strong>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resetFile}
                  disabled={saving || parsing}
                  style={{
                    background: "none",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    padding: "4px 10px",
                    fontSize: "12px",
                    color: "#4b5563",
                    cursor: "pointer",
                  }}
                >
                  Ganti File
                </button>
              </div>

              {parsing && (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#666" }}>
                  ⏳ Sedang membaca dan memverifikasi data Excel...
                </div>
              )}

              {/* Rangkuman Hasil Parse */}
              {summary && (
                <div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                      gap: "10px",
                      marginBottom: "16px",
                    }}
                  >
                    <div
                      style={{
                        background: "#eff6ff",
                        border: "1px solid #bfdbfe",
                        borderRadius: "8px",
                        padding: "10px 14px",
                      }}
                    >
                      <div style={{ fontSize: "11px", color: "#1d4ed8", fontWeight: 500 }}>
                        MAHASISWA COCOK
                      </div>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: "#1e40af", marginTop: "2px" }}>
                        {summary.enrolledMatchCount}{" "}
                        <span style={{ fontSize: "12px", fontWeight: 400, color: "#60a5fa" }}>
                          / {students.length}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        background: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                        borderRadius: "8px",
                        padding: "10px 14px",
                      }}
                    >
                      <div style={{ fontSize: "11px", color: "#15803d", fontWeight: 500 }}>
                        KRITERIA COCOK
                      </div>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: "#166534", marginTop: "2px" }}>
                        {summary.matchedCriteria.length}{" "}
                        <span style={{ fontSize: "12px", fontWeight: 400, color: "#4ade80" }}>
                          / {criteriaList.length}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        background: "#fdf4ff",
                        border: "1px solid #f5d0fe",
                        borderRadius: "8px",
                        padding: "10px 14px",
                      }}
                    >
                      <div style={{ fontSize: "11px", color: "#a21caf", fontWeight: 500 }}>
                        NILAI AKAN DIUPDATE
                      </div>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: "#86198f", marginTop: "2px" }}>
                        {preparedUpdates.existingUpdates.length}
                      </div>
                    </div>

                    {summary.newStudentCount > 0 && (
                      <div
                        style={{
                          background: "#fffbeb",
                          border: "1px solid #fde68a",
                          borderRadius: "8px",
                          padding: "10px 14px",
                        }}
                      >
                        <div style={{ fontSize: "11px", color: "#b45309", fontWeight: 500 }}>
                          MAHASISWA BARU
                        </div>
                        <div style={{ fontSize: "18px", fontWeight: 700, color: "#92400e", marginTop: "2px" }}>
                          {summary.newStudentCount}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Kriteria yang terdeteksi */}
                  <div style={{ marginBottom: "14px", fontSize: "12px", color: "#4b5563" }}>
                    🎯 <strong>Kriteria terdeteksi:</strong>{" "}
                    {summary.matchedCriteria.map((m) => m.judulkriteria).join(", ") || "Tidak ada"}
                    {summary.unmatchedColumns.length > 0 && (
                      <span style={{ color: "#9ca3af", marginLeft: "8px" }}>
                        (Kolom diabaikan: {summary.unmatchedColumns.join(", ")})
                      </span>
                    )}
                  </div>

                  {/* Opsi Mahasiswa Baru jika ada */}
                  {summary.newStudentCount > 0 && (
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        background: "#fffbeb",
                        border: "1px solid #fde68a",
                        borderRadius: "8px",
                        padding: "10px 14px",
                        marginBottom: "16px",
                        fontSize: "13px",
                        color: "#92400e",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={autoEnrollNewStudents}
                        onChange={(e) => setAutoEnrollNewStudents(e.target.checked)}
                      />
                      <span>
                        Otomatis daftarkan <strong>{summary.newStudentCount} mahasiswa baru</strong> di atas ke mata kuliah ini
                      </span>
                    </label>
                  )}

                  {/* Filter & Search Bar Preview */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                      marginBottom: "10px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => setFilterTab("all")}
                        style={{
                          background: filterTab === "all" ? "#111" : "#f3f4f6",
                          color: filterTab === "all" ? "#fff" : "#4b5563",
                          border: "none",
                          borderRadius: "6px",
                          padding: "5px 12px",
                          fontSize: "12px",
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        Semua ({summary.rows.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterTab("ready")}
                        style={{
                          background: filterTab === "ready" ? "#166534" : "#f0fdf4",
                          color: filterTab === "ready" ? "#fff" : "#166534",
                          border: "none",
                          borderRadius: "6px",
                          padding: "5px 12px",
                          fontSize: "12px",
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        Cocok ({summary.enrolledMatchCount})
                      </button>
                      {summary.newStudentCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setFilterTab("new")}
                          style={{
                            background: filterTab === "new" ? "#92400e" : "#fef3c7",
                            color: filterTab === "new" ? "#fff" : "#92400e",
                            border: "none",
                            borderRadius: "6px",
                            padding: "5px 12px",
                            fontSize: "12px",
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          Baru ({summary.newStudentCount})
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      placeholder="Cari NRP atau nama..."
                      value={previewSearch}
                      onChange={(e) => setPreviewSearch(e.target.value)}
                      style={{
                        padding: "5px 10px",
                        fontSize: "12px",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        outline: "none",
                        width: "180px",
                      }}
                    />
                  </div>

                  {/* Tabel Pratinjau */}
                  <div
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      maxHeight: "260px",
                      overflowY: "auto",
                      overflowX: "auto",
                    }}
                  >
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                      <thead>
                        <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb", textAlign: "left" }}>
                          <th style={{ padding: "8px 12px", fontWeight: 600, color: "#4b5563" }}>NRP</th>
                          <th style={{ padding: "8px 12px", fontWeight: 600, color: "#4b5563" }}>Nama Mahasiswa</th>
                          {summary.matchedCriteria.map((mc) => (
                            <th
                              key={mc.judulkriteria}
                              style={{
                                padding: "8px 12px",
                                fontWeight: 600,
                                color: "#4b5563",
                                textAlign: "center",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {mc.judulkriteria}{" "}
                              <span style={{ fontSize: "11px", fontWeight: 400, color: "#6b7280" }}>
                                (Maks {mc.bobot})
                              </span>
                            </th>
                          ))}
                          <th style={{ padding: "8px 12px", fontWeight: 600, color: "#4b5563" }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={3 + summary.matchedCriteria.length}
                              style={{ padding: "24px", textAlign: "center", color: "#9ca3af" }}
                            >
                              Tidak ada data mahasiswa pada filter ini
                            </td>
                          </tr>
                        ) : (
                          filteredRows.map((row) => (
                            <tr
                              key={row.nrp}
                              style={{
                                borderBottom: "1px solid #f3f4f6",
                                background: !row.isEnrolled ? "#fffdf5" : undefined,
                              }}
                            >
                              <td style={{ padding: "8px 12px", fontFamily: "monospace", fontWeight: 500 }}>
                                {row.nrp}
                              </td>
                              <td style={{ padding: "8px 12px", color: "#111" }}>{row.nama}</td>
                              {summary.matchedCriteria.map((mc) => {
                                const g = row.matchedGrades[mc.judulkriteria]
                                const c = row.matchedComments[mc.judulkriteria]
                                const hasVal = g && g.value !== null && g.isValid
                                return (
                                  <td
                                    key={mc.judulkriteria}
                                    style={{
                                      padding: "8px 12px",
                                      textAlign: "center",
                                      verticalAlign: "middle",
                                    }}
                                  >
                                    <div>
                                      {hasVal ? (
                                        <span
                                          style={{
                                            background: "#f0fdf4",
                                            color: "#166534",
                                            padding: "2px 6px",
                                            borderRadius: "4px",
                                            border: "1px solid #bbf7d0",
                                            fontWeight: 600,
                                          }}
                                        >
                                          {g.value}
                                        </span>
                                      ) : (
                                        <span style={{ color: "#9ca3af" }}>—</span>
                                      )}
                                    </div>
                                    {c && (
                                      <div
                                        style={{
                                          fontSize: "10px",
                                          marginTop: "3px",
                                          color: c.isCustom ? "#1d4ed8" : "#888",
                                          fontStyle: c.isCustom ? "normal" : "italic",
                                          maxWidth: "160px",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          whiteSpace: "nowrap",
                                          margin: "3px auto 0",
                                        }}
                                        title={
                                          c.isCustom
                                            ? `Deskripsi Kustom: ${c.value}`
                                            : `Deskripsi Default: ${c.value || "—"}`
                                        }
                                      >
                                        {c.isCustom ? `💬 ${c.value}` : `(Default)`}
                                      </div>
                                    )}
                                  </td>
                                )
                              })}
                              <td style={{ padding: "8px 12px" }}>
                                {row.isEnrolled ? (
                                  <span
                                    style={{
                                      background: "#f0fdf4",
                                      color: "#166534",
                                      fontSize: "11px",
                                      padding: "2px 6px",
                                      borderRadius: "10px",
                                      fontWeight: 500,
                                    }}
                                  >
                                    Terdaftar
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      background: "#fef3c7",
                                      color: "#92400e",
                                      fontSize: "11px",
                                      padding: "2px 6px",
                                      borderRadius: "10px",
                                      fontWeight: 500,
                                    }}
                                  >
                                    Baru
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "10px",
            background: "#f9fafb",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="gm-btn secondary"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Batal
          </button>

          {summary && summary.matchedCriteria.length > 0 && (
            <>
              <button
                type="button"
                className="gm-btn secondary"
                onClick={handleApply}
                disabled={saving || parsing || preparedUpdates.existingUpdates.length === 0}
                style={{
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                title="Terapkan nilai yang dibaca ke editor matriks tanpa langsung menyimpan ke database"
              >
                📋 Terapkan ke Matriks Nilai
              </button>

              <button
                type="button"
                className="gm-btn primary"
                onClick={handleSaveDirectly}
                disabled={saving || parsing || preparedUpdates.existingUpdates.length === 0}
                style={{
                  padding: "8px 18px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  background: "#166534",
                  borderColor: "#15803d",
                }}
                title="Langsung simpan nilai yang diimpor ke database"
              >
                {saving ? "Menyimpan ke Database..." : "💾 Import & Langsung Simpan"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

