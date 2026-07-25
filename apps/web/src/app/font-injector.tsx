"use client"

import { useEffect } from "react"
import { Geist, Geist_Mono } from "next/font/google"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export function FontInjector() {
  useEffect(() => {
    const html = document.documentElement
    const classes = [geistSans.variable, geistMono.variable]
      .filter(Boolean)
      .join(" ")
      .split(" ")

    html.classList.add(...classes)
  }, [])

  return null
}
