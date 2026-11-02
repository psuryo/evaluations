export type KriteriaTipe = "KELOMPOK" | "INDIVIDU"

export interface KriteriaLite {
  id: number
  nama: string
  tipe: string
  bobot: number
}

export interface MemberScoreInput {
  nrp: string
  timId: number
}

/**
 * Nilai total per individu = Σ(nilai × bobot) / Σ(bobot kriteria) .
 * Kriteria kelompok memakai nilai tim; kriteria individu memakai nilai pribadi.
 * Nilai kosong dihitung 0. Bila total bobot = 100, hasilnya setara skala nilai.
 */
export function computeTotal(
  member: MemberScoreInput,
  kriteria: KriteriaLite[],
  nilaiTim: Map<string, number | null>, // key `${kriteriaId}:${timId}`
  nilaiIndividu: Map<string, number | null> // key `${kriteriaId}:${nrp}`
): { total: number; complete: boolean } {
  const totalBobot = kriteria.reduce((s, k) => s + (k.bobot || 0), 0)
  if (totalBobot <= 0) return { total: 0, complete: false }
  let sum = 0
  let complete = true
  for (const k of kriteria) {
    const v =
      k.tipe === "KELOMPOK"
        ? nilaiTim.get(`${k.id}:${member.timId}`)
        : nilaiIndividu.get(`${k.id}:${member.nrp}`)
    if (v === null || v === undefined) complete = false
    sum += (v ?? 0) * (k.bobot || 0)
  }
  return { total: sum / totalBobot, complete }
}
