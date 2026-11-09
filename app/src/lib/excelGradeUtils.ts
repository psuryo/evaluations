import * as XLSX from "xlsx"

export interface CriteriaItem {
  judulkriteria: string
  kriteria: string
  bobot: number
}

export interface StudentItem {
  nrp: string
  nama: string
  email?: string
  grades?: Record<string, { grade: number | null; kriteria?: string | null }>
}

export interface MatchedCriteriaCol {
  judulkriteria: string
  bobot: number
  gradeColIndex: number
  descColIndex: number // -1 jika tidak ada kolom deskripsi di file
  gradeHeaderName: string
  descHeaderName?: string
  defaultKriteria: string
}

export interface ParseResultRow {
  rowIndex: number
  nrp: string
  nama: string
  isEnrolled: boolean
  matchedGrades: Record<string, { value: number | null; raw: unknown; isValid: boolean; error?: string }>
  matchedComments: Record<string, { value: string; isCustom: boolean }>
  status: "valid" | "warning" | "new_student" | "error"
  messages: string[]
}

export interface ExcelParseSummary {
  fileName: string
  sheetName: string
  totalRows: number
  matchedCriteria: MatchedCriteriaCol[]
  unmatchedColumns: string[]
  rows: ParseResultRow[]
  enrolledMatchCount: number
  newStudentCount: number
  totalGradeUpdates: number
  hasDescriptionColumns: boolean
  hasErrors: boolean
  errors: string[]
}

/**
 * Normalisasi nama header kolom agar mudah dicocokkan dengan judulkriteria.
 * Menghapus teks dalam tanda kurung dan indikator seperti (Bobot 20), (Nilai), atau (Deskripsi).
 */
export function normalizeHeader(text: string): string {
  if (!text) return ""
  return String(text)
    .replace(/[-–—]/g, " ")
    .replace(/\(bobot[^)]*\)/gi, "")
    .replace(/\(maks[^)]*\)/gi, "")
    .replace(/\b(nilai|score|bobot|maks|deskripsi|catatan|komentar|rubrik|feedback)\b/gi, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

/**
 * Buat workbook Excel untuk template pengisian nilai dan deskripsi rubrik mahasiswa.
 * - Tanpa note / comment pada sel
 * - Tanpa baris panduan di bawah header kolom (data mahasiswa langsung dimulai di baris kedua)
 * - Nilai kriteria berbasis bobot (bukan persentase)
 */
export function createGradeWorkbook({
  matkul,
  tahun = "",
  criteriaList,
  students,
}: {
  matkul: string
  tahun?: string
  criteriaList: CriteriaItem[]
  students: StudentItem[]
}): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()

  // ── Sheet 1: Nilai & Deskripsi Mahasiswa ──────────────────────────────
  const headers: string[] = ["NRP", "Nama Mahasiswa"]
  for (const crit of criteriaList) {
    const weightLabel = crit.bobot ? ` (Maks ${crit.bobot})` : ""
    headers.push(`${crit.judulkriteria} - Nilai${weightLabel}`)
    headers.push(`${crit.judulkriteria} - Deskripsi`)
  }

  const dataRows: (string | number)[][] = []

  if (students.length > 0) {
    for (const st of students) {
      const row: (string | number)[] = [st.nrp, st.nama]
      for (const crit of criteriaList) {
        let valGrade: string | number = ""
        let valDesc: string = ""

        if (st.grades && st.grades[crit.judulkriteria]) {
          const item = st.grades[crit.judulkriteria]
          if (item.grade !== null && item.grade !== undefined) {
            valGrade = Number(item.grade)
          }
          // Jika mahasiswa sudah memiliki catatan khusus di database yang berbeda dari default, tampilkan
          const curKriteria = item.kriteria ? item.kriteria.trim() : ""
          const defKriteria = crit.kriteria ? crit.kriteria.trim() : ""
          if (curKriteria && curKriteria !== defKriteria) {
            valDesc = curKriteria
          }
        }

        row.push(valGrade)
        row.push(valDesc) // jika kosong = otomatis default saat diimport
      }
      dataRows.push(row)
    }
  } else {
    // Baris contoh jika belum ada mahasiswa terdaftar (nilai sesuai bobot poin)
    const sampleRow: (string | number)[] = ["5025201001", "Contoh Mahasiswa 1"]
    for (const crit of criteriaList) {
      sampleRow.push(Math.round(crit.bobot * 0.8)) // Poin contoh
      sampleRow.push("") // Kosong = otomatis menggunakan deskripsi default
    }
    dataRows.push(sampleRow)

    const sampleRow2: (string | number)[] = ["5025201002", "Contoh Mahasiswa 2"]
    for (const crit of criteriaList) {
      sampleRow2.push(crit.bobot) // Nilai penuh sesuai bobot
      sampleRow2.push("Pengerjaan sangat rapi dan tepat") // Contoh deskripsi kustom
    }
    dataRows.push(sampleRow2)
  }

  // Data langsung dimulai tepat setelah baris header
  const wsData = [headers, ...dataRows]
  const wsNilai = XLSX.utils.aoa_to_sheet(wsData)

  // Atur lebar kolom agar rapi dan mudah dibaca
  const colWidths: { wch: number }[] = [{ wch: 18 }, { wch: 32 }]
  for (let i = 0; i < criteriaList.length; i++) {
    const crit = criteriaList[i]
    const gradeHeaderLen = `${crit.judulkriteria} - Nilai (Maks ${crit.bobot})`.length
    colWidths.push({ wch: Math.max(gradeHeaderLen + 2, 20) }) // Kolom Nilai
    colWidths.push({ wch: 32 }) // Kolom Deskripsi
  }
  wsNilai["!cols"] = colWidths

  // ── Sheet 2: Petunjuk & Daftar Rubrik Default ─────────────────────────
  const totalBobot = criteriaList.reduce((acc, c) => acc + (c.bobot || 0), 0)
  const infoRows: (string | number)[][] = [
    ["PETUNJUK PENGISIAN TEMPLATE NILAI & RUBRIK EXCEL"],
    [""],
    ["Mata Kuliah", matkul],
    ["Tahun / Semester", tahun || "—"],
    ["Jumlah Kriteria", criteriaList.length],
    ["Total Bobot (Maksimal Semua Nilai)", totalBobot],
    ["Jumlah Mahasiswa Terdaftar", students.length],
    [""],
    ["NO", "PANDUAN PENGISIAN"],
    [1, "Kolom 'NRP' wajib diisi dengan NRP mahasiswa yang valid (angka/teks tanpa spasi)."],
    [2, "Kolom 'Nama Mahasiswa' disediakan sebagai referensi visual dan tidak wajib diubah."],
    [
      3,
      "Kolom '[Kriteria] - Nilai' diisi angka poin antara 0 hingga bobot maksimal kriteria tersebut (bukan persentase). Total nilai akhir adalah penjumlahan langsung dari seluruh nilai kriteria.",
    ],
    [
      4,
      "Kolom '[Kriteria] - Deskripsi' dapat diisi catatan/rubrik khusus per mahasiswa. JIKA DIKOSONGKAN, sistem otomatis menggunakan DESKRIPSI DEFAULT di bawah ini.",
    ],
    [5, "Jika mahasiswa belum dinilai atau tidak mengumpulkan, biarkan sel nilai kosong."],
    [6, "Baris data mahasiswa langsung dimulai pada baris ke-2 (tepat di bawah baris header kolom)."],
    [7, "Jangan mengubah nama kolom kriteria agar sistem dapat mencocokkan kolom secara otomatis."],
    [8, "Anda dapat menambahkan baris mahasiswa baru di bawah. Sistem akan mendeteksi mahasiswa baru tersebut."],
    [9, "Simpan file dalam format .xlsx atau .xls, kemudian unggah melalui tombol 'Import Nilai Excel'."],
    [""],
    ["DAFTAR KRITERIA & BOBOT POIN MAKSIMAL:"],
    ["No", "Nama Kriteria", "Bobot Poin Maksimal", "Deskripsi Default (Dipakai jika sel deskripsi Excel kosong)"],
  ]

  criteriaList.forEach((c, idx) => {
    infoRows.push([idx + 1, c.judulkriteria, c.bobot, c.kriteria || "—"])
  })

  const wsInfo = XLSX.utils.aoa_to_sheet(infoRows)
  wsInfo["!cols"] = [{ wch: 6 }, { wch: 28 }, { wch: 20 }, { wch: 55 }]

  const safeMatkulSheet = matkul.replace(/[:\\/?*[\]]/g, "_").slice(0, 25)
  XLSX.utils.book_append_sheet(wb, wsNilai, `Nilai ${safeMatkulSheet}`)
  XLSX.utils.book_append_sheet(wb, wsInfo, "Petunjuk & Bobot")

  return wb
}

/**
 * Generate binary buffer (.xlsx) untuk response server / download link.
 */
export function generateExcelBuffer(params: {
  matkul: string
  tahun?: string
  criteriaList: CriteriaItem[]
  students: StudentItem[]
}): Buffer {
  const wb = createGradeWorkbook(params)
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer
}

/**
 * Trigger download file Excel di browser (client-side).
 */
export function downloadGradeTemplateBrowser(params: {
  matkul: string
  tahun?: string
  criteriaList: CriteriaItem[]
  students: StudentItem[]
}) {
  const wb = createGradeWorkbook(params)
  const safeMatkul = params.matkul.replace(/[^a-zA-Z0-9_-]/g, "_")
  const safeTahun = (params.tahun || "").replace(/[^a-zA-Z0-9_-]/g, "_")
  const fileName = `Template_Nilai_${safeMatkul}${safeTahun ? "_" + safeTahun : ""}.xlsx`
  XLSX.writeFile(wb, fileName)
}

/**
 * Parse file Excel yang diunggah dosen untuk input nilai dan deskripsi rubrik.
 */
export function parseGradeExcel(
  fileData: ArrayBuffer | Uint8Array,
  fileName: string,
  criteriaList: CriteriaItem[],
  enrolledStudents: StudentItem[]
): ExcelParseSummary {
  const errors: string[] = []
  const enrolledNrpMap = new Map<string, StudentItem>()
  for (const s of enrolledStudents) {
    enrolledNrpMap.set(String(s.nrp).trim().toLowerCase(), s)
  }

  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(fileData, { type: "array" })
  } catch (err) {
    return {
      fileName,
      sheetName: "",
      totalRows: 0,
      matchedCriteria: [],
      unmatchedColumns: [],
      rows: [],
      enrolledMatchCount: 0,
      newStudentCount: 0,
      totalGradeUpdates: 0,
      hasDescriptionColumns: false,
      hasErrors: true,
      errors: ["File tidak dapat dibaca sebagai format Excel yang valid."],
    }
  }

  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    return {
      fileName,
      sheetName: "",
      totalRows: 0,
      matchedCriteria: [],
      unmatchedColumns: [],
      rows: [],
      enrolledMatchCount: 0,
      newStudentCount: 0,
      totalGradeUpdates: 0,
      hasDescriptionColumns: false,
      hasErrors: true,
      errors: ["File Excel kosong atau tidak memiliki lembar kerja (worksheet)."],
    }
  }

  // Cari sheet nilai (default sheet pertama, atau sheet yang memiliki nama 'nilai')
  let sheetName = wb.SheetNames[0]
  for (const name of wb.SheetNames) {
    if (name.toLowerCase().includes("nilai")) {
      sheetName = name
      break
    }
  }

  const sheet = wb.Sheets[sheetName]
  const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })

  if (rawData.length === 0) {
    return {
      fileName,
      sheetName,
      totalRows: 0,
      matchedCriteria: [],
      unmatchedColumns: [],
      rows: [],
      enrolledMatchCount: 0,
      newStudentCount: 0,
      totalGradeUpdates: 0,
      hasDescriptionColumns: false,
      hasErrors: true,
      errors: [`Lembar kerja "${sheetName}" tidak memiliki data.`],
    }
  }

  // Cari baris header yang memuat kolom "NRP" atau "NIM"
  let headerRowIndex = -1
  let nrpColIndex = -1
  let namaColIndex = -1

  for (let r = 0; r < Math.min(rawData.length, 10); r++) {
    const row = rawData[r]
    if (!Array.isArray(row)) continue
    for (let c = 0; c < row.length; c++) {
      const cellVal = String(row[c] ?? "").trim().toLowerCase()
      if (cellVal === "nrp" || cellVal === "nim" || cellVal === "student id" || cellVal === "student_id") {
        headerRowIndex = r
        nrpColIndex = c
        break
      }
    }
    if (headerRowIndex !== -1) break
  }

  if (headerRowIndex === -1 || nrpColIndex === -1) {
    return {
      fileName,
      sheetName,
      totalRows: 0,
      matchedCriteria: [],
      unmatchedColumns: [],
      rows: [],
      enrolledMatchCount: 0,
      newStudentCount: 0,
      totalGradeUpdates: 0,
      hasDescriptionColumns: false,
      hasErrors: true,
      errors: [
        "Kolom 'NRP' tidak ditemukan pada baris header file Excel. Pastikan terdapat kolom dengan judul 'NRP'.",
      ],
    }
  }

  const headerRow = rawData[headerRowIndex] as unknown[]

  // Cari kolom Nama jika ada
  for (let c = 0; c < headerRow.length; c++) {
    if (c === nrpColIndex) continue
    const cellVal = String(headerRow[c] ?? "").trim().toLowerCase()
    if (cellVal.includes("nama") || cellVal === "name" || cellVal.includes("student name")) {
      namaColIndex = c
      break
    }
  }

  // Cocokkan kolom-kolom kriteria (baik kolom Nilai maupun kolom Deskripsi/Catatan)
  const matchedCriteriaMap = new Map<string, MatchedCriteriaCol>()
  for (const crit of criteriaList) {
    matchedCriteriaMap.set(crit.judulkriteria.toLowerCase(), {
      judulkriteria: crit.judulkriteria,
      bobot: crit.bobot,
      gradeColIndex: -1,
      descColIndex: -1,
      gradeHeaderName: "",
      defaultKriteria: crit.kriteria ?? "",
    })
  }

  const matchedColIndices = new Set<number>([nrpColIndex])
  if (namaColIndex !== -1) matchedColIndices.add(namaColIndex)

  const unmatchedColumns: string[] = []
  let hasDescriptionColumns = false

  for (let c = 0; c < headerRow.length; c++) {
    if (c === nrpColIndex || c === namaColIndex) continue
    const rawHeader = String(headerRow[c] ?? "").trim()
    if (!rawHeader) continue

    const isDescCol = /deskripsi|catatan|komentar|rubrik|feedback/i.test(rawHeader)
    const normHeader = normalizeHeader(rawHeader)

    let matchedCrit: CriteriaItem | null = null

    for (const crit of criteriaList) {
      const normCrit = normalizeHeader(crit.judulkriteria)
      const rawLower = rawHeader.toLowerCase()
      const critLower = crit.judulkriteria.toLowerCase()

      if (
        normHeader === normCrit ||
        rawLower.includes(critLower) ||
        (normCrit.length > 2 && normHeader.includes(normCrit))
      ) {
        matchedCrit = crit
        break
      }
    }

    if (matchedCrit) {
      const item = matchedCriteriaMap.get(matchedCrit.judulkriteria.toLowerCase())!
      if (isDescCol) {
        item.descColIndex = c
        item.descHeaderName = rawHeader
        hasDescriptionColumns = true
      } else {
        item.gradeColIndex = c
        item.gradeHeaderName = rawHeader
      }
      matchedColIndices.add(c)
    } else {
      unmatchedColumns.push(rawHeader)
    }
  }

  // Filter kriteria yang berhasil dicocokkan (minimal memiliki kolom nilai)
  const matchedCriteria = Array.from(matchedCriteriaMap.values()).filter(
    (mc) => mc.gradeColIndex !== -1
  )

  if (matchedCriteria.length === 0) {
    errors.push(
      `Tidak ada kolom nilai kriteria yang cocok dengan kriteria mata kuliah saat ini (${criteriaList
        .map((c) => c.judulkriteria)
        .join(", ")}).`
    )
  }

  // Parse data baris mahasiswa (langsung dari baris setelah header)
  const parsedRows: ParseResultRow[] = []
  let enrolledMatchCount = 0
  let newStudentCount = 0
  let totalGradeUpdates = 0

  for (let r = headerRowIndex + 1; r < rawData.length; r++) {
    const row = rawData[r]
    if (!Array.isArray(row) || row.length === 0) continue

    const rawNrp = String(row[nrpColIndex] ?? "").trim()
    // Abaikan baris kosong atau baris keterangan non-mahasiswa
    if (!rawNrp) continue
    if (
      rawNrp.toLowerCase().includes("petunjuk") ||
      rawNrp.toLowerCase().includes("keterangan") ||
      rawNrp.toLowerCase().includes("rubrik") ||
      rawNrp.toLowerCase().includes("deskripsi") ||
      rawNrp.startsWith("[")
    ) {
      continue
    }

    const cleanNrp = rawNrp
    const rawNama = namaColIndex !== -1 ? String(row[namaColIndex] ?? "").trim() : ""

    const enrolledMatch = enrolledNrpMap.get(cleanNrp.toLowerCase())
    const isEnrolled = !!enrolledMatch
    const displayName = enrolledMatch ? enrolledMatch.nama : rawNama || cleanNrp

    if (isEnrolled) {
      enrolledMatchCount++
    } else {
      newStudentCount++
    }

    const rowGrades: Record<string, { value: number | null; raw: unknown; isValid: boolean; error?: string }> = {}
    const rowComments: Record<string, { value: string; isCustom: boolean }> = {}
    const messages: string[] = []
    let hasRowError = false
    let hasRowWarning = false

    if (!isEnrolled) {
      hasRowWarning = true
      messages.push("Mahasiswa baru (belum terdaftar di mata kuliah)")
    }

    for (const mc of matchedCriteria) {
      // 1. Parse Nilai (berbasis bobot poin maksimal)
      const cellGrade = mc.gradeColIndex !== -1 ? row[mc.gradeColIndex] : undefined
      const strGrade = cellGrade !== undefined && cellGrade !== null ? String(cellGrade).trim() : ""

      if (strGrade === "") {
        rowGrades[mc.judulkriteria] = {
          value: null,
          raw: cellGrade,
          isValid: true,
        }
      } else {
        const normalizedNumStr = strGrade.replace(",", ".")
        const num = Number(normalizedNumStr)

        if (isNaN(num)) {
          hasRowError = true
          rowGrades[mc.judulkriteria] = {
            value: null,
            raw: cellGrade,
            isValid: false,
            error: `Nilai "${strGrade}" bukan angka valid`,
          }
          messages.push(`Nilai ${mc.judulkriteria} ("${strGrade}") bukan angka valid`)
        } else if (num < 0 || (mc.bobot > 0 && num > mc.bobot)) {
          hasRowWarning = true
          rowGrades[mc.judulkriteria] = {
            value: num,
            raw: cellGrade,
            isValid: false,
            error: `Nilai (${num}) melebihi bobot maksimal (${mc.bobot})`,
          }
          messages.push(`Nilai ${mc.judulkriteria} (${num}) melebihi bobot maksimal (${mc.bobot})`)
        } else {
          rowGrades[mc.judulkriteria] = {
            value: num,
            raw: cellGrade,
            isValid: true,
          }
          totalGradeUpdates++
        }
      }

      // 2. Parse Deskripsi Rubrik / Catatan Khusus Mahasiswa
      let descVal = mc.defaultKriteria
      let isCustom = false

      if (mc.descColIndex !== -1) {
        const cellDesc = row[mc.descColIndex]
        const strDesc = cellDesc !== undefined && cellDesc !== null ? String(cellDesc).trim() : ""
        if (strDesc !== "" && strDesc !== "—") {
          descVal = strDesc
          isCustom = true
        }
      }

      rowComments[mc.judulkriteria] = {
        value: descVal,
        isCustom,
      }
    }

    let status: "valid" | "warning" | "new_student" | "error" = "valid"
    if (hasRowError) status = "error"
    else if (!isEnrolled) status = "new_student"
    else if (hasRowWarning) status = "warning"

    parsedRows.push({
      rowIndex: r + 1,
      nrp: cleanNrp,
      nama: displayName,
      isEnrolled,
      matchedGrades: rowGrades,
      matchedComments: rowComments,
      status,
      messages,
    })
  }

  return {
    fileName,
    sheetName,
    totalRows: parsedRows.length,
    matchedCriteria,
    unmatchedColumns,
    rows: parsedRows,
    enrolledMatchCount,
    newStudentCount,
    totalGradeUpdates,
    hasDescriptionColumns,
    hasErrors: errors.length > 0,
    errors,
  }
}
