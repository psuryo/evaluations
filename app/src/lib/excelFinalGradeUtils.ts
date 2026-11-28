import * as XLSX from "xlsx"

export interface FinalGradeTemplateRow {
  nrp: string
  nama: string
  midAssignmentGrade?: number | null
  midExamGrade?: number | null
  finalAssignmentGrade?: number | null
  finalExamGrade?: number | null
  finalGrade?: number | null
}

export interface ParsedFinalGradeRow {
  rowIndex: number
  nrp: string
  nama: string
  mid_assignment_grade: number | null
  mid_exam_grade: number | null
  final_assignment_grade: number | null
  final_exam_grade: number | null
  final_grade: number | null
  isValid: boolean
  errors: string[]
}

export interface FinalGradeParseSummary {
  fileName: string
  sheetName: string
  totalRows: number
  validCount: number
  errorCount: number
  rows: ParsedFinalGradeRow[]
  hasErrors: boolean
  errors: string[]
}

function normalizeColHeader(text: string): string {
  return String(text || "")
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function parseGradeCell(
  raw: unknown,
  label: string
): { value: number | null; error?: string } {
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return { value: null }
  }
  const normalized = String(raw).trim().replace(",", ".")
  const num = Number(normalized)
  if (!Number.isFinite(num) || num < 0 || num > 100) {
    return { value: null, error: `${label} harus angka 0–100` }
  }
  return { value: Math.round(num * 100) / 100 }
}

export function downloadFinalGradeTemplateBrowser({
  matkul,
  tahun = "",
  students = [],
}: {
  matkul: string
  tahun?: string
  students?: FinalGradeTemplateRow[]
}) {
  const wb = XLSX.utils.book_new()

  const headers = [
    "NRP",
    "Nama Mahasiswa",
    "Tugas UTS",
    "UTS",
    "Tugas UAS",
    "UAS",
    "Final Grade (Opsional)",
  ]

  const rows: (string | number)[][] =
    students.length > 0
      ? students.map((s) => [
          s.nrp,
          s.nama,
          s.midAssignmentGrade ?? "",
          s.midExamGrade ?? "",
          s.finalAssignmentGrade ?? "",
          s.finalExamGrade ?? "",
          s.finalGrade ?? "",
        ])
      : [
          ["5803024001", "Contoh Mahasiswa 1", 85, 80, 88, 82, ""],
          ["5803024002", "Contoh Mahasiswa 2", 78, 75, 80, 79, ""],
        ]

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws["!cols"] = [
    { wch: 16 },
    { wch: 28 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 24 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, "Final Grades")

  const guideRows = [
    ["Panduan Import Final Grades"],
    ["Mata Kuliah", `${matkul}${tahun ? ` (${tahun})` : ""}`],
    [""],
    ["Kolom", "Keterangan"],
    ["NRP", "Wajib diisi sesuai NRP mahasiswa di database."],
    ["Nama Mahasiswa", "Opsional (hanya sebagai referensi saat mengisi Excel)."],
    ["Tugas UTS", "Nilai 0 - 100 (boleh dikosongkan)."],
    ["UTS", "Nilai 0 - 100 (boleh dikosongkan)."],
    ["Tugas UAS", "Nilai 0 - 100 (boleh dikosongkan)."],
    ["UAS", "Nilai 0 - 100 (boleh dikosongkan)."],
    [
      "Final Grade (Opsional)",
      "Kosongkan agar dihitung otomatis dari bobot, atau isi manual (0 - 100).",
    ],
  ]
  const guideWs = XLSX.utils.aoa_to_sheet(guideRows)
  guideWs["!cols"] = [{ wch: 24 }, { wch: 64 }]
  XLSX.utils.book_append_sheet(wb, guideWs, "Panduan")

  const safeMatkul = (matkul || "final-grades")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
  const safeTahun = tahun ? `_${tahun.replace(/[^a-zA-Z0-9_-]+/g, "_")}` : ""
  XLSX.writeFile(wb, `Template_Final_Grades_${safeMatkul}${safeTahun}.xlsx`)
}

export function parseFinalGradeExcel(
  buffer: ArrayBuffer,
  fileName: string
): FinalGradeParseSummary {
  const wb = XLSX.read(buffer, { type: "array" })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) {
    return {
      fileName,
      sheetName: "",
      totalRows: 0,
      validCount: 0,
      errorCount: 0,
      rows: [],
      hasErrors: true,
      errors: ["File Excel tidak memiliki sheet."],
    }
  }

  const ws = wb.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: "",
  })

  if (rawRows.length < 2) {
    return {
      fileName,
      sheetName,
      totalRows: 0,
      validCount: 0,
      errorCount: 0,
      rows: [],
      hasErrors: true,
      errors: ["File Excel kosong atau tidak memiliki baris data."],
    }
  }

  const headerRow = rawRows[0].map((cell) => normalizeColHeader(String(cell)))

  const findCol = (aliases: string[]) =>
    headerRow.findIndex((h) => aliases.some((a) => h === a || h.includes(a)))

  const nrpCol = findCol(["nrp", "nim"])
  const namaCol = findCol(["nama", "name"])
  const midAssignCol = findCol(["tugas uts", "mid assignment", "mid_assignment"])
  const midExamCol = headerRow.findIndex(
    (h) => h === "uts" || h === "mid exam" || h === "mid_exam"
  )
  const finalAssignCol = findCol(["tugas uas", "final assignment", "final_assignment"])
  const finalExamCol = headerRow.findIndex(
    (h) => h === "uas" || h === "final exam" || h === "final_exam"
  )
  const finalGradeCol = findCol(["final grade", "final_grade", "nilai akhir"])

  if (nrpCol === -1) {
    return {
      fileName,
      sheetName,
      totalRows: 0,
      validCount: 0,
      errorCount: 0,
      rows: [],
      hasErrors: true,
      errors: ['Kolom "NRP" tidak ditemukan pada baris header pertama.'],
    }
  }

  const parsedRows: ParsedFinalGradeRow[] = []
  let validCount = 0
  let errorCount = 0

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i]
    if (!row || row.every((c) => String(c ?? "").trim() === "")) continue

    const nrp = String(row[nrpCol] ?? "").trim()
    const nama = namaCol !== -1 ? String(row[namaCol] ?? "").trim() : ""
    const rowErrors: string[] = []

    if (!nrp) {
      rowErrors.push("NRP kosong")
    }

    const midAssign =
      midAssignCol !== -1
        ? parseGradeCell(row[midAssignCol], "Tugas UTS")
        : { value: null }
    const midExam =
      midExamCol !== -1
        ? parseGradeCell(row[midExamCol], "UTS")
        : { value: null }
    const finalAssign =
      finalAssignCol !== -1
        ? parseGradeCell(row[finalAssignCol], "Tugas UAS")
        : { value: null }
    const finalExam =
      finalExamCol !== -1
        ? parseGradeCell(row[finalExamCol], "UAS")
        : { value: null }
    const finalGrade =
      finalGradeCol !== -1
        ? parseGradeCell(row[finalGradeCol], "Final Grade")
        : { value: null }

    for (const r of [midAssign, midExam, finalAssign, finalExam, finalGrade]) {
      if (r.error) rowErrors.push(r.error)
    }

    const isValid = rowErrors.length === 0
    if (isValid) validCount++
    else errorCount++

    parsedRows.push({
      rowIndex: i + 1,
      nrp,
      nama,
      mid_assignment_grade: midAssign.value,
      mid_exam_grade: midExam.value,
      final_assignment_grade: finalAssign.value,
      final_exam_grade: finalExam.value,
      final_grade: finalGrade.value,
      isValid,
      errors: rowErrors,
    })
  }

  return {
    fileName,
    sheetName,
    totalRows: parsedRows.length,
    validCount,
    errorCount,
    rows: parsedRows,
    hasErrors: errorCount > 0,
    errors:
      errorCount > 0
        ? [`${errorCount} baris memiliki kesalahan format nilai.`]
        : [],
  }
}
