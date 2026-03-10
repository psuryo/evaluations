"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"

export default function LoginPage() {
  const [email, setEmail] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    await signIn("email", {
      email,
      callbackUrl: "/dashboard"
    })
  }

  return (
    <div className="p-10">
      <h1 className="text-xl mb-4">Login</h1>

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="student@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button type="submit">
          Send Magic Link
        </button>
      </form>
    </div>
  )
}