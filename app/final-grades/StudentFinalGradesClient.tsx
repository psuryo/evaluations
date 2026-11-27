"use client"

import { useMemo, useState } from "react"

export interface StudentFinalGradeItem {
  id: number
  idkuliah: number
  matkul: string
  tahun: string
  midAssignmentGrade: number | null
  midExamGrade: number | null
  sts: number
  finalAssignmentGrade: number | null
  finalExamGrade: number | null
  sas: number
  finalGrade: number
  weights: {
    midAssignment: number
    midExam: number
    finalAssignment: number
    finalExam: number
  }
}

function formatScore(val: number | null): string {
  if (val === null || Number.isNaN(val)) return "—"
  return val.toFixed(2)
}

export default function StudentFinalGradesClient({
  grades,
}: {
  grades: StudentFinalGradeItem[]
}) {
  const tahunOptions = useMemo(() => {
    const set = new Set<string>()
    for (const g of grades) {
      if (g.tahun) set.add(g.tahun)
    }
    return Array.from(set).sort((a, b) =>
      b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" })
    )
  }, [grades])

  const [selectedTahun, setSelectedTahun] = useState<string>("ALL")
  const [selectedCourseId, setSelectedCourseId] = useState<string>("ALL")

  const courseOptions = useMemo(() => {
    return grades.filter(
      (g) => selectedTahun === "ALL" || g.tahun === selectedTahun
    )
  }, [grades, selectedTahun])

  const handleTahunChange = (tahun: string) => {
    setSelectedTahun(tahun)
    setSelectedCourseId("ALL")
  }

  const filteredGrades = useMemo(() => {
    return courseOptions.filter(
      (g) =>
        selectedCourseId === "ALL" || String(g.idkuliah) === selectedCourseId
    )
  }, [courseOptions, selectedCourseId])

  const stats = useMemo(() => {
    if (filteredGrades.length === 0) {
      return { count: 0, avg: 0, max: 0 }
    }
    const vals = filteredGrades.map((g) => g.finalGrade)
    const sum = vals.reduce((acc, v) => acc + v, 0)
    return {
      count: vals.length,
      avg: sum / vals.length,
      max: Math.max(...vals),
    }
  }, [filteredGrades])

  return (
    <div className="sfg-content">
      <div className="sfg-filters">
        <div className="sfg-filter-group">
          <label htmlFor="sfg-tahun" className="sfg-filter-label">
            Tahun
          </label>
          <select
            id="sfg-tahun"
            className="sfg-select"
            value={selectedTahun}
            onChange={(e) => handleTahunChange(e.target.value)}
          >
            <option value="ALL">Semua Tahun ({tahunOptions.length})</option>
            {tahunOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="sfg-filter-group sfg-filter-course">
          <label htmlFor="sfg-matkul" className="sfg-filter-label">
            Mata Kuliah
          </label>
          <select
            id="sfg-matkul"
            className="sfg-select"
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
          >
            <option value="ALL">
              Semua Mata Kuliah ({courseOptions.length})
            </option>
            {courseOptions.map((c) => (
              <option key={c.idkuliah} value={String(c.idkuliah)}>
                {c.matkul} ({c.tahun})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="sfg-stat-grid">
        <div className="sfg-stat-card">
          <p className="sfg-stat-label">Mata Kuliah</p>
          <p className="sfg-stat-val">{stats.count}</p>
          <p className="sfg-stat-sub">memiliki final grade</p>
        </div>
        <div className="sfg-stat-card">
          <p className="sfg-stat-label">Rata-rata Final</p>
          <p className="sfg-stat-val sfg-val-green">
            {stats.count > 0 ? stats.avg.toFixed(2) : "—"}
          </p>
          <p className="sfg-stat-sub">rata-rata nilai akhir</p>
        </div>
        <div className="sfg-stat-card">
          <p className="sfg-stat-label">Nilai Tertinggi</p>
          <p className="sfg-stat-val">
            {stats.count > 0 ? stats.max.toFixed(2) : "—"}
          </p>
          <p className="sfg-stat-sub">final grade maksimum</p>
        </div>
      </div>

      {filteredGrades.length === 0 ? (
        <div className="sfg-empty">
          Belum ada data final grade yang dipublikasikan untuk filter yang
          dipilih.
        </div>
      ) : (
        <div className="sfg-table-card">
          <div className="sfg-table-wrap">
            <table className="sfg-table">
              <thead>
                <tr>
                  <th>Tahun</th>
                  <th>Mata Kuliah</th>
                  <th className="num">Tugas UTS</th>
                  <th className="num">UTS</th>
                  <th className="num">STS</th>
                  <th className="num">Tugas UAS</th>
                  <th className="num">UAS</th>
                  <th className="num">SAS</th>
                  <th className="num">Final Grade</th>
                </tr>
              </thead>
              <tbody>
                {filteredGrades.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <span className="sfg-tahun-pill">{g.tahun}</span>
                    </td>
                    <td>
                      <div className="sfg-course-name">{g.matkul}</div>
                      <div className="sfg-course-weights">
                        Bobot: {g.weights.midAssignment}% / {g.weights.midExam}%
                        {" · "}
                        {g.weights.finalAssignment}% / {g.weights.finalExam}%
                      </div>
                    </td>
                    <td className="num">
                      {formatScore(g.midAssignmentGrade)}
                    </td>
                    <td className="num">{formatScore(g.midExamGrade)}</td>
                    <td className="num sub">{g.sts.toFixed(2)}</td>
                    <td className="num">
                      {formatScore(g.finalAssignmentGrade)}
                    </td>
                    <td className="num">{formatScore(g.finalExamGrade)}</td>
                    <td className="num sub">{g.sas.toFixed(2)}</td>
                    <td className="num final">{g.finalGrade.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
