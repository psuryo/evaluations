import { getServerSession } from "next-auth"
import { authOptions } from "../[...nextauth]/route"
import { prisma } from "@/app/src/lib/prisma"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    // Verify admin access
    if (!session?.user?.email || (ADMIN_EMAIL && session.user.email !== ADMIN_EMAIL)) {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      )
    }

    const { targetEmail } = await request.json()

    if (!targetEmail) {
      return NextResponse.json(
        { error: "targetEmail is required" },
        { status: 400 }
      )
    }

    // Verify target user exists
    const targetUser = await prisma.userNilai.findUnique({
      where: { email: targetEmail },
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 }
      )
    }

    // Set impersonation cookie
    const cookieStore = await cookies()
    cookieStore.set("impersonate", targetEmail, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60, // 1 hour
      path: "/",
    })

    return NextResponse.json({
      success: true,
      message: `Now viewing as ${targetUser.nama || targetEmail}`,
    })
  } catch (error) {
    console.error("Impersonation error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

