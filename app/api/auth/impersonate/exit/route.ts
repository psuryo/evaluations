import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST() {
  try {
    const cookieStore = await cookies()
    cookieStore.delete("impersonate")
    
    return NextResponse.json({
      success: true,
      message: "Exited impersonation mode",
    })
  } catch (error) {
    console.error("Error clearing impersonation:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
