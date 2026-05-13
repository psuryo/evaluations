'use client'

import { useState } from 'react'
import Link from 'next/link'
import ImpersonateButton from './ImpersonateButton'

interface Student {
  nrp: string
  nama: string
  email: string
  submitted: boolean
  inGroup: boolean
}

interface CourseCardProps {
  idkuliah: number
  matkul: string
  tahun: string
  total: number
  submitted: number
  allMembers: Student[]
}

export default function CourseCardCollapsible({
  idkuliah,
  matkul,
  tahun,
  total,
  submitted,
  allMembers,
}: CourseCardProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const pct = total > 0 ? Math.round((submitted / total) * 100) : 100
  const pendingCount = allMembers.filter((s) => s.inGroup && !s.submitted).length
  const allDone = pendingCount === 0

  return (
    <div className="course-card">
      <div
        className="course-header"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer' }}
      >
        <div className="course-info">
          <span className="course-name">{matkul}</span>
          <span className="course-year">{tahun}</span>
        </div>
        <div className="course-stats">
          <div className="progress-wrap">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="progress-text">
              {submitted}/{total}
            </span>
          </div>
          {allDone ? (
            <span className="badge badge-ok">
              <span className="badge-dot" />
              All done
            </span>
          ) : (
            <span className="badge badge-pending">
              <span className="badge-dot" />
              {pendingCount} pending
            </span>
          )}
          <span
            className="collapse-indicator"
            style={{
              transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 0.2s ease',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '20px',
              height: '20px',
              flexShrink: 0,
            }}
          >
            ▼
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="student-list">
          {allMembers.map((student) => (
            <div key={student.nrp} className="student-row">
              <div className="student-left">
                <div className="student-avatar">
                  {(student.nama || student.nrp).charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="student-nama">{student.nama || student.nrp}</p>
                  <p className="student-email">{student.email}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="student-nrp">{student.nrp}</span>
                {student.inGroup && (
                  <>
                    {student.submitted ? (
                      <span
                        className="badge badge-ok"
                        style={{ fontSize: 10, padding: '2px 8px' }}
                      >
                        <span className="badge-dot" />
                        Submitted
                      </span>
                    ) : (
                      <span
                        className="badge badge-pending"
                        style={{ fontSize: 10, padding: '2px 8px' }}
                      >
                        <span className="badge-dot" />
                        Pending
                      </span>
                    )}
                  </>
                )}
                <ImpersonateButton email={student.email} nama={student.nama} />
                <Link
                  href={`/dashboard?viewAs=${student.nrp}`}
                  style={{
                    fontSize: 11,
                    color: '#888',
                    border: '0.5px solid rgba(0,0,0,0.12)',
                    borderRadius: 5,
                    padding: '3px 8px',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  View dashboard
                </Link>
                <Link
                  href={`/grade?viewAs=${student.nrp}`}
                  style={{
                    fontSize: 11,
                    color: '#888',
                    border: '0.5px solid rgba(0,0,0,0.12)',
                    borderRadius: 5,
                    padding: '3px 8px',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  View grades
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
