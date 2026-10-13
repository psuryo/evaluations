"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import MarkdownViewer from "./MarkdownViewer"

interface AnswerKeyModalProps {
  isOpen: boolean
  onClose: () => void
  matkul: string
  tahun: string
  content?: string | null
  idkuliah?: number | null
}

export default function AnswerKeyModal({
  isOpen,
  onClose,
  matkul,
  tahun,
  content,
  idkuliah,
}: AnswerKeyModalProps) {
  const [activeTab, setActiveTab] = useState<"preview" | "raw">("preview")
  const [copied, setCopied] = useState(false)

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    // Prevent background scrolling when modal is open
    document.body.style.overflow = "hidden"

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = "auto"
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleCopy = () => {
    if (!content) return
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <style>{`
        .ak-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 20px;
          animation: akFadeIn 0.18s ease-out;
        }

        @keyframes akFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .ak-modal {
          background: #fff;
          border-radius: 14px;
          box-shadow: 0 20px 45px rgba(0, 0, 0, 0.18);
          border: 0.5px solid rgba(0, 0, 0, 0.1);
          width: 100%;
          max-width: 820px;
          max-height: 88vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: akSlideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes akSlideUp {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .ak-header {
          padding: 18px 24px;
          border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #fbfbf9;
          gap: 16px;
        }

        .ak-title-area {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }

        .ak-header-top-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .ak-title {
          font-family: 'Sora', sans-serif;
          font-size: 16px;
          font-weight: 600;
          color: #111;
        }

        .ak-badge-key {
          font-size: 11px;
          font-weight: 600;
          color: #92341e;
          background: #fcf1ee;
          border: 0.5px solid #f2c7bc;
          padding: 2px 7px;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .ak-subtitle {
          font-size: 12.5px;
          color: #666;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .ak-year-pill {
          background: #eee;
          padding: 1px 6px;
          border-radius: 4px;
          font-size: 11px;
          color: #555;
        }

        .ak-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .ak-tab-btn {
          font-family: 'Sora', sans-serif;
          font-size: 12px;
          padding: 5px 10px;
          border-radius: 6px;
          border: 0.5px solid rgba(0,0,0,0.12);
          background: #fff;
          color: #555;
          cursor: pointer;
          transition: all 0.15s;
        }
        .ak-tab-btn.active {
          background: #111;
          color: #fff;
          border-color: #111;
        }

        .ak-copy-btn {
          font-family: 'Sora', sans-serif;
          font-size: 12px;
          padding: 5px 12px;
          border-radius: 6px;
          border: 0.5px solid rgba(0,0,0,0.12);
          background: #fff;
          color: #111;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          transition: all 0.15s;
        }
        .ak-copy-btn:hover {
          background: #f5f4f0;
          border-color: rgba(0,0,0,0.25);
        }

        .ak-close-btn {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: none;
          background: #ecebe6;
          color: #444;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          transition: all 0.15s;
        }
        .ak-close-btn:hover {
          background: #dedcd5;
          color: #111;
        }

        .ak-content {
          padding: 24px 28px;
          overflow-y: auto;
          flex: 1;
          background: #fff;
        }

        .ak-raw-viewer {
          font-family: 'Consolas', 'Monaco', monospace;
          font-size: 13px;
          line-height: 1.55;
          color: #24292e;
          background: #f8f7f4;
          padding: 16px;
          border-radius: 8px;
          border: 0.5px solid rgba(0,0,0,0.08);
          white-space: pre-wrap;
          word-break: break-word;
        }

        .ak-empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #888;
        }
        .ak-empty-icon {
          font-size: 32px;
          margin-bottom: 10px;
        }

        .ak-footer {
          padding: 12px 24px;
          border-top: 0.5px solid rgba(0,0,0,0.08);
          background: #fbfbf9;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: #888;
        }

        .ak-footer-close-btn {
          font-family: 'Sora', sans-serif;
          font-size: 12.5px;
          padding: 6px 16px;
          border-radius: 6px;
          border: 0.5px solid rgba(0,0,0,0.15);
          background: #111;
          color: #fff;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .ak-footer-close-btn:hover {
          opacity: 0.85;
        }

        .ak-edit-link {
          font-family: 'Sora', sans-serif;
          font-size: 12px;
          font-weight: 500;
          color: #111;
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.2);
          border-radius: 6px;
          padding: 6px 12px;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          transition: all 0.15s ease;
        }
        .ak-edit-link:hover {
          background: #f4f3ef;
          border-color: rgba(0,0,0,0.4);
        }

        @media (max-width: 640px) {
          .ak-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .ak-header-actions {
            width: 100%;
            justify-content: space-between;
          }
          .ak-content {
            padding: 16px;
          }
        }
      `}</style>

      <div
        className="ak-backdrop"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ak-modal-title"
      >
        <div className="ak-modal">
          <header className="ak-header">
            <div className="ak-title-area">
              <div className="ak-header-top-row">
                <span className="ak-badge-key">🔑 Kunci Jawaban</span>
                <h2 id="ak-modal-title" className="ak-title">{matkul}</h2>
              </div>
              <div className="ak-subtitle">
                <span>Tahun Akademik: <strong className="ak-year-pill">{tahun}</strong></span>
                <span>•</span>
                <span>Format Dokumen: Markdown (.md)</span>
              </div>
            </div>

            <div className="ak-header-actions">
              {content && (
                <>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
                      type="button"
                      className={`ak-tab-btn ${activeTab === "preview" ? "active" : ""}`}
                      onClick={() => setActiveTab("preview")}
                    >
                      Tampilan Rapi
                    </button>
                    <button
                      type="button"
                      className={`ak-tab-btn ${activeTab === "raw" ? "active" : ""}`}
                      onClick={() => setActiveTab("raw")}
                    >
                      Markdown Asli
                    </button>
                  </div>
                  <button
                    type="button"
                    className="ak-copy-btn"
                    onClick={handleCopy}
                    title="Salin isi kunci jawaban ke clipboard"
                  >
                    {copied ? "✓ Tersalin" : "Salin"}
                  </button>
                </>
              )}

              <button
                type="button"
                className="ak-close-btn"
                onClick={onClose}
                aria-label="Tutup kunci jawaban"
              >
                ✕
              </button>
            </div>
          </header>

          <main className="ak-content">
            {content && content.trim() ? (
              activeTab === "preview" ? (
                <MarkdownViewer content={content} />
              ) : (
                <pre className="ak-raw-viewer">
                  <code>{content}</code>
                </pre>
              )
            ) : (
              <div className="ak-empty-state">
                <div className="ak-empty-icon">📝</div>
                <p>Belum ada kunci jawaban yang diunggah untuk mata kuliah ini.</p>
                <p style={{ fontSize: "12px", marginTop: "4px", color: "#aaa" }}>
                  Dosen pengampu dapat menambahkan kunci jawaban berformat Markdown pada menu kelola kuliah.
                </p>
              </div>
            )}
          </main>

          <footer className="ak-footer">
            <span>Tekan <kbd style={{ padding: "2px 5px", background: "#eee", borderRadius: "4px", fontSize: "11px" }}>Esc</kbd> untuk menutup</span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {idkuliah && (
                <Link
                  href={`/admin/kuliah/${idkuliah}/edit`}
                  className="ak-edit-link"
                  title="Ubah atau unggah kunci jawaban untuk mata kuliah ini"
                >
                  ✏️ Edit / Upload Kunci
                </Link>
              )}
              <button type="button" className="ak-footer-close-btn" onClick={onClose}>
                Tutup
              </button>
            </div>
          </footer>
        </div>
      </div>
    </>
  )
}
