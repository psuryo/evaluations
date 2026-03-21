"use client"

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
  kriteriaList: Kriteria[]
): number | null {
  const totalBobot = kriteriaList.reduce((a, k) => a + (k.bobot ?? 0), 0)
  if (totalBobot === 0) return null
  const allFilled = kriteriaList.every(
    (k) => (scores[k.idkriteria]?.[nrp] ?? -1) >= 0
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
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  const ready = allReady(scores, kriteriaList, peers)

  function handleChange(idkriteria: number, nrp: string, raw: string) {
    const val = Math.max(0, Math.min(100, parseInt(raw) || 0))
    const otherTotal = peers
      .filter((p) => p.nrp !== nrp)
      .reduce((a, p) => a + (scores[idkriteria]?.[p.nrp] ?? 0), 0)
    const clamped = Math.min(val, 100 - otherTotal)
    setScores((prev) => ({
      ...prev,
      [idkriteria]: { ...prev[idkriteria], [nrp]: clamped },
    }))
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
        <style>{doneStyles}</style>
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
      <style>{formStyles}</style>
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
            const avg = weightedAvg(peer.nrp, scores, kriteriaList)
            return (
              <div key={peer.nrp} className="ev-peer-row">
                {/* Identity */}
                <div className="ev-col-peer ev-peer-info">
                  <span className="ev-peer-avatar">
                    {(peer.nama ?? peer.nrp).charAt(0).toUpperCase()}
                  </span>
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

const formStyles = `
  .ev-form { display: flex; flex-direction: column; gap: 10px; font-family: 'Sora', system-ui, sans-serif; }

  /* Grid layout: peer col + one col per criteria + avg col */
  .ev-grid-header,
  .ev-peer-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .ev-col-peer { width: 160px; flex-shrink: 0; }
  .ev-col-k    { flex: 1; min-width: 0; }
  .ev-col-avg  { width: 52px; flex-shrink: 0; text-align: center; }

  /* Header */
  .ev-grid-header { padding: 0 14px 10px; border-bottom: 0.5px solid rgba(0,0,0,0.07); align-items: flex-end; }
  .ev-col-k { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .ev-k-name { font-size: 10px; color: #888; text-align: center; line-height: 1.3; }
  .ev-k-bobot { font-size: 9px; color: #625f5f; background: #f3df91; padding: 1px 5px; border-radius: 20px; }
  .ev-col-avg { font-size: 10px; font-weight: 500; letter-spacing: 0.07em; text-transform: uppercase; color: #bbb; }

  /* Per-criteria running total */
  .ev-k-total {
    width: 100%; background: #f0efeb; border-radius: 4px;
    overflow: hidden; position: relative; height: 18px;
    display: flex; align-items: center; justify-content: center;
  }
  .ev-k-total-bar {
    position: absolute; left: 0; top: 0; bottom: 0;
    background: #ddd; border-radius: 4px; transition: width 0.15s;
  }
  .ev-k-total.done .ev-k-total-bar  { background: #a8d8bc; }
  .ev-k-total.over .ev-k-total-bar  { background: #f0b0a8; }
  .ev-k-total-label {
    position: relative; z-index: 1;
    font-size: 9px; font-weight: 500; color: #888;
    white-space: nowrap;
  }
  .ev-k-total.done .ev-k-total-label { color: #2d6e4e; }
  .ev-k-total.over .ev-k-total-label { color: #a03030; }

  /* Peer rows */
  .ev-peers { display: flex; flex-direction: column; gap: 7px; }
  .ev-peer-row { background: #fff; border: 0.5px solid rgba(0,0,0,0.07); border-radius: 10px; padding: 10px 14px; }

  .ev-peer-info { display: flex; align-items: center; gap: 8px; }
  .ev-peer-avatar { width: 28px; height: 28px; border-radius: 50%; background: #f0efeb; color: #555; font-size: 11px; font-weight: 500; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .ev-peer-name { font-size: 10px; font-weight: 500; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ev-peer-nrp { font-size: 8px; color: #737272; }

  /* Score input cells */
  .ev-score-cell { display: flex; flex-direction: column; align-items: center; gap: 3px; }
  .ev-score-input {
    width: 100%; font-family: inherit; font-size: 15px; font-weight: 500;
    color: #ccc; text-align: center; border: 0.5px solid rgba(0,0,0,0.08);
    border-radius: 6px; padding: 5px 2px; background: #fafaf8; outline: none;
    transition: border-color 0.15s, color 0.15s;
    -moz-appearance: textfield;
  }
  .ev-score-input::-webkit-outer-spin-button,
  .ev-score-input::-webkit-inner-spin-button { -webkit-appearance: none; }
  .ev-score-input:focus { border-color: #888; background: #fff; color: #111; }
  .ev-score-input.filled { color: #111; border-color: rgba(0,0,0,0.15); background: #fff; }
  .ev-score-bar { width: 100%; height: 2px; background: #141414; border-radius: 99px; transition: width 0.15s; }

  /* Avg */
  .ev-peer-avg { display: flex; align-items: center; justify-content: center; }
  .ev-avg-val { font-family: 'Sora', system-ui, sans-serif; font-size: 17px; line-height: 1; }
  .ev-avg-val.high { color: #1f6b45; }
  .ev-avg-val.mid  { color: #8a6200; }
  .ev-avg-val.low  { color: #a03030; }
  .ev-avg-empty { font-size: 13px; color: #ddd; }

  /* Status + submit */
  .ev-status-bar { border: 0.5px solid rgba(0,0,0,0.07); border-radius: 8px; padding: 9px 14px; background: #fafaf8; }
  .ev-status-bar.ready { border-color: #a8d8bc; background: #f2faf6; }
  .ev-status-text { font-size: 12px; color: #aaa; }
  .ev-status-bar.ready .ev-status-text { color: #2d6e4e; }

  .ev-error { font-size: 13px; color: #c0392b; }

  .ev-submit { width: 100%; padding: 13px; font-family: inherit; font-size: 14px; font-weight: 500; color: #fff; background: #111; border: none; border-radius: 8px; cursor: pointer; letter-spacing: 0.02em; transition: opacity 0.15s, transform 0.1s; }
  .ev-submit:hover:not(:disabled) { opacity: 0.8; }
  .ev-submit:active:not(:disabled) { transform: scale(0.99); }
  .ev-submit:disabled { opacity: 0.35; cursor: default; }

  @media (max-width: 680px) {
    .ev-col-peer { width: 90px; }
    .ev-k-name { font-size: 9px; }
    .ev-score-input { font-size: 13px; }
  }
`

const doneStyles = `
  .ev-done { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 24px; text-align: center; gap: 12px; font-family: 'Sora', system-ui, sans-serif; }
  .ev-done-icon { width: 48px; height: 48px; border-radius: 50%; background: #f0faf5; border: 0.5px solid #a8d8bc; color: #2d8a5e; font-size: 20px; display: flex; align-items: center; justify-content: center; margin-bottom: 4px; }
  .ev-done-title { font-family: 'Sora', system-ui, sans-serif; font-size: 24px; font-weight: 600; color: #111; }
  .ev-done-sub { font-size: 14px; color: #aaa; font-weight: 300; }
`
