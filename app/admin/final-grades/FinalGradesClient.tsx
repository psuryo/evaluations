"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

export interface FinalGradeRow {
  id: number
  nrp: string
  nama: string
  email: string
  midAssignmentGrade: number | null
  midExamGrade: number | null
  sts: number
  finalAssignmentGrade: number | null
  finalExamGrade: number | null
  sas: number
  finalGrade: number
  storedFinalGrade: number | null
  updatedAt: string
}

export interface CourseFinalGradesGroup {
  idkuliah: number
  matkul: string
  tahun: string
  isPublished: boolean
  weights: {
    midAssignment: number
    midExam: number
    finalAssignment: number
    finalExam: number
  }
  students: FinalGradeRow[]
}

export interface CourseOption {
  idkuliah: number
  matkul: string
  tahun: string
}

export interface StudentOption {
  nrp: string
  nama: string
}

type SortKey = "nrp" | "nama" | "finalGrade"
type SortDir = "asc" | "desc"

interface GradeFormState {
  mode: "create" | "edit"
  id?: number
  idkuliah: string
  nrp: string
  studentName?: string
  courseLabel?: string
  midAssignmentGrade: string
  midExamGrade: string
  finalAssignmentGrade: string
  finalExamGrade: string
  finalGrade: string
}

function formatScore(val: number | null): string {
  if (val === null || Number.isNaN(val)) return "—"
  return val.toFixed(2)
}

function toInputValue(val: number | null): string {
  return val === null ? "" : String(val)
}

export default function FinalGradesClient({
  courses,
  allCourses,
  allStudents,
}: {
  courses: CourseFinalGradesGroup[]
  allCourses: CourseOption[]
  allStudents: StudentOption[]
}) {
  const router = useRouter()

  const tahunOptions = useMemo(() => {
    const set = new Set<string>()
    for (const c of courses) {
      if (c.tahun) set.add(c.tahun)
    }
    return Array.from(set).sort((a, b) =>
      b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" })
    )
  }, [courses])

  const [selectedTahun, setSelectedTahun] = useState<string>("ALL")
  const [selectedCourseId, setSelectedCourseId] = useState<string>("ALL")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [sortKey, setSortKey] = useState<SortKey>("nrp")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const [formState, setFormState] = useState<GradeFormState | null>(null)
  const [formError, setFormError] = useState<string>("")
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const courseOptions = useMemo(() => {
    return courses.filter(
      (c) => selectedTahun === "ALL" || c.tahun === selectedTahun
    )
  }, [courses, selectedTahun])

  const handleTahunChange = (tahun: string) => {
    setSelectedTahun(tahun)
    setSelectedCourseId("ALL")
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir(key === "finalGrade" ? "desc" : "asc")
    }
  }

  const filteredCourses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return courseOptions
      .filter(
        (c) =>
          selectedCourseId === "ALL" ||
          String(c.idkuliah) === selectedCourseId
      )
      .map((c) => {
        const matchingStudents = c.students.filter((s) => {
          if (!query) return true
          return (
            s.nrp.toLowerCase().includes(query) ||
            s.nama.toLowerCase().includes(query)
          )
        })

        const sortedStudents = [...matchingStudents].sort((a, b) => {
          let cmp = 0
          if (sortKey === "nrp") {
            cmp = a.nrp.localeCompare(b.nrp, undefined, { numeric: true })
          } else if (sortKey === "nama") {
            cmp = a.nama.localeCompare(b.nama, undefined, {
              sensitivity: "base",
            })
          } else {
            cmp = a.finalGrade - b.finalGrade
          }
          return sortDir === "asc" ? cmp : -cmp
        })

        return {
          ...c,
          students: sortedStudents,
        }
      })
      .filter((c) => c.students.length > 0 || selectedCourseId !== "ALL")
  }, [courseOptions, selectedCourseId, searchQuery, sortKey, sortDir])

  const stats = useMemo(() => {
    const allGrades: number[] = []
    for (const c of filteredCourses) {
      for (const s of c.students) {
        allGrades.push(s.finalGrade)
      }
    }
    if (allGrades.length === 0) {
      return { count: 0, avg: 0, max: 0, min: 0 }
    }
    const sum = allGrades.reduce((acc, g) => acc + g, 0)
    return {
      count: allGrades.length,
      avg: sum / allGrades.length,
      max: Math.max(...allGrades),
      min: Math.min(...allGrades),
    }
  }, [filteredCourses])

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return ""
    return sortDir === "asc" ? " ↑" : " ↓"
  }

  const openCreateModal = () => {
    setFormError("")
    const defaultCourseId =
      selectedCourseId !== "ALL"
        ? selectedCourseId
        : allCourses[0]
          ? String(allCourses[0].idkuliah)
          : ""
    const defaultNrp = allStudents[0]?.nrp ?? ""

    setFormState({
      mode: "create",
      idkuliah: defaultCourseId,
      nrp: defaultNrp,
      midAssignmentGrade: "",
      midExamGrade: "",
      finalAssignmentGrade: "",
      finalExamGrade: "",
      finalGrade: "",
    })
  }

  const openEditModal = (course: CourseFinalGradesGroup, row: FinalGradeRow) => {
    setFormError("")
    setFormState({
      mode: "edit",
      id: row.id,
      idkuliah: String(course.idkuliah),
      nrp: row.nrp,
      studentName: `${row.nrp} — ${row.nama}`,
      courseLabel: `${course.matkul} (${course.tahun})`,
      midAssignmentGrade: toInputValue(row.midAssignmentGrade),
      midExamGrade: toInputValue(row.midExamGrade),
      finalAssignmentGrade: toInputValue(row.finalAssignmentGrade),
      finalExamGrade: toInputValue(row.finalExamGrade),
      finalGrade: toInputValue(row.storedFinalGrade),
    })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formState) return

    setFormError("")
    setIsSaving(true)

    try {
      const payload = {
        nrp: formState.nrp,
        idkuliah: Number(formState.idkuliah),
        mid_assignment_grade:
          formState.midAssignmentGrade === ""
            ? null
            : Number(formState.midAssignmentGrade),
        mid_exam_grade:
          formState.midExamGrade === "" ? null : Number(formState.midExamGrade),
        final_assignment_grade:
          formState.finalAssignmentGrade === ""
            ? null
            : Number(formState.finalAssignmentGrade),
        final_exam_grade:
          formState.finalExamGrade === ""
            ? null
            : Number(formState.finalExamGrade),
        final_grade:
          formState.finalGrade === "" ? null : Number(formState.finalGrade),
      }

      const url =
        formState.mode === "create"
          ? "/api/admin/final-grades"
          : `/api/admin/final-grades/${formState.id}`
      const method = formState.mode === "create" ? "POST" : "PATCH"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()

      if (!res.ok) {
        setFormError(json.error ?? "Gagal menyimpan data")
        setIsSaving(false)
        return
      }

      setFormState(null)
      setIsSaving(false)
      router.refresh()
    } catch {
      setFormError("Terjadi kesalahan jaringan")
      setIsSaving(false)
    }
  }

  const handleDelete = async (row: FinalGradeRow, matkul: string) => {
    const confirmed = window.confirm(
      `Hapus data final grade untuk ${row.nama} (${row.nrp}) pada mata kuliah ${matkul}?`
    )
    if (!confirmed) return

    setDeletingId(row.id)
    try {
      const res = await fetch(`/api/admin/final-grades/${row.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const json = await res.json()
        alert(json.error ?? "Gagal menghapus data")
      } else {
        router.refresh()
      }
    } catch {
      alert("Terjadi kesalahan jaringan")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="fg-content">
      {/* Filter Bar */}
      <div className="fg-filters">
        <div className="fg-filter-group">
          <label htmlFor="fg-tahun" className="fg-filter-label">
            Tahun
          </label>
          <select
            id="fg-tahun"
            className="fg-select"
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

        <div className="fg-filter-group fg-filter-course">
          <label htmlFor="fg-matkul" className="fg-filter-label">
            Mata Kuliah
          </label>
          <select
            id="fg-matkul"
            className="fg-select"
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
          >
            <option value="ALL">
              Semua Mata Kuliah ({courseOptions.length})
            </option>
            {courseOptions.map((c) => (
              <option key={c.idkuliah} value={String(c.idkuliah)}>
                {c.matkul} ({c.tahun}) — {c.students.length} mhs
              </option>
            ))}
          </select>
        </div>

        <div className="fg-filter-group fg-filter-search">
          <label htmlFor="fg-search" className="fg-filter-label">
            Cari Mahasiswa
          </label>
          <input
            id="fg-search"
            type="text"
            className="fg-input"
            placeholder="Cari NRP atau nama..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="fg-btn-add"
          onClick={openCreateModal}
          disabled={allCourses.length === 0 || allStudents.length === 0}
        >
          + Tambah Nilai
        </button>
      </div>

      {/* Summary Stats */}
      <div className="fg-stat-grid">
        <div className="fg-stat-card">
          <p className="fg-stat-label">Total Nilai</p>
          <p className="fg-stat-val">{stats.count}</p>
          <p className="fg-stat-sub">
            dari {filteredCourses.length} mata kuliah
          </p>
        </div>
        <div className="fg-stat-card">
          <p className="fg-stat-label">Rata-rata Final</p>
          <p className="fg-stat-val fg-val-green">
            {stats.count > 0 ? stats.avg.toFixed(2) : "—"}
          </p>
          <p className="fg-stat-sub">nilai akhir terfilter</p>
        </div>
        <div className="fg-stat-card">
          <p className="fg-stat-label">Nilai Tertinggi</p>
          <p className="fg-stat-val">
            {stats.count > 0 ? stats.max.toFixed(2) : "—"}
          </p>
          <p className="fg-stat-sub">final grade maksimum</p>
        </div>
        <div className="fg-stat-card">
          <p className="fg-stat-label">Nilai Terendah</p>
          <p className="fg-stat-val">
            {stats.count > 0 ? stats.min.toFixed(2) : "—"}
          </p>
          <p className="fg-stat-sub">final grade minimum</p>
        </div>
      </div>

      {/* Course Tables */}
      {filteredCourses.length === 0 ? (
        <div className="fg-empty">
          Tidak ada data pada <code>student_final_grades</code> yang sesuai
          dengan filter mata kuliah dan tahun.
        </div>
      ) : (
        <div className="fg-course-list">
          {filteredCourses.map((course) => (
            <section key={course.idkuliah} className="fg-course-card">
              <div className="fg-course-header">
                <div>
                  <div className="fg-course-title-row">
                    <h2 className="fg-course-title">{course.matkul}</h2>
                    <span className="fg-tahun-pill">{course.tahun}</span>
                    <span
                      className={`fg-status-pill ${
                        course.isPublished ? "published" : "draft"
                      }`}
                    >
                      {course.isPublished ? "Published" : "Draft"}
                    </span>
                  </div>
                  <p className="fg-course-weights">
                    Bobot: Tugas UTS {course.weights.midAssignment}% · UTS{" "}
                    {course.weights.midExam}% · Tugas UAS{" "}
                    {course.weights.finalAssignment}% · UAS{" "}
                    {course.weights.finalExam}%
                  </p>
                </div>
                <span className="fg-student-count">
                  {course.students.length} mahasiswa
                </span>
              </div>

              {course.students.length === 0 ? (
                <div className="fg-course-empty">
                  Belum ada data final grade untuk mata kuliah ini.
                </div>
              ) : (
                <div className="fg-table-wrap">
                  <table className="fg-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th
                          className="fg-sortable"
                          onClick={() => handleSort("nrp")}
                        >
                          NRP{sortIndicator("nrp")}
                        </th>
                        <th
                          className="fg-sortable"
                          onClick={() => handleSort("nama")}
                        >
                          Nama{sortIndicator("nama")}
                        </th>
                        <th className="num">Tugas UTS</th>
                        <th className="num">UTS</th>
                        <th className="num">STS</th>
                        <th className="num">Tugas UAS</th>
                        <th className="num">UAS</th>
                        <th className="num">SAS</th>
                        <th
                          className="num fg-sortable"
                          onClick={() => handleSort("finalGrade")}
                        >
                          Final Grade{sortIndicator("finalGrade")}
                        </th>
                        <th className="num">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {course.students.map((row, idx) => (
                        <tr key={row.id}>
                          <td className="muted">{idx + 1}</td>
                          <td className="mono">{row.nrp}</td>
                          <td className="name">{row.nama}</td>
                          <td className="num">
                            {formatScore(row.midAssignmentGrade)}
                          </td>
                          <td className="num">
                            {formatScore(row.midExamGrade)}
                          </td>
                          <td className="num sub">{row.sts.toFixed(2)}</td>
                          <td className="num">
                            {formatScore(row.finalAssignmentGrade)}
                          </td>
                          <td className="num">
                            {formatScore(row.finalExamGrade)}
                          </td>
                          <td className="num sub">{row.sas.toFixed(2)}</td>
                          <td className="num final">
                            {row.finalGrade.toFixed(2)}
                          </td>
                          <td className="num">
                            <div className="fg-actions">
                              <button
                                type="button"
                                className="fg-btn-sm"
                                onClick={() => openEditModal(course, row)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="fg-btn-sm danger"
                                disabled={deletingId === row.id}
                                onClick={() => handleDelete(row, course.matkul)}
                              >
                                {deletingId === row.id ? "..." : "Hapus"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {formState && (
        <div
          className="fg-modal-backdrop"
          onClick={() => !isSaving && setFormState(null)}
        >
          <div className="fg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fg-modal-header">
              <h3 className="fg-modal-title">
                {formState.mode === "create"
                  ? "Tambah Final Grade"
                  : "Edit Final Grade"}
              </h3>
              <button
                type="button"
                className="fg-modal-close"
                onClick={() => !isSaving && setFormState(null)}
              >
                ×
              </button>
            </div>

            {formError && <div className="fg-form-error">{formError}</div>}

            <form onSubmit={handleSave}>
              <div className="fg-form-grid">
                {formState.mode === "create" ? (
                  <>
                    <div className="fg-form-field fg-form-full">
                      <label className="fg-filter-label">Mata Kuliah</label>
                      <select
                        className="fg-select"
                        value={formState.idkuliah}
                        onChange={(e) =>
                          setFormState({ ...formState, idkuliah: e.target.value })
                        }
                        required
                      >
                        {allCourses.map((c) => (
                          <option key={c.idkuliah} value={String(c.idkuliah)}>
                            {c.matkul} ({c.tahun})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="fg-form-field fg-form-full">
                      <label className="fg-filter-label">Mahasiswa</label>
                      <select
                        className="fg-select"
                        value={formState.nrp}
                        onChange={(e) =>
                          setFormState({ ...formState, nrp: e.target.value })
                        }
                        required
                      >
                        {allStudents.map((s) => (
                          <option key={s.nrp} value={s.nrp}>
                            {s.nrp} — {s.nama}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <div className="fg-form-field fg-form-full">
                    <label className="fg-filter-label">Mahasiswa &amp; Kuliah</label>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#333",
                        background: "#faf9f6",
                        padding: "9px 12px",
                        borderRadius: 8,
                        border: "0.5px solid rgba(0,0,0,0.08)",
                      }}
                    >
                      <div>
                        <strong>{formState.studentName}</strong>
                      </div>
                      <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>
                        {formState.courseLabel}
                      </div>
                    </div>
                  </div>
                )}

                <div className="fg-form-field">
                  <label className="fg-filter-label">Tugas UTS</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    className="fg-input"
                    placeholder="0 – 100"
                    value={formState.midAssignmentGrade}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        midAssignmentGrade: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="fg-form-field">
                  <label className="fg-filter-label">UTS</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    className="fg-input"
                    placeholder="0 – 100"
                    value={formState.midExamGrade}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        midExamGrade: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="fg-form-field">
                  <label className="fg-filter-label">Tugas UAS</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    className="fg-input"
                    placeholder="0 – 100"
                    value={formState.finalAssignmentGrade}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        finalAssignmentGrade: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="fg-form-field">
                  <label className="fg-filter-label">UAS</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    className="fg-input"
                    placeholder="0 – 100"
                    value={formState.finalExamGrade}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        finalExamGrade: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="fg-form-field fg-form-full">
                  <label className="fg-filter-label">
                    Final Grade (opsional, kosongkan untuk hitung otomatis)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    className="fg-input"
                    placeholder="Kosongkan untuk hitung otomatis dari bobot"
                    value={formState.finalGrade}
                    onChange={(e) =>
                      setFormState({ ...formState, finalGrade: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="fg-modal-footer">
                <button
                  type="button"
                  className="fg-btn-cancel"
                  disabled={isSaving}
                  onClick={() => setFormState(null)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="fg-btn-save"
                  disabled={isSaving}
                >
                  {isSaving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
