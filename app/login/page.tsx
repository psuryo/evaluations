"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"
import Image from "next/image"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle")

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!email) return
    setStatus("loading")

    const result = await signIn("email", {
      email,
      callbackUrl: "/dashboard",
      redirect: false,
    })

    if (result?.error) {
      setStatus("error")
    } else {
      setStatus("sent")
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .login-page {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f5f4f0;
          padding: 24px;
          font-family: 'Sora', system-ui, sans-serif;
        }

        .login-card {
          display: flex;
          width: 100%;
          max-width: 740px;
          min-height: 460px;
          background: #fff;
          border-radius: 16px;
          overflow: hidden;
          border: 0.5px solid rgba(0,0,0,0.08);
          box-shadow: 0 2px 24px rgba(0,0,0,0.04);
        }

        /* ── Left panel ── */
        .login-main {
          flex: 1;
          padding: 52px 48px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .wordmark {
          font-family: 'Sora', system-ui, sans-serif;
          font-size: 20px;
          color: #111;
          margin-bottom: 52px;
          letter-spacing: -0.3px;
        }

        .login-heading {
          font-family: 'Sora', system-ui, sans-serif;
          font-size: 32px;
          font-weight: 600;
          color: #111;
          line-height: 1.15;
          margin-bottom: 8px;
        }

        .login-sub {
          font-size: 14px;
          color: #6B7280;
          font-weight: 300;
          margin-bottom: 36px;
          line-height: 1.5;
        }

        .field-label {
          display: block;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: #6B7280;
          margin-bottom: 8px;
        }

        .email-input {
          width: 100%;
          font-family: inherit;
          font-size: 15px;
          padding: 12px 14px;
          border: 0.5px solid rgba(0,0,0,0.15);
          border-radius: 8px;
          background: #fafaf8;
          color: #111;
          outline: none;
          transition: border-color 0.15s, background 0.15s;
          margin-bottom: 12px;
        }
        .email-input::placeholder { color: #ccc; }
        .email-input:focus {
          border-color: #555;
          background: #fff;
        }

        .send-btn {
          width: 100%;
          padding: 13px;
          font-family: inherit;
          font-size: 14px;
          font-weight: 500;
          color: #fff;
          background: #111;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          letter-spacing: 0.02em;
          transition: opacity 0.15s, transform 0.1s;
        }
        .send-btn:hover:not(:disabled) { opacity: 0.8; }
        .send-btn:active:not(:disabled) { transform: scale(0.99); }
        .send-btn:disabled { opacity: 0.4; cursor: default; }

        .success-box {
          background: #f2faf6;
          border: 0.5px solid #a8d8bc;
          border-radius: 8px;
          padding: 16px 18px;
          font-size: 14px;
          color: #2d6e4e;
          line-height: 1.6;
          margin-bottom: 8px;
        }
        .success-box strong { font-weight: 500; }

        .error-msg {
          font-size: 13px;
          color: #c0392b;
          margin-top: 8px;
        }

        .hint {
          font-size: 12px;
          color: #ccc;
          margin-top: 20px;
          line-height: 1.6;
        }

        /* ── Right panel ── */
        .login-aside {
          width: 196px;
          background: #141414;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 32px 28px;
          flex-shrink: 0;
        }

        .aside-label {
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #9CA3AF;
          margin-bottom: 6px;
          font-family: 'Sora', system-ui, sans-serif;
        }
        .aside-stat {
          font-family: 'Sora', system-ui, sans-serif;
          font-size: 40px;
          color: #efefef;
          line-height: 1;
          margin-bottom: 8px;
        }
        .aside-desc {
          font-size: 12px;
          color: #9CA3AF;
          line-height: 1.65;
          font-family: 'Sora', system-ui, sans-serif;
        }

        .aside-logo {
        width: 100%;
        height: auto;        /* keeps proportions */
        object-fit: contain;
        filter: brightness(0) invert(1);
        opacity: 0.85;
        }

        @media (max-width: 580px) {
          .login-aside { display: none; }
          .login-main { padding: 40px 28px; }
        }
      `}</style>

      <div className="login-page">
        <div className="login-card">
          <div className="login-main">
            <p className="wordmark">Grade and Evaluations</p>

            {status === "sent" ? (
              <>
                <h1 className="login-heading">Check your inbox</h1>
                <p className="login-sub">Your link is on its way.</p>
                <div className="success-box">
                  We sent a sign-in link to <strong>{email}</strong>.
                  Click the link in your email to continue — no password needed.
                </div>
                <p className="hint">Didn&apos;t receive it? Check your spam folder.</p>
              </>
            ) : (
              <>
                <h1 className="login-heading">Sign in</h1>
                <p className="login-sub">
                  Enter your campus email and we&apos;ll send you a link to login.
                </p>

                <form onSubmit={handleSubmit}>
                  <label className="field-label" htmlFor="email">
                    Email address
                  </label>
                  <input
                    id="email"
                    className="email-input"
                    type="email"
                    placeholder="student@ukwms.ac.id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                  <button
                    className="send-btn"
                    type="submit"
                    disabled={status === "loading"}
                  >
                    {status === "loading" ? "Sending…" : "Send login link"}
                  </button>

                  {status === "error" && (
                    <p className="error-msg">
                      Something went wrong. Please try again.
                    </p>
                  )}
                </form>
              </>
            )}
          </div>

          <aside className="login-aside">


            <Image
              src="/logowm.png"
              alt="evaluations logo"
              width={120}
              height={135}
              className="aside-logo"
              priority
            />
            <p className="aside-label">this week</p>
            <p className="aside-stat">247</p>
            <p className="aside-desc">Universitas Katolik Widya Mandala Surabaya</p>
          </aside>
        </div>
      </div>
    </>
  )
}
