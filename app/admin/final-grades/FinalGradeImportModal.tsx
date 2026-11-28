"use client"

import { useState, useRef, useMemo } from "react"
import {
  FinalGradeParseSummary,
  FinalGradeTemplateRow,
  downloadFinalGradeTemplateBrowser,
  parseFinalGradeExcel,
} from "@/app/src/lib/excelFinalGradeUtils"

interface CourseOption {
  idkuliah: number
  matkul: string
  tahun: string
  hasFinalGrades: boolean
}

interface FinalGradeImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImported: () => void
  allCourses: CourseOption[]
  existingRowsByCourse: Record<number, FinalGradeTemplateRow[]>
  defaultCourseId?: string
}

export default function FinalGradeImportModal({
  isOpen,
  onClose,
  onImported,
  allCourses,
  existingRowsByCourse,
  defaultCourseId,
}: FinalGradeImportModalProps) {
  const unusedCourses = useMemo(
    () => allCourses.filter((c) => !c.hasFinalGrades),
    [allCourses]
  )

  const [onlyUnused, setOnlyUnused] = useState<boolean>(
    !defaultCourseId && unusedCourses.length > 0
  )

  const courseOptions = onlyUnused ? unusedCourses : allCourses

  const [selectedCourseId, setSelectedCourseId] = useState<string>(() => {
    if (defaultCourseId && defaultCourseId !== "ALL") return defaultCourseId
    if (unusedCourses.length > 0) return String(unusedCourses[0].idkuliah)
    return allCourses[0] ? String(allCourses[0].idkuliah) : ""
  })

  const [summary, setSummary] = useState<FinalGradeParseSummary | null>(null)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const activeCourse = allCourses.find(
    (c) => String(c.idkuliah) === selectedCourseId
  )

  const handleFileChange = async (file: File) => {
    setParsing(true)
    setErrorMsg("")
    setSummary(null)
    try {
      const buffer = await file.arrayBuffer()
      const result = parseFinalGradeExcel(buffer, file.name)
      setSummary(result)
      if (result.hasErrors && result.errors.length > 0) {
        setErrorMsg(result.errors.join("\n"))
      }
    } catch {
      setErrorMsg("Gagal membaca file Excel. Pastikan format .xlsx, .xls, atau .csv valid.")
    } finally {
      setParsing(false)
    }
  }

  const handleDownloadTemplate = () => {
    if (!activeCourse) return
    downloadFinalGradeTemplateBrowser({
      matkul: activeCourse.matkul,
      tahun: activeCourse.tahun,
      students: existingRowsByCourse[activeCourse.idkuliah] ?? [],
    })
  }

  const handleSubmit = async () => {
    if (!selectedCourseId || !summary) return
    const validRows = summary.rows.filter((r) => r.isValid)
    if (validRows.length === 0) {
      setErrorMsg("Tidak ada baris valid untuk diimpor.")
      return
    }

    setSaving(true)
    setErrorMsg("")
    try {
      const res = await fetch("/api/admin/final-grades/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idkuliah: Number(selectedCourseId),
          rows: validRows.map((r) => ({
            nrp: r.nrp,
            mid_assignment_grade: r.mid_assignment_grade,
            mid_exam_grade: r.mid_exam_grade,
            final_assignment_grade: r.final_assignment_grade,
            final_exam_grade: r.final_exam_grade,
            final_grade: r.final_grade,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(json.error ?? "Gagal mengimpor final grades")
        setSaving(false)
        return
      }
      setSaving(false)
      onImported()
      onClose()
    } catch {
      setErrorMsg("Terjadi kesalahan jaringan saat mengimpor data.")
      setSaving(false)
    }
  }

  return (
    <div
      className="fg-modal-backdrop"
      onClick={() => !saving && onClose()}
    >
      <div
        className="fg-modal"
        style={{ maxWidth: 720, maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fg-modal-header">
          <h3 className="fg-modal-title">Import Nilai Final Grades (Excel)</h3>
          <button
            type="button"
            className="fg-modal-close"
            onClick={() => !saving && onClose()}
          >
            ×
          </button>
        </div>

        {errorMsg && (
          <div className="fg-form-error" style={{ whiteSpace: "pre-line" }}>
            {errorMsg}
          </div>
        )}

        <div className="fg-form-field" style={{ marginBottom: 14 }}>
          <label className="fg-filter-label">Mata Kuliah Tujuan</label>
          <select
            className="fg-select"
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
          >
            {courseOptions.map((c) => (
              <option key={c.idkuliah} value={String(c.idkuliah)}>
                {c.matkul} ({c.tahun}){c.hasFinalGrades ? " — sudah ada nilai" : ""}
              </option>
            ))}
          </select>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "#666",
              marginTop: 4,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={onlyUnused}
              onChange={(e) => {
                const next = e.target.checked
                setOnlyUnused(next)
                const nextList = next ? unusedCourses : allCourses
                if (!nextList.some((c) => String(c.idkuliah) === selectedCourseId)) {
                  setSelectedCourseId(nextList[0] ? String(nextList[0].idkuliah) : "")
                }
              }}
            />
            <span>
              Hanya tampilkan kuliah yang belum digunakan di Final Grades ({unusedCourses.length})
            </span>
          </label>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 14px",
            background: "#faf9f6",
            border: "0.5px solid rgba(0,0,0,0.08)",
            borderRadius: 8,
            marginBottom: 14,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 12.5, color: "#555" }}>
            Belum punya format Excel? Unduh template sesuai mata kuliah terpilih.
          </div>
          <button
            type="button"
            className="fg-btn-sm"
            onClick={handleDownloadTemplate}
            disabled={!activeCourse}
          >
            📄 Download Template
          </button>
        </div>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const dropped = e.dataTransfer.files?.[0]
            if (dropped) handleFileChange(dropped)
          }}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: "1.5px dashed rgba(0,0,0,0.2)",
            borderRadius: 10,
            padding: "24px 16px",
            textAlign: "center",
            cursor: "pointer",
            background: "#fcfbf9",
            marginBottom: 14,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFileChange(f)
              e.target.value = ""
            }}
          />
          <div style={{ fontSize: 13.5, fontWeight: 500, color: "#111" }}>
            {parsing
              ? "Membaca file Excel..."
              : summary
                ? `File terpilih: ${summary.fileName}`
                : "Klik atau seret file .xlsx / .xls / .csv ke sini"}
          </div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
            Kolom: NRP, Nama Mahasiswa, Tugas UTS, UTS, Tugas UAS, UAS, Final Grade (Opsional)
          </div>
        </div>

        {summary && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12.5, color: "#444", marginBottom: 8 }}>
              Total baris: <strong>{summary.totalRows}</strong> · Valid:{" "}
              <strong style={{ color: "#1f6b45" }}>{summary.validCount}</strong> · Bermasalah:{" "}
              <strong style={{ color: "#b42318" }}>{summary.errorCount}</strong>
            </div>

            {summary.rows.length > 0 && (
              <div style={{ maxHeight: 220, overflowY: "auto", border: "0.5px solid rgba(0,0,0,0.08)", borderRadius: 8 }}>
                <table className="fg-table">
                  <thead>
                    <tr>
                      <th>Baris</th>
                      <th>NRP</th>
                      <th className="num">T. UTS</th>
                      <th className="num">UTS</th>
                      <th className="num">T. UAS</th>
                      <th className="num">UAS</th>
                      <th className="num">Final</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.rows.slice(0, 50).map((r) => (
                      <tr key={r.rowIndex}>
                        <td className="muted">{r.rowIndex}</td>
                        <td className="mono">{r.nrp || "—"}</td>
                        <td className="num">{r.mid_assignment_grade ?? "—"}</td>
                        <td className="num">{r.mid_exam_grade ?? "—"}</td>
                        <td className="num">{r.final_assignment_grade ?? "—"}</td>
                        <td className="num">{r.final_exam_grade ?? "—"}</td>
                        <td className="num">{r.final_grade ?? "Auto"}</td>
                        <td style={{ fontSize: 11.5, color: r.isValid ? "#1f6b45" : "#b42318" }}>
                          {r.isValid ? "Siap" : r.errors.join(", ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="fg-modal-footer">
          <button
            type="button"
            className="fg-btn-cancel"
            disabled={saving}
            onClick={onClose}
          >
            Batal
          </button>
          <button
            type="button"
            className="fg-btn-save"
            disabled={saving || !summary || summary.validCount === 0 || !selectedCourseId}
            onClick={handleSubmit}
          >
            {saving ? "Mengimpor..." : `Import ${summary?.validCount ?? 0} Data`}
          </button>
        </div>
      </div>
    </div>
  )
}
