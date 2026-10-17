"use client"

import { useState, useMemo } from "react"

export interface Criteria {
  judulkriteria: string
  kriteria: string
  bobot: number
}

export interface StudentGradeItem {
  idnilai: number
  grade: number | null
  bobot: number
  kriteria?: string | null
}

export interface StudentRow {
  nrp: string
  nama: string
  email: string
  grades: Record<string, StudentGradeItem>
}

interface CourseGradeAnalysisProps {
  idkuliah: number
  matkul: string
  tahun?: string
  criteriaList: Criteria[]
  students: StudentRow[]
  gradesMap: Record<number, string | number>
  commentsMap?: Record<number, string>
  onSelectStudent: (studentIndex: number) => void
  onSwitchToTable: () => void
}

export interface CriteriaStat {
  judulkriteria: string
  kriteria: string
  bobot: number
  gradedCount: number
  totalScore: number
  avgScore: number
  avgPercent: number
  minScore: number | null
  maxScore: number | null
  zeroCount: number
  belowHalfCount: number
  highScoreCount: number
  perfectCount: number
  strugglingStudents: Array<{
    nrp: string
    nama: string
    score: number
    percent: number
    originalIndex: number
  }>
}

export function getGradeLetter(score: number | null): {
  letter: string
  status: string
  badgeClass: string
  color: string
  bg: string
  border: string
} {
  if (score === null) {
    return {
      letter: "—",
      status: "Belum Lengkap",
      badgeClass: "cga-badge-none",
      color: "#888",
      bg: "#f4f3ef",
      border: "rgba(0,0,0,0.12)",
    }
  }
  if (score >= 85) {
    return {
      letter: "A",
      status: "Sangat Baik (Istimewa)",
      badgeClass: "cga-badge-a",
      color: "#14532d",
      bg: "#dcfce7",
      border: "#86efac",
    }
  }
  if (score >= 80) {
    return {
      letter: "AB",
      status: "Sangat Baik",
      badgeClass: "cga-badge-ab",
      color: "#166534",
      bg: "#f0fdf4",
      border: "#bbf7d0",
    }
  }
  if (score >= 75) {
    return {
      letter: "B+",
      status: "Lebih dari Baik",
      badgeClass: "cga-badge-bplus",
      color: "#1e40af",
      bg: "#dbeafe",
      border: "#93c5fd",
    }
  }
  if (score >= 70) {
    return {
      letter: "B",
      status: "Baik",
      badgeClass: "cga-badge-b",
      color: "#1d4ed8",
      bg: "#eff6ff",
      border: "#bfdbfe",
    }
  }
  if (score >= 65) {
    return {
      letter: "BC",
      status: "Cukup Baik",
      badgeClass: "cga-badge-bc",
      color: "#854d0e",
      bg: "#fef9c3",
      border: "#fde047",
    }
  }
  if (score >= 60) {
    return {
      letter: "C",
      status: "Cukup",
      badgeClass: "cga-badge-c",
      color: "#9a3412",
      bg: "#ffedd5",
      border: "#fdba74",
    }
  }
  if (score >= 40) {
    return {
      letter: "D",
      status: "Kurang (Perlu Perbaikan)",
      badgeClass: "cga-badge-d",
      color: "#b45309",
      bg: "#fffbeb",
      border: "#fde68a",
    }
  }
  return {
    letter: "E",
    status: "Gagal (Remedial)",
    badgeClass: "cga-badge-e",
    color: "#991b1b",
    bg: "#fee2e2",
    border: "#fca5a5",
  }
}

export default function CourseGradeAnalysis({
  matkul,
  tahun = "",
  criteriaList,
  students,
  gradesMap,
  onSelectStudent,
  onSwitchToTable,
}: CourseGradeAnalysisProps) {
  const [studentSortKey, setStudentSortKey] = useState<
    | "grade-desc"
    | "grade-asc"
    | "diff-crit-asc"
    | "diff-crit-desc"
    | "nama-asc"
    | "nama-desc"
    | "nrp-asc"
    | "nrp-desc"
  >("grade-desc")

  const [aspectSortKey, setAspectSortKey] = useState<
    "difficulty-asc" | "difficulty-desc" | "bobot-desc" | "default"
  >("difficulty-asc")

  const [studentFilter, setStudentFilter] = useState<
    "all" | "top" | "good" | "passing" | "remedial" | "incomplete"
  >("all")

  const [searchQuery, setSearchQuery] = useState("")
  const [expandedCriteria, setExpandedCriteria] = useState<string | null>(null)
  const [copyFeedback, setCopyFeedback] = useState(false)

  // 1. Calculate each student's final score and breakdown
  const studentAnalysisList = useMemo(() => {
    return students.map((st, originalIndex) => {
      let totalScore = 0
      let filledCount = 0
      const criteriaScores: Record<
        string,
        { score: number | null; bobot: number; percent: number | null }
      > = {}

      for (const crit of criteriaList) {
        const item = st.grades[crit.judulkriteria]
        if (!item) {
          criteriaScores[crit.judulkriteria] = { score: null, bobot: crit.bobot, percent: null }
          continue
        }
        const val = gradesMap[item.idnilai]
        if (val !== "" && val !== undefined && val !== null && !isNaN(Number(val))) {
          const num = Number(val)
          totalScore += num
          filledCount++
          criteriaScores[crit.judulkriteria] = {
            score: num,
            bobot: crit.bobot,
            percent: crit.bobot > 0 ? (num / crit.bobot) * 100 : 0,
          }
        } else {
          criteriaScores[crit.judulkriteria] = { score: null, bobot: crit.bobot, percent: null }
        }
      }

      const isFullyGraded = filledCount === criteriaList.length && criteriaList.length > 0
      const hasAnyGrade = filledCount > 0
      const finalScore = hasAnyGrade ? Math.round(totalScore * 100) / 100 : null
      const gradeMeta = getGradeLetter(finalScore)

      return {
        nrp: st.nrp,
        nama: st.nama,
        email: st.email,
        originalIndex,
        totalScore: finalScore,
        filledCount,
        isFullyGraded,
        hasAnyGrade,
        gradeMeta,
        criteriaScores,
      }
    })
  }, [students, criteriaList, gradesMap])

  // 2. Calculate aspect/criteria statistics & difficulty ranking
  const criteriaStats: CriteriaStat[] = useMemo(() => {
    return criteriaList.map((crit) => {
      let total = 0
      let count = 0
      let min: number | null = null
      let max: number | null = null
      let zeroCount = 0
      let belowHalfCount = 0
      let highScoreCount = 0
      let perfectCount = 0
      const strugglingList: CriteriaStat["strugglingStudents"] = []

      for (let i = 0; i < students.length; i++) {
        const st = students[i]
        const item = st.grades[crit.judulkriteria]
        if (!item) continue
        const val = gradesMap[item.idnilai]
        if (val !== "" && val !== undefined && val !== null && !isNaN(Number(val))) {
          const num = Number(val)
          total += num
          count++

          if (min === null || num < min) min = num
          if (max === null || num > max) max = num

          if (num === 0) zeroCount++
          if (num < crit.bobot * 0.5) {
            belowHalfCount++
          }
          if (num >= crit.bobot * 0.8) highScoreCount++
          if (num >= crit.bobot) perfectCount++

          const pct = crit.bobot > 0 ? (num / crit.bobot) * 100 : 0
          strugglingList.push({
            nrp: st.nrp,
            nama: st.nama,
            score: num,
            percent: Math.round(pct * 10) / 10,
            originalIndex: i,
          })
        }
      }

      // Sort struggling students: lowest score first
      strugglingList.sort((a, b) => a.score - b.score)

      const avgScore = count > 0 ? total / count : 0
      const avgPercent = crit.bobot > 0 ? (avgScore / crit.bobot) * 100 : 0

      return {
        judulkriteria: crit.judulkriteria,
        kriteria: crit.kriteria,
        bobot: crit.bobot,
        gradedCount: count,
        totalScore: total,
        avgScore: Math.round(avgScore * 100) / 100,
        avgPercent: Math.round(avgPercent * 10) / 10,
        minScore: min,
        maxScore: max,
        zeroCount,
        belowHalfCount,
        highScoreCount,
        perfectCount,
        strugglingStudents: strugglingList,
      }
    })
  }, [criteriaList, students, gradesMap])

  // Identify Most Difficult Aspect & Easiest Aspect (among criteria with at least 1 grade)
  const { mostDifficultCriteria, easiestCriteria } = useMemo(() => {
    const scoredCriteria = criteriaStats.filter((c) => c.gradedCount > 0)
    if (scoredCriteria.length === 0) {
      return {
        mostDifficultCriteria: criteriaStats[0] ?? null,
        easiestCriteria: criteriaStats[0] ?? null,
      }
    }

    // Sort by avgPercent ascending -> lowest % is most difficult
    const sorted = [...scoredCriteria].sort((a, b) => {
      if (a.avgPercent !== b.avgPercent) return a.avgPercent - b.avgPercent
      // tiebreaker: more students below half
      return b.belowHalfCount - a.belowHalfCount
    })

    return {
      mostDifficultCriteria: sorted[0],
      easiestCriteria: sorted[sorted.length - 1],
    }
  }, [criteriaStats])

  // 3. Class Summary Metrics
  const classSummary = useMemo(() => {
    const scoredStudents = studentAnalysisList.filter((s) => s.totalScore !== null)
    const fullyGraded = studentAnalysisList.filter((s) => s.isFullyGraded)

    if (scoredStudents.length === 0) {
      return {
        totalStudents: students.length,
        scoredStudentsCount: 0,
        fullyGradedCount: 0,
        classAverage: null,
        highestScore: null,
        highestStudent: null,
        lowestScore: null,
        lowestStudent: null,
        passingCount: 0,
        passingRate: 0,
        remedialCount: 0,
      }
    }

    const scores = scoredStudents.map((s) => s.totalScore!)
    const sum = scores.reduce((acc, curr) => acc + curr, 0)
    const avg = sum / scores.length

    let maxScore = -Infinity
    let minScore = Infinity
    let maxStudent = scoredStudents[0]
    let minStudent = scoredStudents[0]

    for (const s of scoredStudents) {
      if (s.totalScore! > maxScore) {
        maxScore = s.totalScore!
        maxStudent = s
      }
      if (s.totalScore! < minScore) {
        minScore = s.totalScore!
        minStudent = s
      }
    }

    const passing = scoredStudents.filter((s) => s.totalScore! >= 60).length
    const remedial = scoredStudents.filter((s) => s.totalScore! < 60).length

    return {
      totalStudents: students.length,
      scoredStudentsCount: scoredStudents.length,
      fullyGradedCount: fullyGraded.length,
      classAverage: Math.round(avg * 100) / 100,
      highestScore: maxScore === -Infinity ? null : maxScore,
      highestStudent: maxStudent,
      lowestScore: minScore === Infinity ? null : minScore,
      lowestStudent: minStudent,
      passingCount: passing,
      passingRate: Math.round((passing / scoredStudents.length) * 100),
      remedialCount: remedial,
    }
  }, [studentAnalysisList, students.length])

  // 4. Grade Letter Distribution Buckets
  const gradeDistribution = useMemo(() => {
    const counts = {
      A: 0, // >= 85
      AB: 0, // 80 - 84.99
      BPlus: 0, // 75 - 79.99
      B: 0, // 70 - 74.99
      BC: 0, // 65 - 69.99
      C: 0, // 60 - 64.99
      D: 0, // 40 - 59.99
      E: 0, // < 40
      incomplete: 0,
    }

    for (const s of studentAnalysisList) {
      if (s.totalScore === null) {
        counts.incomplete++
      } else if (s.totalScore >= 85) counts.A++
      else if (s.totalScore >= 80) counts.AB++
      else if (s.totalScore >= 75) counts.BPlus++
      else if (s.totalScore >= 70) counts.B++
      else if (s.totalScore >= 65) counts.BC++
      else if (s.totalScore >= 60) counts.C++
      else if (s.totalScore >= 40) counts.D++
      else counts.E++
    }

    return counts
  }, [studentAnalysisList])

  // 5. Sorted & Filtered Students
  const filteredAndSortedStudents = useMemo(() => {
    let result = [...studentAnalysisList]

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (s) => s.nrp.toLowerCase().includes(q) || s.nama.toLowerCase().includes(q)
      )
    }

    // Predikat / Status filter
    if (studentFilter === "top") {
      result = result.filter((s) => s.totalScore !== null && s.totalScore >= 80)
    } else if (studentFilter === "good") {
      result = result.filter(
        (s) => s.totalScore !== null && s.totalScore >= 70 && s.totalScore < 80
      )
    } else if (studentFilter === "passing") {
      result = result.filter(
        (s) => s.totalScore !== null && s.totalScore >= 60 && s.totalScore < 70
      )
    } else if (studentFilter === "remedial") {
      result = result.filter((s) => s.totalScore !== null && s.totalScore < 60)
    } else if (studentFilter === "incomplete") {
      result = result.filter((s) => !s.isFullyGraded)
    }

    // Sorting
    result.sort((a, b) => {
      if (studentSortKey === "grade-desc") {
        if (a.totalScore === null && b.totalScore === null) return 0
        if (a.totalScore === null) return 1
        if (b.totalScore === null) return -1
        return b.totalScore - a.totalScore
      }
      if (studentSortKey === "grade-asc") {
        if (a.totalScore === null && b.totalScore === null) return 0
        if (a.totalScore === null) return 1
        if (b.totalScore === null) return -1
        return a.totalScore - b.totalScore
      }
      if (studentSortKey === "diff-crit-asc" && mostDifficultCriteria) {
        const aVal = a.criteriaScores[mostDifficultCriteria.judulkriteria]?.score ?? -1
        const bVal = b.criteriaScores[mostDifficultCriteria.judulkriteria]?.score ?? -1
        return aVal - bVal
      }
      if (studentSortKey === "diff-crit-desc" && mostDifficultCriteria) {
        const aVal = a.criteriaScores[mostDifficultCriteria.judulkriteria]?.score ?? -1
        const bVal = b.criteriaScores[mostDifficultCriteria.judulkriteria]?.score ?? -1
        return bVal - aVal
      }
      if (studentSortKey === "nama-asc") {
        return a.nama.localeCompare(b.nama)
      }
      if (studentSortKey === "nama-desc") {
        return b.nama.localeCompare(a.nama)
      }
      if (studentSortKey === "nrp-asc") {
        return a.nrp.localeCompare(b.nrp, undefined, { numeric: true })
      }
      if (studentSortKey === "nrp-desc") {
        return b.nrp.localeCompare(a.nrp, undefined, { numeric: true })
      }
      return 0
    })

    return result
  }, [studentAnalysisList, searchQuery, studentFilter, studentSortKey, mostDifficultCriteria])

  // 6. Sorted Aspect List
  const sortedCriteriaStats = useMemo(() => {
    const list = [...criteriaStats]
    if (aspectSortKey === "difficulty-asc") {
      // Tersulit ke termudah (avgPercent ascending)
      list.sort((a, b) => a.avgPercent - b.avgPercent)
    } else if (aspectSortKey === "difficulty-desc") {
      // Termudah ke tersulit (avgPercent descending)
      list.sort((a, b) => b.avgPercent - a.avgPercent)
    } else if (aspectSortKey === "bobot-desc") {
      list.sort((a, b) => b.bobot - a.bobot)
    }
    return list
  }, [criteriaStats, aspectSortKey])

  // Export CSV Handler
  const handleExportCSV = () => {
    const headers = [
      "Peringkat",
      "NRP",
      "Nama Mahasiswa",
      "Email",
      "Nilai Akhir",
      "Huruf Mutu",
      "Status",
      ...criteriaList.map((c) => `"${c.judulkriteria} (Max ${c.bobot})"`),
    ]

    // Sort by grade desc for export
    const sortedForExport = [...studentAnalysisList].sort((a, b) => {
      if (a.totalScore === null && b.totalScore === null) return 0
      if (a.totalScore === null) return 1
      if (b.totalScore === null) return -1
      return b.totalScore - a.totalScore
    })

    const rows = sortedForExport.map((s, idx) => {
      const critScores = criteriaList.map((c) => {
        const item = s.criteriaScores[c.judulkriteria]
        return item && item.score !== null ? item.score : ""
      })

      return [
        s.totalScore !== null ? idx + 1 : "-",
        `"${s.nrp}"`,
        `"${s.nama.replace(/"/g, '""')}"`,
        `"${s.email}"`,
        s.totalScore !== null ? s.totalScore : "",
        `"${s.gradeMeta.letter}"`,
        `"${s.gradeMeta.status}"`,
        ...critScores,
      ].join(",")
    })

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `Analisis_Nilai_${matkul.replace(/\s+/g, "_")}_${tahun}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Copy Summary Handler
  const handleCopySummary = async () => {
    if (!classSummary.classAverage && classSummary.scoredStudentsCount === 0) return

    const difficultName = mostDifficultCriteria
      ? `${mostDifficultCriteria.judulkriteria} (${mostDifficultCriteria.avgPercent}% capaian, rata-rata ${mostDifficultCriteria.avgScore}/${mostDifficultCriteria.bobot} poin)`
      : "—"

    const easiestName = easiestCriteria
      ? `${easiestCriteria.judulkriteria} (${easiestCriteria.avgPercent}% capaian, rata-rata ${easiestCriteria.avgScore}/${easiestCriteria.bobot} poin)`
      : "—"

    const text = [
      `📊 RINGKASAN ANALISIS NILAI: ${matkul} (${tahun})`,
      `================================================`,
      `• Total Mahasiswa Terdaftar : ${classSummary.totalStudents}`,
      `• Mahasiswa Telah Dinilai   : ${classSummary.scoredStudentsCount} (${classSummary.fullyGradedCount} lengkap)`,
      `• Rata-rata Nilai Kelas     : ${classSummary.classAverage ?? "—"} / 100`,
      `• Nilai Tertinggi           : ${classSummary.highestScore ?? "—"} (${classSummary.highestStudent?.nama ?? ""})`,
      `• Nilai Terendah            : ${classSummary.lowestScore ?? "—"} (${classSummary.lowestStudent?.nama ?? ""})`,
      `• Tingkat Kelulusan (>=60)  : ${classSummary.passingRate}% (${classSummary.passingCount} lulus, ${classSummary.remedialCount} remedial)`,
      ``,
      `🎯 ASPEK PALING SULIT:`,
      `  ${difficultName}`,
      `  Komentar: ${mostDifficultCriteria?.belowHalfCount ?? 0} mahasiswa mendapat nilai di bawah 50% pada kriteria ini.`,
      ``,
      `⭐ ASPEK PALING DIKUASAI:`,
      `  ${easiestName}`,
    ].join("\n")

    try {
      await navigator.clipboard.writeText(text)
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 2500)
    } catch {
      // fallback
    }
  }

  return (
    <>
      <style>{`
        .cga-container { display: flex; flex-direction: column; gap: 24px; }

        /* Top Banner & Highlights */
        .cga-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 16px;
        }

        .cga-card {
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.08);
          border-radius: 12px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          position: relative;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        }

        .cga-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .cga-card-label {
          font-size: 11px;
          text-transform: uppercase;
          font-weight: 600;
          color: #777;
          letter-spacing: 0.05em;
        }

        .cga-card-icon {
          font-size: 18px;
        }

        .cga-card-val {
          font-size: 28px;
          font-weight: 700;
          color: #111;
          font-family: 'Sora', system-ui, sans-serif;
          line-height: 1.1;
        }

        .cga-card-sub {
          font-size: 12px;
          color: #666;
          line-height: 1.4;
        }

        /* Spotlight Difficult Aspect Card */
        .cga-card-difficult {
          background: linear-gradient(145deg, #fffcf9 0%, #fff7ed 100%);
          border: 1px solid #fed7aa;
          box-shadow: 0 4px 14px rgba(234, 88, 12, 0.06);
        }
        .cga-card-difficult .cga-card-label {
          color: #c2410c;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .cga-card-difficult .cga-card-val {
          color: #9a3412;
          font-size: 20px;
          line-height: 1.3;
        }

        /* Spotlight Mastered Aspect Card */
        .cga-card-easiest {
          background: linear-gradient(145deg, #fbfefc 0%, #f0fdf4 100%);
          border: 1px solid #bbf7d0;
          box-shadow: 0 4px 14px rgba(22, 163, 74, 0.05);
        }
        .cga-card-easiest .cga-card-label {
          color: #15803d;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .cga-card-easiest .cga-card-val {
          color: #166534;
          font-size: 20px;
          line-height: 1.3;
        }

        /* Section Headings */
        .cga-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }
        .cga-section-title {
          font-size: 18px;
          font-weight: 600;
          color: #111;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .cga-section-desc {
          font-size: 13px;
          color: #777;
          margin-top: 2px;
        }

        /* Aspect Difficulty Ranking List */
        .cga-aspect-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .cga-aspect-item {
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.08);
          border-radius: 12px;
          padding: 18px 20px;
          transition: all 0.15s ease;
        }
        .cga-aspect-item:hover {
          border-color: rgba(0,0,0,0.2);
          box-shadow: 0 3px 10px rgba(0,0,0,0.04);
        }
        .cga-aspect-item.is-hardest {
          border-color: #fb923c;
          background: #fffbf7;
        }

        .cga-aspect-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
        }

        .cga-aspect-title-group {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .cga-rank-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 6px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .cga-rank-badge.hardest {
          background: #fee2e2;
          color: #991b1b;
          border: 0.5px solid #fca5a5;
        }
        .cga-rank-badge.hard {
          background: #ffedd5;
          color: #c2410c;
          border: 0.5px solid #fdba74;
        }
        .cga-rank-badge.medium {
          background: #fef9c3;
          color: #854d0e;
          border: 0.5px solid #fde047;
        }
        .cga-rank-badge.easy {
          background: #dcfce7;
          color: #166534;
          border: 0.5px solid #86efac;
        }

        .cga-aspect-name {
          font-size: 16px;
          font-weight: 600;
          color: #111;
        }

        .cga-aspect-max-pill {
          font-size: 12px;
          color: #555;
          background: #f4f3ef;
          padding: 2px 8px;
          border-radius: 5px;
          font-weight: 500;
        }

        .cga-aspect-stats-right {
          text-align: right;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }

        .cga-aspect-pct-val {
          font-size: 20px;
          font-weight: 700;
          font-family: monospace;
        }

        /* Progress Bar for aspect success rate */
        .cga-progress-bg {
          width: 100%;
          height: 10px;
          background: #f0eee8;
          border-radius: 999px;
          overflow: hidden;
          margin: 12px 0 10px;
          position: relative;
        }
        .cga-progress-fill {
          height: 100%;
          border-radius: 999px;
          transition: width 0.4s ease;
        }

        .cga-aspect-meta-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: #666;
          flex-wrap: wrap;
          gap: 10px;
        }

        .cga-struggle-toggle {
          background: none;
          border: none;
          color: #c2410c;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 2px 0;
        }
        .cga-struggle-toggle:hover { text-decoration: underline; }

        .cga-struggling-drawer {
          margin-top: 14px;
          padding-top: 14px;
          border-top: 0.5px dashed rgba(0,0,0,0.12);
          background: #faf8f5;
          padding: 12px 16px;
          border-radius: 8px;
        }

        .cga-drawer-title {
          font-size: 12px;
          font-weight: 600;
          color: #333;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .cga-struggling-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .cga-student-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.15);
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.12s;
        }
        .cga-student-chip:hover {
          background: #111;
          color: #fff;
          border-color: #111;
        }
        .cga-student-chip .chip-score {
          font-weight: 700;
          color: #c2410c;
          font-family: monospace;
        }
        .cga-student-chip:hover .chip-score { color: #fff; }

        /* Distribution Histogram Bar */
        .cga-dist-card {
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.08);
          border-radius: 12px;
          padding: 20px;
        }

        .cga-dist-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(105px, 1fr));
          gap: 10px;
          margin-top: 14px;
        }

        .cga-dist-col {
          background: #fafaf8;
          border: 0.5px solid rgba(0,0,0,0.06);
          border-radius: 8px;
          padding: 12px 8px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .cga-dist-col:hover {
          background: #f2f0ea;
          border-color: rgba(0,0,0,0.15);
          transform: translateY(-2px);
        }
        .cga-dist-col.active {
          background: #111;
          color: #fff;
          border-color: #111;
        }
        .cga-dist-col.active .cga-dist-letter,
        .cga-dist-col.active .cga-dist-count,
        .cga-dist-col.active .cga-dist-sub {
          color: #fff !important;
        }

        .cga-dist-letter {
          font-size: 15px;
          font-weight: 700;
        }
        .cga-dist-count {
          font-size: 20px;
          font-weight: 700;
          font-family: monospace;
          color: #111;
        }
        .cga-dist-sub {
          font-size: 11px;
          color: #888;
        }

        /* LEADERBOARD & STUDENT SORTING TABLE */
        .cga-leaderboard-card {
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.08);
          border-radius: 12px;
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .cga-controls-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .cga-sort-select {
          font-family: inherit;
          font-size: 13px;
          font-weight: 500;
          padding: 8px 12px;
          border-radius: 8px;
          border: 0.5px solid rgba(0,0,0,0.15);
          background: #fff;
          color: #111;
          outline: none;
          cursor: pointer;
        }
        .cga-sort-select:focus { border-color: #111; }

        .cga-filter-chips {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .cga-filter-btn {
          font-family: inherit;
          font-size: 12px;
          font-weight: 500;
          padding: 6px 12px;
          border-radius: 6px;
          border: 0.5px solid rgba(0,0,0,0.1);
          background: #f7f6f2;
          color: #555;
          cursor: pointer;
          transition: all 0.12s;
        }
        .cga-filter-btn:hover { background: #eae7df; color: #111; }
        .cga-filter-btn.active {
          background: #111;
          color: #fff;
          border-color: #111;
          font-weight: 600;
        }

        .cga-search-box {
          position: relative;
          min-width: 220px;
        }
        .cga-search-input {
          width: 100%;
          font-family: inherit;
          font-size: 13px;
          padding: 8px 12px 8px 30px;
          border-radius: 8px;
          border: 0.5px solid rgba(0,0,0,0.15);
          background: #fafaf8;
          outline: none;
          box-sizing: border-box;
        }
        .cga-search-input:focus { border-color: #111; background: #fff; }
        .cga-search-icon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 13px;
          color: #999;
          pointer-events: none;
        }

        /* Leaderboard Table */
        .cga-table-wrap {
          overflow-x: auto;
          border: 0.5px solid rgba(0,0,0,0.08);
          border-radius: 10px;
        }
        .cga-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          text-align: left;
        }
        .cga-th {
          background: #f9f8f5;
          padding: 12px 14px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #777;
          border-bottom: 1px solid rgba(0,0,0,0.08);
          white-space: nowrap;
        }
        .cga-td {
          padding: 12px 14px;
          border-bottom: 0.5px solid rgba(0,0,0,0.05);
          vertical-align: middle;
        }
        .cga-tr:hover { background: #fafaf7; }
        .cga-tr:last-child .cga-td { border-bottom: none; }

        /* Medals & Rank */
        .cga-rank-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          font-size: 12px;
          font-weight: 700;
          font-family: monospace;
        }
        .cga-rank-pill.gold {
          background: #fef3c7;
          color: #92400e;
          border: 1px solid #fde68a;
          box-shadow: 0 2px 6px rgba(146, 64, 14, 0.15);
        }
        .cga-rank-pill.silver {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #d1d5db;
        }
        .cga-rank-pill.bronze {
          background: #ffedd5;
          color: #9a3412;
          border: 1px solid #fed7aa;
        }
        .cga-rank-pill.regular {
          background: #f4f3ef;
          color: #666;
        }

        /* Grade Letter Badges */
        .cga-grade-tag {
          font-family: monospace;
          font-weight: 700;
          font-size: 12px;
          padding: 3px 8px;
          border-radius: 6px;
          display: inline-block;
          border: 0.5px solid transparent;
        }
        .cga-badge-a      { background: #dcfce7; color: #14532d; border-color: #86efac; }
        .cga-badge-ab     { background: #f0fdf4; color: #166534; border-color: #bbf7d0; }
        .cga-badge-bplus  { background: #dbeafe; color: #1e40af; border-color: #93c5fd; }
        .cga-badge-b      { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
        .cga-badge-bc     { background: #fef9c3; color: #854d0e; border-color: #fde047; }
        .cga-badge-c      { background: #ffedd5; color: #9a3412; border-color: #fdba74; }
        .cga-badge-d      { background: #fffbeb; color: #b45309; border-color: #fde68a; }
        .cga-badge-e      { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }
        .cga-badge-none   { background: #f4f3ef; color: #888; }

        .cga-btn {
          font-family: inherit;
          font-size: 12px;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: none;
        }
        .cga-btn.primary { background: #111; color: #fff; }
        .cga-btn.primary:hover { background: #333; }
        .cga-btn.secondary { background: #f4f3ef; color: #111; border: 0.5px solid rgba(0,0,0,0.12); }
        .cga-btn.secondary:hover { background: #eae7df; }

        @media (max-width: 768px) {
          .cga-kpi-grid { grid-template-columns: 1fr; }
          .cga-controls-bar { flex-direction: column; align-items: stretch; }
          .cga-search-box { min-width: 100%; }
        }
      `}</style>

      <div className="cga-container">
        {/* TOP KPI GRID */}
        <div className="cga-kpi-grid">
          {/* Card 1: Class Average */}
          <div className="cga-card">
            <div className="cga-card-header">
              <span className="cga-card-label">Rata-Rata Nilai Kelas</span>
              <span className="cga-card-icon">📊</span>
            </div>
            <div className="cga-card-val">
              {classSummary.classAverage !== null ? classSummary.classAverage.toFixed(2) : "—"}
              <span style={{ fontSize: "14px", fontWeight: 400, color: "#888" }}> / 100</span>
            </div>
            <div className="cga-card-sub">
              {classSummary.scoredStudentsCount} dari {classSummary.totalStudents} mahasiswa dinilai (
              {classSummary.fullyGradedCount} lengkap)
            </div>
          </div>

          {/* Card 2: Most Difficult Aspect (SPOLIGHT) */}
          <div className="cga-card cga-card-difficult">
            <div className="cga-card-header">
              <span className="cga-card-label">
                <span>⚠️</span> ASPEK TERSULIT (Capaian Terendah)
              </span>
              <span className="cga-card-icon">🎯</span>
            </div>
            {mostDifficultCriteria ? (
              <>
                <div className="cga-card-val" style={{ fontSize: "17px" }}>
                  {mostDifficultCriteria.judulkriteria}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                  <span
                    style={{
                      fontSize: "22px",
                      fontWeight: 800,
                      color: "#9a3412",
                      fontFamily: "monospace",
                    }}
                  >
                    {mostDifficultCriteria.avgPercent}%
                  </span>
                  <span style={{ fontSize: "12px", color: "#c2410c", fontWeight: 500 }}>
                    (Rata-rata: {mostDifficultCriteria.avgScore} / {mostDifficultCriteria.bobot} poin)
                  </span>
                </div>
                <div className="cga-card-sub" style={{ color: "#7c2d12" }}>
                  <strong>{mostDifficultCriteria.belowHalfCount}</strong> mahasiswa mendapat nilai di
                  bawah 50% pada kriteria ini.
                </div>
              </>
            ) : (
              <div className="cga-card-sub">Belum ada kriteria yang dinilai</div>
            )}
          </div>

          {/* Card 3: Easiest Aspect (SPOTLIGHT) */}
          <div className="cga-card cga-card-easiest">
            <div className="cga-card-header">
              <span className="cga-card-label">
                <span>⭐</span> ASPEK PALING DIKUASAI
              </span>
              <span className="cga-card-icon">🏆</span>
            </div>
            {easiestCriteria ? (
              <>
                <div className="cga-card-val" style={{ fontSize: "17px" }}>
                  {easiestCriteria.judulkriteria}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                  <span
                    style={{
                      fontSize: "22px",
                      fontWeight: 800,
                      color: "#166534",
                      fontFamily: "monospace",
                    }}
                  >
                    {easiestCriteria.avgPercent}%
                  </span>
                  <span style={{ fontSize: "12px", color: "#15803d", fontWeight: 500 }}>
                    (Rata-rata: {easiestCriteria.avgScore} / {easiestCriteria.bobot} poin)
                  </span>
                </div>
                <div className="cga-card-sub" style={{ color: "#14532d" }}>
                  <strong>{easiestCriteria.perfectCount}</strong> mahasiswa meraih poin penuh pada
                  kriteria ini.
                </div>
              </>
            ) : (
              <div className="cga-card-sub">Belum ada kriteria yang dinilai</div>
            )}
          </div>

          {/* Card 4: Passing Rate & Spread */}
          <div className="cga-card">
            <div className="cga-card-header">
              <span className="cga-card-label">Tingkat Kelulusan (≥ 60)</span>
              <span className="cga-card-icon">🎓</span>
            </div>
            <div className="cga-card-val">
              {classSummary.scoredStudentsCount > 0 ? `${classSummary.passingRate}%` : "—"}
            </div>
            <div className="cga-card-sub">
              Tertinggi:{" "}
              <strong>
                {classSummary.highestScore !== null ? classSummary.highestScore.toFixed(1) : "—"}
              </strong>{" "}
              • Terendah:{" "}
              <strong>
                {classSummary.lowestScore !== null ? classSummary.lowestScore.toFixed(1) : "—"}
              </strong>
            </div>
          </div>
        </div>

        {/* SECTION 1: ASPECT DIFFICULTY ANALYSIS (DEEP DIVE) */}
        <div className="cga-card">
          <div className="cga-section-header">
            <div>
              <h2 className="cga-section-title">
                <span>🎯</span> Analisis Tingkat Kesulitan Tiap Aspek / Kriteria
              </h2>
              <p className="cga-section-desc">
                Diurutkan berdasarkan persentase capaian rata-rata mahasiswa terhadap bobot maksimal.
                Aspek dengan capaian persentase paling rendah merupakan materi yang paling sulit
                dikuasai.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#666" }}>Urutkan:</label>
              <select
                className="cga-sort-select"
                value={aspectSortKey}
                onChange={(e) =>
                  setAspectSortKey(
                    e.target.value as "difficulty-asc" | "difficulty-desc" | "bobot-desc" | "default"
                  )
                }
              >
                <option value="difficulty-asc">⚠️ Tersulit → Termudah (Capaian Terendah)</option>
                <option value="difficulty-desc">⭐ Termudah → Tersulit (Capaian Tertinggi)</option>
                <option value="bobot-desc">⚖️ Bobot Poin Terbesar</option>
                <option value="default">📋 Urutan Asli Kriteria</option>
              </select>
            </div>
          </div>

          <div className="cga-aspect-list">
            {sortedCriteriaStats.map((stat, idx) => {
              const isHardest = stat.judulkriteria === mostDifficultCriteria?.judulkriteria
              const isEasiest = stat.judulkriteria === easiestCriteria?.judulkriteria
              const isExpanded = expandedCriteria === stat.judulkriteria

              // Determine color based on average percentage
              let progressColor = "#16a34a" // green
              let rankBadgeClass = "easy"
              let rankLabel = "Mudah / Dikuasai"

              if (stat.avgPercent < 50) {
                progressColor = "#dc2626" // red
                rankBadgeClass = "hardest"
                rankLabel = "Sangat Sulit"
              } else if (stat.avgPercent < 65) {
                progressColor = "#ea580c" // orange
                rankBadgeClass = "hard"
                rankLabel = "Sulit"
              } else if (stat.avgPercent < 75) {
                progressColor = "#ca8a04" // yellow
                rankBadgeClass = "medium"
                rankLabel = "Sedang"
              }

              return (
                <div
                  key={stat.judulkriteria}
                  className={`cga-aspect-item ${isHardest ? "is-hardest" : ""}`}
                >
                  <div className="cga-aspect-top">
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <div className="cga-aspect-title-group">
                        <span className={`cga-rank-badge ${rankBadgeClass}`}>
                          {isHardest
                            ? "⚠️ ASPEK PALING SULIT (#1)"
                            : isEasiest
                            ? "⭐ PALING DIKUASAI"
                            : `#${idx + 1} • ${rankLabel}`}
                        </span>
                        <h3 className="cga-aspect-name">{stat.judulkriteria}</h3>
                        <span className="cga-aspect-max-pill">Bobot: {stat.bobot} Poin</span>
                      </div>

                      {stat.kriteria && (
                        <p style={{ fontSize: "12px", color: "#666", maxWidth: "700px" }}>
                          {stat.kriteria}
                        </p>
                      )}
                    </div>

                    <div className="cga-aspect-stats-right">
                      <div className="cga-aspect-pct-val" style={{ color: progressColor }}>
                        {stat.avgPercent}% Capaian
                      </div>
                      <div style={{ fontSize: "12px", color: "#777" }}>
                        Rata-rata: <strong>{stat.avgScore}</strong> / {stat.bobot} Poin
                      </div>
                    </div>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="cga-progress-bg">
                    <div
                      className="cga-progress-fill"
                      style={{
                        width: `${Math.min(100, Math.max(0, stat.avgPercent))}%`,
                        backgroundColor: progressColor,
                      }}
                    />
                  </div>

                  {/* Metadata Row */}
                  <div className="cga-aspect-meta-row">
                    <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
                      <span>
                        Dinilai: <strong>{stat.gradedCount}</strong> mahasiswa
                      </span>
                      <span>
                        Nilai Min: <strong>{stat.minScore ?? "—"}</strong>
                      </span>
                      <span>
                        Nilai Max: <strong>{stat.maxScore ?? "—"}</strong>
                      </span>
                      {stat.belowHalfCount > 0 && (
                        <span style={{ color: "#c2410c", fontWeight: 600 }}>
                          ⚠️ {stat.belowHalfCount} mahasiswa dapat &lt; 50%
                        </span>
                      )}
                      {stat.perfectCount > 0 && (
                        <span style={{ color: "#15803d" }}>
                          ✓ {stat.perfectCount} nilai sempurna ({stat.bobot} poin)
                        </span>
                      )}
                    </div>

                    {stat.strugglingStudents.length > 0 && (
                      <button
                        type="button"
                        className="cga-struggle-toggle"
                        onClick={() =>
                          setExpandedCriteria(isExpanded ? null : stat.judulkriteria)
                        }
                      >
                        <span>{isExpanded ? "▲ Sembunyikan" : "▼ Lihat Mahasiswa Nilai Terendah"}</span>
                      </button>
                    )}
                  </div>

                  {/* Expandable Drawer: Students struggling on this criteria */}
                  {isExpanded && (
                    <div className="cga-struggling-drawer">
                      <div className="cga-drawer-title">
                        <span>
                          Mahasiswa dengan nilai terendah pada <em>{stat.judulkriteria}</em>:
                        </span>
                        <span style={{ fontSize: "11px", color: "#888", fontWeight: 400 }}>
                          (Klik untuk langsung membuka lembar nilai mahasiswa)
                        </span>
                      </div>
                      <div className="cga-struggling-chips">
                        {stat.strugglingStudents.slice(0, 12).map((s) => (
                          <button
                            key={s.nrp}
                            type="button"
                            className="cga-student-chip"
                            onClick={() => onSelectStudent(s.originalIndex)}
                            title={`Buka lembar penilaian untuk ${s.nama} (${s.nrp})`}
                          >
                            <span>{s.nama}</span>
                            <span className="chip-score">
                              {s.score}/{stat.bobot} ({s.percent}%)
                            </span>
                            <span style={{ fontSize: "10px", color: "#999" }}>↗</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* SECTION 2: GRADE DISTRIBUTION HISTOGRAM / BUCKETS */}
        <div className="cga-dist-card">
          <div className="cga-section-header">
            <div>
              <h2 className="cga-section-title">
                <span>📈</span> Distribusi Predikat Nilai Akhir
              </h2>
              <p className="cga-section-desc">
                Klik predikat di bawah untuk langsung memfilter daftar mahasiswa di tabel peringkat.
              </p>
            </div>

            <button
              type="button"
              className="cga-btn secondary"
              onClick={handleCopySummary}
              title="Salin ringkasan statistik kelas ke clipboard"
            >
              {copyFeedback ? "✓ Berhasil Disalin!" : "📋 Salin Ringkasan Kelas"}
            </button>
          </div>

          <div className="cga-dist-grid">
            <div
              className={`cga-dist-col ${studentFilter === "top" ? "active" : ""}`}
              onClick={() => setStudentFilter(studentFilter === "top" ? "all" : "top")}
            >
              <span className="cga-dist-letter" style={{ color: "#15803d" }}>
                A / AB (≥80)
              </span>
              <span className="cga-dist-count">
                {gradeDistribution.A + gradeDistribution.AB}
              </span>
              <span className="cga-dist-sub">Istimewa</span>
            </div>

            <div
              className={`cga-dist-col ${studentFilter === "good" ? "active" : ""}`}
              onClick={() => setStudentFilter(studentFilter === "good" ? "all" : "good")}
            >
              <span className="cga-dist-letter" style={{ color: "#1d4ed8" }}>
                B / B+ (70-79)
              </span>
              <span className="cga-dist-count">
                {gradeDistribution.BPlus + gradeDistribution.B}
              </span>
              <span className="cga-dist-sub">Baik</span>
            </div>

            <div
              className={`cga-dist-col ${studentFilter === "passing" ? "active" : ""}`}
              onClick={() => setStudentFilter(studentFilter === "passing" ? "all" : "passing")}
            >
              <span className="cga-dist-letter" style={{ color: "#b45309" }}>
                BC / C (60-69)
              </span>
              <span className="cga-dist-count">
                {gradeDistribution.BC + gradeDistribution.C}
              </span>
              <span className="cga-dist-sub">Cukup</span>
            </div>

            <div
              className={`cga-dist-col ${studentFilter === "remedial" ? "active" : ""}`}
              onClick={() => setStudentFilter(studentFilter === "remedial" ? "all" : "remedial")}
            >
              <span className="cga-dist-letter" style={{ color: "#b91c1c" }}>
                D / E (&lt;60)
              </span>
              <span className="cga-dist-count">
                {gradeDistribution.D + gradeDistribution.E}
              </span>
              <span className="cga-dist-sub">Perlu Remedial</span>
            </div>

            <div
              className={`cga-dist-col ${studentFilter === "incomplete" ? "active" : ""}`}
              onClick={() => setStudentFilter(studentFilter === "incomplete" ? "all" : "incomplete")}
            >
              <span className="cga-dist-letter" style={{ color: "#777" }}>
                Belum Lengkap
              </span>
              <span className="cga-dist-count">{gradeDistribution.incomplete}</span>
              <span className="cga-dist-sub">Dalam Proses</span>
            </div>
          </div>
        </div>

        {/* SECTION 3: STUDENT LEADERBOARD & GRADE SORTING */}
        <div className="cga-leaderboard-card">
          <div className="cga-section-header">
            <div>
              <h2 className="cga-section-title">
                <span>🏆</span> Peringkat &amp; Pengurutan Nilai Mahasiswa
              </h2>
              <p className="cga-section-desc">
                Urutkan mahasiswa berdasarkan nilai akhir tertinggi/terendah, atau berdasarkan nilai pada aspek yang paling sulit.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                type="button"
                className="cga-btn secondary"
                onClick={onSwitchToTable}
                title="Beralih ke tabel edit nilai matriks"
              >
                📊 Buka Spreadsheet Matriks
              </button>

              <button
                type="button"
                className="cga-btn primary"
                onClick={handleExportCSV}
                title="Unduh hasil analisis dan peringkat dalam format CSV"
              >
                📥 Unduh CSV Rekap
              </button>
            </div>
          </div>

          {/* Controls: Sorting Dropdown, Filter Chips, Live Search */}
          <div className="cga-controls-bar">
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#555" }}>
                Urutkan Mahasiswa:
              </label>
              <select
                className="cga-sort-select"
                value={studentSortKey}
                onChange={(e) =>
                  setStudentSortKey(
                    e.target.value as
                      | "grade-desc"
                      | "grade-asc"
                      | "diff-crit-asc"
                      | "diff-crit-desc"
                      | "nama-asc"
                      | "nama-desc"
                      | "nrp-asc"
                      | "nrp-desc"
                  )
                }
              >
                <option value="grade-desc">🏆 Nilai Tertinggi → Terendah (Peringkat 1..N)</option>
                <option value="grade-asc">📉 Nilai Terendah → Tertinggi (Identifikasi Remedial)</option>
                {mostDifficultCriteria && (
                  <>
                    <option value="diff-crit-asc">
                      🎯 Nilai Terendah di Aspek Tersulit ({mostDifficultCriteria.judulkriteria})
                    </option>
                    <option value="diff-crit-desc">
                      🎯 Nilai Tertinggi di Aspek Tersulit ({mostDifficultCriteria.judulkriteria})
                    </option>
                  </>
                )}
                <option value="nama-asc">🔤 Nama (A → Z)</option>
                <option value="nama-desc">🔤 Nama (Z → A)</option>
                <option value="nrp-asc">🔢 NRP (0 → 9)</option>
                <option value="nrp-desc">🔢 NRP (9 → 0)</option>
              </select>
            </div>

            <div className="cga-filter-chips">
              <button
                type="button"
                className={`cga-filter-btn ${studentFilter === "all" ? "active" : ""}`}
                onClick={() => setStudentFilter("all")}
              >
                Semua ({students.length})
              </button>
              <button
                type="button"
                className={`cga-filter-btn ${studentFilter === "top" ? "active" : ""}`}
                onClick={() => setStudentFilter("top")}
              >
                A / AB (≥80)
              </button>
              <button
                type="button"
                className={`cga-filter-btn ${studentFilter === "good" ? "active" : ""}`}
                onClick={() => setStudentFilter("good")}
              >
                B / B+ (70-79)
              </button>
              <button
                type="button"
                className={`cga-filter-btn ${studentFilter === "remedial" ? "active" : ""}`}
                onClick={() => setStudentFilter("remedial")}
              >
                Perlu Remedial (&lt;60)
              </button>
              <button
                type="button"
                className={`cga-filter-btn ${studentFilter === "incomplete" ? "active" : ""}`}
                onClick={() => setStudentFilter("incomplete")}
              >
                Belum Lengkap
              </button>
            </div>

            <div className="cga-search-box">
              <span className="cga-search-icon">🔍</span>
              <input
                type="text"
                placeholder="Cari nama / NRP..."
                className="cga-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Leaderboard Table View */}
          <div className="cga-table-wrap">
            <table className="cga-table">
              <thead>
                <tr>
                  <th className="cga-th" style={{ width: "60px", textAlign: "center" }}>
                    Rank
                  </th>
                  <th className="cga-th" style={{ minWidth: "130px" }}>
                    NRP
                  </th>
                  <th className="cga-th" style={{ minWidth: "200px" }}>
                    Nama Mahasiswa
                  </th>
                  <th className="cga-th" style={{ textAlign: "center", minWidth: "120px" }}>
                    Nilai Akhir
                  </th>
                  <th className="cga-th" style={{ textAlign: "center", minWidth: "100px" }}>
                    Mutu
                  </th>
                  {mostDifficultCriteria && (
                    <th className="cga-th" style={{ textAlign: "center", minWidth: "150px" }}>
                      <div>Skor Aspek Tersulit</div>
                      <div style={{ fontSize: "10px", color: "#c2410c", fontWeight: 500 }}>
                        {mostDifficultCriteria.judulkriteria} (Max: {mostDifficultCriteria.bobot})
                      </div>
                    </th>
                  )}
                  <th className="cga-th" style={{ textAlign: "center", minWidth: "110px" }}>
                    Status
                  </th>
                  <th className="cga-th" style={{ textAlign: "center", width: "100px" }}>
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedStudents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={mostDifficultCriteria ? 8 : 7}
                      style={{ textAlign: "center", padding: "40px 16px", color: "#888" }}
                    >
                      Tidak ada mahasiswa yang sesuai dengan filter pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedStudents.map((st, idx) => {
                    const rank = idx + 1
                    const rankPillClass =
                      studentSortKey === "grade-desc"
                        ? rank === 1
                          ? "gold"
                          : rank === 2
                          ? "silver"
                          : rank === 3
                          ? "bronze"
                          : "regular"
                        : "regular"

                    const hardestItem = mostDifficultCriteria
                      ? st.criteriaScores[mostDifficultCriteria.judulkriteria]
                      : null

                    return (
                      <tr key={st.nrp} className="cga-tr">
                        <td className="cga-td" style={{ textAlign: "center" }}>
                          <span className={`cga-rank-pill ${rankPillClass}`}>
                            {studentSortKey === "grade-desc" && rank === 1
                              ? "🥇"
                              : studentSortKey === "grade-desc" && rank === 2
                              ? "🥈"
                              : studentSortKey === "grade-desc" && rank === 3
                              ? "🥉"
                              : rank}
                          </span>
                        </td>

                        <td
                          className="cga-td"
                          style={{ fontFamily: "monospace", fontWeight: 600, color: "#111" }}
                        >
                          {st.nrp}
                        </td>

                        <td className="cga-td">
                          <div style={{ fontWeight: 600, color: "#222" }}>{st.nama}</div>
                          <div style={{ fontSize: "11px", color: "#999" }}>{st.email}</div>
                        </td>

                        <td className="cga-td" style={{ textAlign: "center" }}>
                          {st.totalScore !== null ? (
                            <div>
                              <span
                                style={{
                                  fontSize: "15px",
                                  fontWeight: 800,
                                  fontFamily: "monospace",
                                  color: st.totalScore >= 60 ? "#166534" : "#b91c1c",
                                }}
                              >
                                {st.totalScore.toFixed(2)}
                              </span>
                              <div style={{ fontSize: "10px", color: "#888" }}>
                                {st.filledCount}/{criteriaList.length} kriteria
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: "#ccc" }}>Belum dinilai</span>
                          )}
                        </td>

                        <td className="cga-td" style={{ textAlign: "center" }}>
                          <span className={`cga-grade-tag ${st.gradeMeta.badgeClass}`}>
                            {st.gradeMeta.letter}
                          </span>
                        </td>

                        {mostDifficultCriteria && (
                          <td className="cga-td" style={{ textAlign: "center" }}>
                            {hardestItem && hardestItem.score !== null ? (
                              <div
                                style={{
                                  display: "inline-flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                }}
                              >
                                <span
                                  style={{
                                    fontFamily: "monospace",
                                    fontWeight: 700,
                                    fontSize: "13px",
                                    color:
                                      hardestItem.percent! < 50
                                        ? "#b91c1c"
                                        : hardestItem.percent! < 75
                                        ? "#b45309"
                                        : "#15803d",
                                  }}
                                >
                                  {hardestItem.score} / {mostDifficultCriteria.bobot}
                                </span>
                                <span style={{ fontSize: "10px", color: "#777" }}>
                                  ({Math.round(hardestItem.percent!)}% capaian)
                                </span>
                              </div>
                            ) : (
                              <span style={{ color: "#ccc" }}>—</span>
                            )}
                          </td>
                        )}

                        <td className="cga-td" style={{ textAlign: "center" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              color: st.gradeMeta.color,
                            }}
                          >
                            {st.gradeMeta.status}
                          </span>
                        </td>

                        <td className="cga-td" style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            className="cga-btn secondary"
                            onClick={() => onSelectStudent(st.originalIndex)}
                            title="Buka lembar penilaian & feedback mahasiswa ini"
                          >
                            👁️ Buka
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
