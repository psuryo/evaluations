"use client"

import React, { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"

interface MarkdownViewerProps {
  content: string
  className?: string
}

function CodeBlock({
  lang,
  code,
  children,
}: {
  lang: string
  code: string
  children: React.ReactNode
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="md-codeblock-wrapper">
      <div className="md-codeblock-header">
        <span className="md-codeblock-lang">{lang || "code"}</span>
        <button
          type="button"
          className="md-codeblock-copy"
          onClick={handleCopy}
          title="Salin kode"
        >
          {copied ? "✓ Tersalin" : "Salin"}
        </button>
      </div>
      <pre className="md-codeblock">{children}</pre>
    </div>
  )
}

export default function MarkdownViewer({ content, className = "" }: MarkdownViewerProps) {
  return (
    <>
      <style>{`
        .md-container {
          font-family: 'Sora', system-ui, -apple-system, sans-serif;
          color: #222;
          line-height: 1.65;
          font-size: 14px;
        }
        .md-h1 {
          font-size: 22px;
          font-weight: 700;
          color: #111;
          margin: 20px 0 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(0,0,0,0.08);
        }
        .md-h2 {
          font-size: 18px;
          font-weight: 600;
          color: #111;
          margin: 18px 0 10px;
          padding-bottom: 6px;
          border-bottom: 0.5px solid rgba(0,0,0,0.06);
        }
        .md-h3 {
          font-size: 15px;
          font-weight: 600;
          color: #222;
          margin: 14px 0 8px;
        }
        .md-h4, .md-h5, .md-h6 {
          font-size: 14px;
          font-weight: 600;
          color: #333;
          margin: 12px 0 6px;
        }
        .md-p {
          margin-bottom: 12px;
          color: #333;
        }
        .md-inline-code {
          font-family: 'Consolas', 'Monaco', monospace;
          background: #f1efe9;
          color: #92341e;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 12.5px;
          border: 0.5px solid rgba(0,0,0,0.06);
        }
        .md-link {
          color: #1a56db;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .md-link:hover {
          color: #1e429f;
        }
        .md-codeblock-wrapper {
          margin: 14px 0;
          border-radius: 8px;
          overflow: hidden;
          background: #18181b;
          border: 0.5px solid #27272a;
        }
        .md-codeblock-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 14px;
          background: #27272a;
          color: #a1a1aa;
          font-size: 11px;
          font-family: monospace;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .md-codeblock-copy {
          background: transparent;
          border: 0.5px solid rgba(255,255,255,0.2);
          color: #e4e4e7;
          border-radius: 4px;
          padding: 2px 8px;
          font-size: 11px;
          cursor: pointer;
          font-family: 'Sora', sans-serif;
          transition: all 0.15s;
        }
        .md-codeblock-copy:hover {
          background: rgba(255,255,255,0.1);
          color: #fff;
        }
        .md-codeblock {
          padding: 14px 16px;
          margin: 0;
          overflow-x: auto;
          color: #f4f4f5;
          font-family: 'Consolas', 'Monaco', monospace;
          font-size: 13px;
          line-height: 1.5;
        }
        .md-blockquote {
          margin: 14px 0;
          padding: 10px 16px;
          background: #faf8f5;
          border-left: 3.5px solid #d4af37;
          border-radius: 0 6px 6px 0;
          color: #555;
          font-style: italic;
        }
        .md-blockquote p {
          margin: 4px 0;
        }
        .md-hr {
          border: none;
          height: 1px;
          background: rgba(0,0,0,0.1);
          margin: 20px 0;
        }
        .md-ul, .md-ol {
          margin: 8px 0 14px 24px;
          color: #333;
        }
        .md-ul li, .md-ol li {
          margin-bottom: 4px;
        }
        .md-task-item {
          list-style-type: none;
          margin-left: -18px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .md-checkbox {
          width: 14px;
          height: 14px;
          accent-color: #111;
          margin: 0;
        }
        .md-table-wrapper {
          overflow-x: auto;
          margin: 14px 0;
          border-radius: 8px;
          border: 0.5px solid rgba(0,0,0,0.1);
        }
        .md-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 13px;
        }
        .md-table th {
          background: #f7f6f2;
          font-weight: 600;
          color: #111;
          padding: 8px 14px;
          border-bottom: 1px solid rgba(0,0,0,0.1);
        }
        .md-table td {
          padding: 8px 14px;
          border-bottom: 0.5px solid rgba(0,0,0,0.06);
          color: #333;
        }
        .md-table tr:last-child td {
          border-bottom: none;
        }
        .md-table tr:hover td {
          background: #fdfdfc;
        }
        /* KaTeX formula rendering */
        .katex-display {
          margin: 14px 0 !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          padding: 6px 0 !important;
        }
        .katex {
          font-size: 1.08em;
        }
      `}</style>

      <div className={`md-container ${className}`}>
        {content && content.trim() ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              h1: ({ children, ...props }) => <h1 className="md-h1" {...props}>{children}</h1>,
              h2: ({ children, ...props }) => <h2 className="md-h2" {...props}>{children}</h2>,
              h3: ({ children, ...props }) => <h3 className="md-h3" {...props}>{children}</h3>,
              h4: ({ children, ...props }) => <h4 className="md-h4" {...props}>{children}</h4>,
              h5: ({ children, ...props }) => <h5 className="md-h5" {...props}>{children}</h5>,
              h6: ({ children, ...props }) => <h6 className="md-h6" {...props}>{children}</h6>,
              p: ({ children, ...props }) => <p className="md-p" {...props}>{children}</p>,
              blockquote: ({ children, ...props }) => <blockquote className="md-blockquote" {...props}>{children}</blockquote>,
              hr: ({ ...props }) => <hr className="md-hr" {...props} />,
              ul: ({ children, ...props }) => <ul className="md-ul" {...props}>{children}</ul>,
              ol: ({ children, ...props }) => <ol className="md-ol" {...props}>{children}</ol>,
              a: ({ href, children, ...props }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" className="md-link" {...props}>
                  {children}
                </a>
              ),
              table: ({ children, ...props }) => (
                <div className="md-table-wrapper">
                  <table className="md-table" {...props}>
                    {children}
                  </table>
                </div>
              ),
              li: ({ children, className: liClass, ...props }) => {
                const isTaskItem = liClass?.includes("task-list-item")
                return (
                  <li className={isTaskItem ? "md-task-item" : undefined} {...props}>
                    {children}
                  </li>
                )
              },
              input: ({ type, ...props }) => {
                if (type === "checkbox") {
                  return <input type="checkbox" className="md-checkbox" disabled readOnly {...props} />
                }
                return <input type={type} {...props} />
              },
              code: ({ className: codeClass, children, ...props }) => {
                const match = /language-(\w+)/.exec(codeClass || "")
                const isBlock = match || String(children).includes("\n")

                if (!isBlock) {
                  return (
                    <code className="md-inline-code" {...props}>
                      {children}
                    </code>
                  )
                }

                const lang = match ? match[1] : "code"
                const codeString = String(children).replace(/\n$/, "")

                return (
                  <CodeBlock lang={lang} code={codeString}>
                    <code className={codeClass} {...props}>
                      {children}
                    </code>
                  </CodeBlock>
                )
              },
            }}
          >
            {content}
          </ReactMarkdown>
        ) : (
          <p style={{ color: "#888", fontStyle: "italic" }}>Konten kosong.</p>
        )}
      </div>
    </>
  )
}
