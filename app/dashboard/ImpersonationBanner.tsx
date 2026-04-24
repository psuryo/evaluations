"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

export default function ImpersonationBanner() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleExit = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/auth/impersonate/exit", {
        method: "POST",
      })

      if (!response.ok) {
        alert("Failed to exit impersonation mode")
        setLoading(false)
        return
      }

      // Redirect back to admin
      router.push("/admin")
    } catch (error) {
      console.error("Exit impersonation failed:", error)
      alert("Failed to exit impersonation")
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        background: "#fef3c7",
        border: "1px solid #fcd34d",
        borderRadius: 6,
        padding: "12px 16px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: 13,
      }}
    >
      <span style={{ color: "#92400e" }}>
        🔍 <strong>Impersonation Mode:</strong> You're viewing as another user.
      </span>
      <button
        onClick={handleExit}
        disabled={loading}
        style={{
          background: "#fbbf24",
          border: "none",
          borderRadius: 4,
          padding: "5px 12px",
          fontSize: 12,
          fontWeight: 500,
          color: "#78350f",
          cursor: loading ? "not-allowed" : "pointer",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => {
          if (!loading) e.currentTarget.style.background = "#f59e0b"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "#fbbf24"
        }}
      >
        {loading ? "Exiting..." : "Back to Admin"}
      </button>
    </div>
  )
}
