import Link from "next/link"
import LogoutButton from "@/app/dashboard/LogoutButton"
import "./kelompok.css"

export default function KelompokShell({
  email,
  children,
}: {
  email: string
  children: React.ReactNode
}) {
  return (
    <div className="kp-root">
      <header className="kp-topbar">
        <Link href="/dashboard" className="kp-wordmark">evaluations</Link>
        <nav className="kp-nav">
          <Link href="/admin">Dashboard</Link>
          <Link href="/admin/evaluations">Evaluations</Link>
          <Link href="/admin/kuliah">Kelola Kuliah</Link>
          <Link href="/admin/kelompok" className="active">Penilaian Kelompok</Link>
        </nav>
        <div className="kp-user">
          <span className="kp-email">{email}</span>
          <div className="kp-avatar">{email.charAt(0).toUpperCase()}</div>
          <LogoutButton className="kp-logout" />
        </div>
      </header>
      <main className="kp-body">{children}</main>
    </div>
  )
}
