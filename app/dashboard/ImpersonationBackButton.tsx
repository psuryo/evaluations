"use client"

import { useRouter } from "next/navigation"

export default function ImpersonationBackButton() {
  const router = useRouter()

  const handleBack = async () => {
    await fetch("/api/auth/impersonate/exit", { method: "POST" })
    router.push("/admin")
  }

  return (
    <button
      onClick={handleBack}
      style={{
        fontSize: 12,
        color: "#7a5200",
        border: "0.5px solid #e8c96a",
        borderRadius: 6,
        padding: "4px 10px",
        background: "none",
        cursor: "pointer",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = "#fff3d0"}
      onMouseLeave={(e) => e.currentTarget.style.background = "none"}
    >
      ← Back to admin
    </button>
  )
}
