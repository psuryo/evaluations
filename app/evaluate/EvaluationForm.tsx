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

export default function EvaluationForm({
  evaluatorNrp,
  peers,
  kriteriaList,
  alreadySubmitted,
  idkuliah,
}: Props) {
  const router = useRouter()
  const [points, setPoints] = useState<Record<string, number>>(
    Object.fromEntries(peers.map((p) => [p.nrp, 0]))
  )
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  const total = Object.values(points).reduce((a, b) => a + b, 0)
  const remaining = 100 - total

  function handleChange(nrp: string, raw: string) {
    const val = Math.max(0, Math.min(100, parseInt(raw) || 0))
    const otherTotal = Object.entries(points)
      .filter(([k]) => k !== nrp)
      .reduce((a, [, v]) => a + v, 0)
    setPoints((prev) => ({ ...prev, [nrp]: Math.min(val, 100 - otherTotal) }))
  }

  async function handleSubmit() {
    if (total !== 100) {
      setErrorMsg(`Total must be exactly 100. Currently ${total}.`)
      return
    }
    setStatus("loading")
    setErrorMsg("")
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evaluatorNrp, points, idkuliah }),
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

        {/* Kriteria reference pills */}
        <div className="ev-criteria-box">
          <p className="ev-criteria-label">Grading dimensions</p>
          <div className="ev-criteria-pills">
            {kriteriaList.map((k) => (
              <span key={k.idkriteria} className="ev-pill">
                {k.namakriteria}
                <span className="ev-pill-bobot">{k.bobot}</span>
              </span>
            ))}
          </div>
          <p className="ev-criteria-hint">
            Consider each dimension when distributing your points.
          </p>
        </div>

        {/* Peer rows */}
        <div className="ev-peers">
          {peers.map((peer) => {
            const val = points[peer.nrp] ?? 0
            return (
              <div key={peer.nrp} className="ev-peer-row">
                <div className="ev-peer-info">
                  <span className="ev-peer-avatar">
                    {(peer.nama ?? peer.nrp).charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p className="ev-peer-name">{peer.nama ?? "—"}</p>
                    <p className="ev-peer-nrp">{peer.nrp}</p>
                  </div>
                </div>
                <div className="ev-peer-input-wrap">
                  <div className="ev-bar-track">
                    <div className="ev-bar-fill" style={{ width: `${val}%` }} />
                  </div>
                  <div className="ev-number-wrap">
                    <input
                      className="ev-number"
                      type="number"
                      min={0}
                      max={100}
                      value={val === 0 ? "" : val}
                      placeholder="0"
                      onChange={(e) => handleChange(peer.nrp, e.target.value)}
                    />
                    <span className="ev-pts">pts</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Total indicator */}
        <div className={`ev-total${total === 100 ? " ev-total-ok" : total > 100 ? " ev-total-over" : ""}`}>
          <div className="ev-total-bar-track">
            <div className="ev-total-bar-fill" style={{ width: `${Math.min(total, 100)}%` }} />
          </div>
          <div className="ev-total-row">
            <span className="ev-total-label">
              {total === 100
                ? "100 / 100 — ready to submit"
                : total > 100
                ? `${total} / 100 — over by ${total - 100}`
                : `${total} / 100 — ${remaining} remaining`}
            </span>
            <span className="ev-total-num">{total}</span>
          </div>
        </div>

        {errorMsg && <p className="ev-error">{errorMsg}</p>}

        <button
          className="ev-submit"
          onClick={handleSubmit}
          disabled={status === "loading" || total !== 100}
        >
          {status === "loading" ? "Submitting…" : "Submit evaluation"}
        </button>
      </div>
    </>
  )
}

const formStyles = `
  .ev-form { display: flex; flex-direction: column; gap: 16px; }

  .ev-criteria-box { background: #fafaf8; border: 0.5px solid rgba(0,0,0,0.08); border-radius: 10px; padding: 14px 16px; }
  .ev-criteria-label { font-size: 10px; font-weight: 500; letter-spacing: 0.07em; text-transform: uppercase; color: #bbb; margin-bottom: 8px; font-family: 'DM Sans', system-ui, sans-serif; }
  .ev-criteria-pills { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
  .ev-pill { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #444; background: #fff; border: 0.5px solid rgba(0,0,0,0.1); border-radius: 20px; padding: 3px 10px; font-family: 'DM Sans', system-ui, sans-serif; }
  .ev-pill-bobot { font-size: 10px; color: #bbb; background: #f0efeb; padding: 1px 6px; border-radius: 20px; }
  .ev-criteria-hint { font-size: 11px; color: #ccc; font-weight: 300; line-height: 1.5; font-family: 'DM Sans', system-ui, sans-serif; }

  .ev-peers { display: flex; flex-direction: column; gap: 10px; }
  .ev-peer-row { background: #fff; border: 0.5px solid rgba(0,0,0,0.07); border-radius: 10px; padding: 14px 16px; display: flex; align-items: center; gap: 14px; }
  .ev-peer-info { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
  .ev-peer-avatar { width: 34px; height: 34px; border-radius: 50%; background: #f0efeb; color: #555; font-size: 13px; font-weight: 500; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-family: 'DM Sans', system-ui, sans-serif; }
  .ev-peer-name { font-size: 14px; font-weight: 500; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: 'DM Sans', system-ui, sans-serif; }
  .ev-peer-nrp { font-size: 11px; color: #bbb; margin-top: 1px; font-family: 'DM Sans', system-ui, sans-serif; }
  .ev-peer-input-wrap { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; flex-shrink: 0; width: 110px; }
  .ev-bar-track { width: 100%; height: 3px; background: #f0efeb; border-radius: 99px; overflow: hidden; }
  .ev-bar-fill { height: 100%; background: #141414; border-radius: 99px; transition: width 0.15s ease; }
  .ev-number-wrap { display: flex; align-items: baseline; gap: 3px; }
  .ev-number { width: 48px; font-family: 'DM Sans', system-ui, sans-serif; font-size: 20px; font-weight: 500; color: #111; text-align: right; border: none; outline: none; background: transparent; -moz-appearance: textfield; }
  .ev-number::-webkit-outer-spin-button, .ev-number::-webkit-inner-spin-button { -webkit-appearance: none; }
  .ev-pts { font-size: 12px; color: #bbb; font-family: 'DM Sans', system-ui, sans-serif; }

  .ev-total { border: 0.5px solid rgba(0,0,0,0.07); border-radius: 10px; padding: 12px 16px; background: #fff; display: flex; flex-direction: column; gap: 7px; transition: border-color 0.2s, background 0.2s; }
  .ev-total-ok  { border-color: #a8d8bc; background: #f2faf6; }
  .ev-total-over { border-color: #f0b0a8; background: #fdf3f2; }
  .ev-total-bar-track { height: 3px; background: #f0efeb; border-radius: 99px; overflow: hidden; }
  .ev-total-bar-fill { height: 100%; background: #141414; border-radius: 99px; transition: width 0.15s ease; }
  .ev-total-ok  .ev-total-bar-fill { background: #2d8a5e; }
  .ev-total-over .ev-total-bar-fill { background: #c0392b; }
  .ev-total-row { display: flex; justify-content: space-between; align-items: baseline; }
  .ev-total-label { font-size: 12px; color: #999; font-family: 'DM Sans', system-ui, sans-serif; }
  .ev-total-ok  .ev-total-label { color: #2d6e4e; }
  .ev-total-over .ev-total-label { color: #a03030; }
  .ev-total-num { font-family: 'Instrument Serif', Georgia, serif; font-size: 26px; color: #111; line-height: 1; }
  .ev-total-ok  .ev-total-num { color: #1f6b45; }
  .ev-total-over .ev-total-num { color: #c0392b; }

  .ev-error { font-size: 13px; color: #c0392b; font-family: 'DM Sans', system-ui, sans-serif; }

  .ev-submit { width: 100%; padding: 13px; font-family: 'DM Sans', system-ui, sans-serif; font-size: 14px; font-weight: 500; color: #fff; background: #111; border: none; border-radius: 8px; cursor: pointer; letter-spacing: 0.02em; transition: opacity 0.15s, transform 0.1s; }
  .ev-submit:hover:not(:disabled) { opacity: 0.8; }
  .ev-submit:active:not(:disabled) { transform: scale(0.99); }
  .ev-submit:disabled { opacity: 0.35; cursor: default; }
`

const doneStyles = `
  .ev-done { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 24px; text-align: center; gap: 12px; font-family: 'DM Sans', system-ui, sans-serif; }
  .ev-done-icon { width: 48px; height: 48px; border-radius: 50%; background: #f0faf5; border: 0.5px solid #a8d8bc; color: #2d8a5e; font-size: 20px; display: flex; align-items: center; justify-content: center; margin-bottom: 4px; }
  .ev-done-title { font-family: 'Instrument Serif', Georgia, serif; font-size: 24px; font-weight: 400; color: #111; }
  .ev-done-sub { font-size: 14px; color: #aaa; font-weight: 300; }
`
