"use client"

import "./EvaluationForm.css"
import { useState } from "react"
import { useRouter } from "next/navigation"

type Peer = {
  nrp: string
  nama: string | null
}

type Kriteria = {
  idkriteria: number
  namakriteria: string | null
  bobot: number | null
}

type Props = {
  evaluatorNrp: string
  peers: Peer[]
  kriteriaList: Kriteria[]
  alreadySubmitted: boolean
  idkuliah: number
}

// scores[idkriteria][peerNrp] = points (each criteria column sums to 100)
type ScoreMap = Record<number, Record<string, number>>

function weightedAvg(
  nrp: string,
  scores: ScoreMap,
  kriteriaList: Kriteria[],
  touched: Record<string, boolean>
): number | null {
  const totalBobot = kriteriaList.reduce((a, k) => a + (k.bobot ?? 0), 0)
  if (totalBobot === 0) return null
  const allFilled = kriteriaList.every(
    (k) => touched[`${k.idkriteria}-${nrp}`] === true
  )
  if (!allFilled) return null
  const weighted = kriteriaList.reduce((a, k) => {
    return a + (scores[k.idkriteria]?.[nrp] ?? 0) * (k.bobot ?? 0)
  }, 0)
  return Math.round((weighted / totalBobot) * 10) / 10
}

function kriteriaTotal(idkriteria: number, scores: ScoreMap, peers: Peer[]) {
  return peers.reduce((a, p) => a + (scores[idkriteria]?.[p.nrp] ?? 0), 0)
}

function allReady(scores: ScoreMap, kriteriaList: Kriteria[], peers: Peer[]): boolean {
  return kriteriaList.every((k) => kriteriaTotal(k.idkriteria, scores, peers) === 100)
}

export default function EvaluationForm({
  evaluatorNrp,
  peers,
  kriteriaList,
  alreadySubmitted,
  idkuliah,
}: Props) {
  const router = useRouter()

  const [scores, setScores] = useState<ScoreMap>(
    Object.fromEntries(kriteriaList.map((k) => [k.idkriteria, {}]))
  )
  // tracks which (idkriteria, nrp) cells have been explicitly filled by the user
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  const ready = allReady(scores, kriteriaList, peers)

  function handleChange(idkriteria: number, nrp: string, raw: string) {
    const val = Math.max(0, Math.min(100, raw === "" ? 0 : (parseInt(raw) ?? 0)))
    const otherTotal = peers
      .filter((p) => p.nrp !== nrp)
      .reduce((a, p) => a + (scores[idkriteria]?.[p.nrp] ?? 0), 0)
    const clamped = Math.min(val, 100 - otherTotal)

    const newScores = { ...scores, [idkriteria]: { ...scores[idkriteria], [nrp]: clamped } }
    const newTotal = peers.reduce((a, p) => a + (newScores[idkriteria]?.[p.nrp] ?? 0), 0)

    setScores(newScores)
    setTouched((prev) => {
      const next = { ...prev, [`${idkriteria}-${nrp}`]: true }
      // if column now sums to 100, auto-mark all untouched peers in this column
      if (newTotal === 100) {
        peers.forEach((p) => {
          next[`${idkriteria}-${p.nrp}`] = true
        })
      }
      return next
    })
  }

  async function handleSubmit() {
    if (!ready) return
    setStatus("loading")
    setErrorMsg("")
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evaluatorNrp, scores, idkuliah }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Unknown error")
      setStatus("done")
      router.refresh()
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong.")
      setStatus("error")
    }
  }

  if (alreadySubmitted || status === "done") {
    return (
      <>
        <div className="ev-done">
          <div className="ev-done-icon">✓</div>
          <h2 className="ev-done-title">Evaluation submitted</h2>
          <p className="ev-done-sub">Your peer grades for this course have been recorded.</p>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="ev-form">

        {/* Column headers: one per criteria */}
        <div className="ev-grid-header">
          <div className="ev-col-peer" />
          {kriteriaList.map((k) => {
            const total = kriteriaTotal(k.idkriteria, scores, peers)
            const done = total === 100
            const over = total > 100
            return (
              <div key={k.idkriteria} className="ev-col-k">
                <span className="ev-k-name">{k.namakriteria}</span>
                <span className="ev-k-bobot">{k.bobot}%</span>
                <div className={`ev-k-total ${done ? "done" : over ? "over" : ""}`}>
                  <div
                    className="ev-k-total-bar"
                    style={{ width: `${Math.min(total, 100)}%` }}
                  />
                  <span className="ev-k-total-label">
                    {done ? "✓ 100" : `${total}/100`}
                  </span>
                </div>
              </div>
            )
          })}
          <div className="ev-col-avg">Avg</div>
        </div>

        {/* Peer rows */}
        <div className="ev-peers">
          {peers.map((peer) => {
            const avg = weightedAvg(peer.nrp, scores, kriteriaList, touched)
            return (
              <div key={peer.nrp} className="ev-peer-row">
                {/* Identity */}
                <div className="ev-col-peer ev-peer-info">
                  <div className="ev-avatar-wrap">
                    <div
                      className="ev-peer-avatar"
                      title={`${peer.nama ?? ""} (${peer.nrp})`}
                      onClick={() =>
                        setActiveTooltip(activeTooltip === peer.nrp ? null : peer.nrp)
                      }
                    >
                      {(peer.nama ?? peer.nrp).charAt(0).toUpperCase()}
                    </div>
                    {activeTooltip === peer.nrp && (
                      <div className="ev-avatar-tooltip">
                        <strong>{peer.nama ?? peer.nrp}</strong>
                        <span>{peer.nrp}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="ev-peer-name">{peer.nama ?? "—"}</p>
                    <p className="ev-peer-nrp">{peer.nrp}</p>
                  </div>
                </div>

                {/* Input per criteria */}
                {kriteriaList.map((k) => {
                  const val = scores[k.idkriteria]?.[peer.nrp] ?? 0
                  return (
                    <div key={k.idkriteria} className="ev-col-k ev-score-cell">
                      <input
                        className={`ev-score-input${val > 0 ? " filled" : ""}`}
                        type="number"
                        min={0}
                        max={100}
                        placeholder="0"
                        value={val === 0 ? "" : val}
                        onChange={(e) =>
                          handleChange(k.idkriteria, peer.nrp, e.target.value)
                        }
                      />
                      <div
                        className="ev-score-bar"
                        style={{ width: `${val}%` }}
                      />
                    </div>
                  )
                })}

                {/* Weighted avg */}
                <div className="ev-col-avg ev-peer-avg">
                  {avg !== null ? (
                    <span
                      className={`ev-avg-val ${
                        avg >= 70 ? "high" : avg >= 50 ? "mid" : "low"
                      }`}
                    >
                      {avg.toFixed(1)}
                    </span>
                  ) : (
                    <span className="ev-avg-empty">—</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Overall status */}
        <div className={`ev-status-bar${ready ? " ready" : ""}`}>
          <span className="ev-status-text">
            {ready
              ? "All criteria complete — ready to submit"
              : `${kriteriaList.filter(
                  (k) => kriteriaTotal(k.idkriteria, scores, peers) === 100
                ).length} / ${kriteriaList.length} criteria complete`}
          </span>
        </div>

        {errorMsg && <p className="ev-error">{errorMsg}</p>}

        <button
          className="ev-submit"
          onClick={handleSubmit}
          disabled={!ready || status === "loading"}
        >
          {status === "loading" ? "Submitting…" : "Submit evaluation"}
        </button>
      </div>
    </>
  )
}