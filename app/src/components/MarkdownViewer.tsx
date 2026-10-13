"use client"

import React, { useState } from "react"

interface MarkdownViewerProps {
  content: string
  className?: string
}

// Helper to parse inline markdown (bold, italic, code, links, strikethrough)
function parseInlineMarkdown(text: string): React.ReactNode[] {
  // Regex to match inline tokens:
  // 1. Code: `code`
  // 2. Bold: **bold** or __bold__
  // 3. Strikethrough: ~~del~~
  // 4. Italic: *italic* or _italic_
  // 5. Link: [text](url)
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g

  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    // Push preceding plain text
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    const token = match[0]
    const key = `${match.index}-${token}`

    if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code key={key} className="md-inline-code">
          {token.slice(1, -1)}
        </code>
      )
    } else if (
      (token.startsWith("**") && token.endsWith("**")) ||
      (token.startsWith("__") && token.endsWith("__"))
    ) {
      nodes.push(
        <strong key={key} className="md-bold">
          {parseInlineMarkdown(token.slice(2, -2))}
        </strong>
      )
    } else if (token.startsWith("~~") && token.endsWith("~~")) {
      nodes.push(
        <del key={key} className="md-del">
          {parseInlineMarkdown(token.slice(2, -2))}
        </del>
      )
    } else if (
      (token.startsWith("*") && token.endsWith("*")) ||
      (token.startsWith("_") && token.endsWith("_"))
    ) {
      nodes.push(
        <em key={key} className="md-italic">
          {parseInlineMarkdown(token.slice(1, -1))}
        </em>
      )
    } else if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
      const closingBracket = token.indexOf("](")
      const linkText = token.slice(1, closingBracket)
      const linkUrl = token.slice(closingBracket + 2, -1)
      nodes.push(
        <a
          key={key}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="md-link"
        >
          {linkText}
        </a>
      )
    } else {
      nodes.push(token)
    }

    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}

export default function MarkdownViewer({ content, className = "" }: MarkdownViewerProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const handleCopyCode = (codeText: string, idx: number) => {
    navigator.clipboard.writeText(codeText)
    setCopiedIndex(idx)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  // Parse lines into blocks
  const lines = content.replace(/\r\n/g, "\n").split("\n")
  const blocks: React.ReactNode[] = []

  let i = 0
  let blockIndex = 0

  while (i < lines.length) {
    const line = lines[i]

    // 1. Code block
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i])
        i++
      }
      i++ // Skip closing ```

      const fullCode = codeLines.join("\n")
      const currentIdx = blockIndex++

      blocks.push(
        <div key={`code-${currentIdx}`} className="md-codeblock-wrapper">
          <div className="md-codeblock-header">
            <span className="md-codeblock-lang">{lang || "code"}</span>
            <button
              type="button"
              className="md-codeblock-copy"
              onClick={() => handleCopyCode(fullCode, currentIdx)}
              title="Salin kode"
            >
              {copiedIndex === currentIdx ? "✓ Tersalin" : "Salin"}
            </button>
          </div>
          <pre className="md-codeblock">
            <code>{fullCode}</code>
          </pre>
        </div>
      )
      continue
    }

    // 2. Headings
    if (line.startsWith("#")) {
      const match = line.match(/^(#{1,6})\s+(.*)$/)
      if (match) {
        const level = match[1].length
        const headingText = match[2]
        const inline = parseInlineMarkdown(headingText)
        const key = `heading-${blockIndex++}`

        switch (level) {
          case 1:
            blocks.push(<h1 key={key} className="md-h1">{inline}</h1>)
            break
          case 2:
            blocks.push(<h2 key={key} className="md-h2">{inline}</h2>)
            break
          case 3:
            blocks.push(<h3 key={key} className="md-h3">{inline}</h3>)
            break
          case 4:
            blocks.push(<h4 key={key} className="md-h4">{inline}</h4>)
            break
          case 5:
            blocks.push(<h5 key={key} className="md-h5">{inline}</h5>)
            break
          default:
            blocks.push(<h6 key={key} className="md-h6">{inline}</h6>)
            break
        }
        i++
        continue
      }
    }

    // 3. Horizontal Rule
    if (/^(\*\*\*|---|___)$/.test(line.trim())) {
      blocks.push(<hr key={`hr-${blockIndex++}`} className="md-hr" />)
      i++
      continue
    }

    // 4. Blockquote
    if (line.startsWith(">")) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].startsWith(">")) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""))
        i++
      }
      blocks.push(
        <blockquote key={`quote-${blockIndex++}`} className="md-blockquote">
          {quoteLines.map((ql, qIdx) => (
            <p key={qIdx}>{parseInlineMarkdown(ql)}</p>
          ))}
        </blockquote>
      )
      continue
    }

    // 5. Table
    if (line.includes("|") && line.trim().startsWith("|") && line.trim().endsWith("|")) {
      const tableLines: string[] = []
      while (
        i < lines.length &&
        lines[i].includes("|") &&
        lines[i].trim().startsWith("|") &&
        lines[i].trim().endsWith("|")
      ) {
        tableLines.push(lines[i].trim())
        i++
      }

      if (tableLines.length >= 2) {
        const parseRow = (rowStr: string) =>
          rowStr
            .slice(1, -1)
            .split("|")
            .map((c) => c.trim())

        const headerRow = parseRow(tableLines[0])
        const isDivider = /^(\|\s*:?-+:?\s*)+\|$/.test(tableLines[1])
        const dataRows = isDivider ? tableLines.slice(2) : tableLines.slice(1)

        blocks.push(
          <div key={`table-${blockIndex++}`} className="md-table-wrapper">
            <table className="md-table">
              <thead>
                <tr>
                  {headerRow.map((col, cIdx) => (
                    <th key={cIdx}>{parseInlineMarkdown(col)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((rowStr, rIdx) => {
                  const cells = parseRow(rowStr)
                  return (
                    <tr key={rIdx}>
                      {cells.map((cell, cIdx) => (
                        <td key={cIdx}>{parseInlineMarkdown(cell)}</td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
        continue
      }
    }

    // 6. Unordered List or Checklist
    if (/^(\s*)[-*+]\s+/.test(line)) {
      const listItems: { text: string; checked?: boolean }[] = []
      while (i < lines.length && /^(\s*)[-*+]\s+/.test(lines[i])) {
        const itemLine = lines[i].replace(/^(\s*)[-*+]\s+/, "")
        const checkMatch = itemLine.match(/^\[([ xX])\]\s+(.*)$/)
        if (checkMatch) {
          listItems.push({
            checked: checkMatch[1].toLowerCase() === "x",
            text: checkMatch[2],
          })
        } else {
          listItems.push({ text: itemLine })
        }
        i++
      }

      blocks.push(
        <ul key={`ul-${blockIndex++}`} className="md-ul">
          {listItems.map((item, itemIdx) => (
            <li key={itemIdx} className={item.checked !== undefined ? "md-task-item" : ""}>
              {item.checked !== undefined && (
                <input
                  type="checkbox"
                  checked={item.checked}
                  readOnly
                  className="md-checkbox"
                />
              )}
              <span>{parseInlineMarkdown(item.text)}</span>
            </li>
          ))}
        </ul>
      )
      continue
    }

    // 7. Ordered List
    if (/^\s*\d+\.\s+/.test(line)) {
      const listItems: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\s*\d+\.\s+/, ""))
        i++
      }

      blocks.push(
        <ol key={`ol-${blockIndex++}`} className="md-ol">
          {listItems.map((itemText, itemIdx) => (
            <li key={itemIdx}>{parseInlineMarkdown(itemText)}</li>
          ))}
        </ol>
      )
      continue
    }

    // 8. Empty lines
    if (!line.trim()) {
      i++
      continue
    }

    // 9. Paragraph
    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith(">") &&
      !/^(\*\*\*|---|___)$/.test(lines[i].trim()) &&
      !/^(\s*)[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !(lines[i].includes("|") && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|"))
    ) {
      paraLines.push(lines[i])
      i++
    }

    blocks.push(
      <p key={`p-${blockIndex++}`} className="md-p">
        {paraLines.map((pl, plIdx) => (
          <React.Fragment key={plIdx}>
            {parseInlineMarkdown(pl)}
            {plIdx < paraLines.length - 1 && <br />}
          </React.Fragment>
        ))}
      </p>
    )
  }

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
        .md-bold {
          font-weight: 600;
          color: #111;
        }
        .md-italic {
          font-style: italic;
        }
        .md-del {
          text-decoration: line-through;
          color: #888;
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
      `}</style>
      <div className={`md-container ${className}`}>
        {blocks.length > 0 ? blocks : <p style={{ color: "#888", fontStyle: "italic" }}>Konten kosong.</p>}
      </div>
    </>
  )
}
