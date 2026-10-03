"use client"

import { useState } from "react"

export interface CriterionGrade {
  idnilai?: number
  judulkriteria: string
  kriteria: string
  bobot: number | null
  grade: number | null
}

export interface StudentGrade {
  nrp: string
  nama: string
  criteria: CriterionGrade[]
  finalGrade: number | null
}

export interface SubjectGrade {
  idkuliah: number
  matkul: string
  tahun: string
  students: StudentGrade[]
}

interface CollapsibleGradeListProps {
  subjects: SubjectGrade[]
  isAdminView?: boolean
}

export default function CollapsibleGradeList({
  subjects,
  isAdminView = false,
}: CollapsibleGradeListProps) {
  // All courses collapsed by default so students can see the overview of all courses first
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  const toggleCourse = (idkuliah: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(idkuliah)) {
        next.delete(idkuliah)
      } else {
        next.add(idkuliah)
      }
      return next
    })
  }

  const expandAll = () => {
    setExpandedIds(new Set(subjects.map((s) => s.idkuliah)))
  }

  const collapseAll = () => {
    setExpandedIds(new Set())
  }

  const allExpanded = subjects.length > 0 && expandedIds.size === subjects.length

  if (subjects.length === 0) {
    return <div className="gr-empty">No grades recorded yet.</div>
  }

  return (
    <div className="gr-collapsible-wrapper">
      <div className="gr-list-toolbar">
        <p className="gr-section-label">
          {subjects.length} course{subjects.length !== 1 ? "s" : ""} available
        </p>
        {subjects.length > 1 && (
          <button
            type="button"
            className="gr-toggle-all-btn"
            onClick={allExpanded ? collapseAll : expandAll}
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>

      <div className="gr-subject-list">
        {subjects.map((subject) => {
          const isOpen = expandedIds.has(subject.idkuliah)
          const singleStudent = subject.students.length === 1 ? subject.students[0] : null

          return (
            <div
              key={subject.idkuliah}
              className={`gr-subject-card ${isOpen ? "gr-card-open" : ""}`}
            >
              <button
                type="button"
                className={`gr-subject-header ${isOpen ? "is-open" : ""}`}
                onClick={() => toggleCourse(subject.idkuliah)}
                aria-expanded={isOpen}
              >
                <div className="gr-subject-info">
                  <div className="gr-subject-title-row">
                    <span className="gr-subject-name">{subject.matkul}</span>
                    <span className="gr-subject-year">{subject.tahun}</span>
                  </div>
                  <span className="gr-subject-meta">
                    {!isAdminView && singleStudent
                      ? `${singleStudent.criteria.length} criteria evaluated`
                      : `${subject.students.length} student${subject.students.length !== 1 ? "s" : ""}`}
                  </span>
                </div>

                <div className="gr-subject-header-right">
                  {!isAdminView && singleStudent && (
                    <div className="gr-header-grade-preview">
                      {singleStudent.finalGrade !== null ? (
                        <span className="gr-final-badge">
                          Final: {singleStudent.finalGrade.toFixed(2)}
                        </span>
                      ) : (
                        <span className="gr-final-na">Final: —</span>
                      )}
                    </div>
                  )}

                  {isAdminView && (
                    <span className="gr-subject-count">
                      {subject.students.length} student{subject.students.length !== 1 ? "s" : ""}
                    </span>
                  )}

                  <div className={`gr-chevron-wrapper ${isOpen ? "is-open" : ""}`}>
                    <svg
                      className="gr-chevron-svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </div>
                </div>
              </button>

              {isOpen && (
                <div className="gr-subject-content">
                  {subject.students.length === 0 ? (
                    <div className="gr-student-empty">No student grades found for this course.</div>
                  ) : (
                    subject.students.map((student) => (
                      <div key={student.nrp} className="gr-student-block">
                        {(isAdminView || subject.students.length > 1) && (
                          <div className="gr-student-header">
                            <div className="gr-student-left">
                              <div className="gr-student-avatar">
                                {student.nama.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="gr-student-nama">{student.nama}</div>
                                <div className="gr-student-nrp">{student.nrp}</div>
                              </div>
                            </div>
                            {student.finalGrade !== null ? (
                              <span className="gr-final-badge">
                                Final: {student.finalGrade.toFixed(2)}
                              </span>
                            ) : (
                              <span className="gr-final-na">—</span>
                            )}
                          </div>
                        )}

                        {student.criteria.length === 0 ? (
                          <div className="gr-criteria-empty">No criteria grades recorded.</div>
                        ) : (
                          <table className="gr-criteria-table">
                            <thead>
                              <tr>
                                <th style={{ width: "36px", textAlign: "center" }}>#</th>
                                <th>Judul Kriteria</th>
                                <th>Kriteria</th>
                                <th>Bobot</th>
                                <th>Grade</th>
                              </tr>
                            </thead>
                            <tbody>
                              {student.criteria.map((c, i) => {
                                const g = c.grade
                                const pillClass =
                                  g === null
                                    ? "gr-grade-pill"
                                    : g >= 80
                                    ? "gr-grade-pill gr-grade-high"
                                    : g >= 60
                                    ? "gr-grade-pill gr-grade-mid"
                                    : "gr-grade-pill gr-grade-low"

                                return (
                                  <tr key={c.idnilai ?? i}>
                                    <td className="gr-td-num">{i + 1}</td>
                                    <td className="gr-td-judul">{c.judulkriteria}</td>
                                    <td className="gr-td-kriteria">{c.kriteria}</td>
                                    <td>
                                      <span className="gr-bobot">
                                        {c.bobot !== null ? c.bobot : "—"}
                                      </span>
                                    </td>
                                    <td>
                                      <span className={pillClass}>
                                        {g !== null ? g.toFixed(2) : "—"}
                                      </span>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
