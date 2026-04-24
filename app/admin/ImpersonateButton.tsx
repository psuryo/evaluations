"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

interface ImpersonateButtonProps {
  email: string
  nama: string
}

export default function ImpersonateButton({ email, nama }: ImpersonateButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Don't show button if email is not available
  if (!email || email === "—") {
    return (
      <button
        disabled
        style={{
          fontSize: 11,
          color: "#ccc",
          border: "0.5px solid rgba(0,0,0,0.12)",
          borderRadius: 5,
          padding: "3px 8px",
          whiteSpace: "nowrap",
          background: "none",
          cursor: "not-allowed",
        }}
        title="Email not available for this user"
      >
        No email
      </button>
    )
  }

  const handleImpersonate = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/auth/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetEmail: email }),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(`Error: ${data.error}`)
        setLoading(false)
        return
      }

      // Redirect to dashboard after setting impersonation cookie
      router.push("/dashboard")
    } catch (error) {
      console.error("Impersonation failed:", error)
      alert("Failed to login as user")
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleImpersonate}
      disabled={loading}
      style={{
        fontSize: 11,
        color: loading ? "#ccc" : "#888",
        border: "0.5px solid rgba(0,0,0,0.12)",
        borderRadius: 5,
        padding: "3px 8px",
        whiteSpace: "nowrap",
        background: "none",
        cursor: loading ? "not-allowed" : "pointer",
        transition: "all 0.15s",
      }}
      title={`Login as ${nama}`}
    >
      {loading ? "Logging in..." : "Login as user"}
    </button>
  )
}
