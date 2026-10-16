"use client"

import { MotionConfig, motion, type TargetAndTransition, type Transition } from "motion/react"
import type { CSSProperties, ReactNode } from "react"

// Animasi muncul blok dan komponen, dengan motion. Di editor animasinya
// diputar ulang setiap kali pengaturannya berubah, supaya hasilnya langsung
// terlihat; di halaman terbit diputar saat bagian itu masuk layar.
// Pengunjung yang meminta gerak dikurangi tidak melihatnya (MotionConfig).

export type MotionType = "none" | "fade" | "up" | "down" | "left" | "right" | "zoom" | "blur" | "flip" | "bounce"

export type MotionSettings = {
  type: MotionType
  /** Milidetik. */
  duration: number
  delay: number
  repeat: "once" | "always"
}

/**
 * Dikirim ke jendela setiap kali satu animasi selesai. Komponen yang mengukur
 * dirinya saat dipasang (carousel) mengukur ulang: selama animasi ia masih
 * diperkecil atau diputar, jadi ukuran pertamanya keliru.
 */
export const motionSettledEvent = "halaman:animasi-selesai"

function settled() {
  window.dispatchEvent(new Event(motionSettledEvent))
}

export const defaultMotion: MotionSettings = { type: "none", duration: 600, delay: 0, repeat: "once" }

const from: Record<Exclude<MotionType, "none">, TargetAndTransition> = {
  fade: { opacity: 0 },
  up: { opacity: 0, y: 32 },
  down: { opacity: 0, y: -32 },
  left: { opacity: 0, x: -40 },
  right: { opacity: 0, x: 40 },
  zoom: { opacity: 0, scale: 0.9 },
  blur: { opacity: 0, y: 12, filter: "blur(12px)" },
  flip: { opacity: 0, rotateX: -60, transformPerspective: 900 },
  bounce: { opacity: 0, y: 48, scale: 0.96 },
}

const to: TargetAndTransition = { opacity: 1, x: 0, y: 0, scale: 1, rotateX: 0, filter: "blur(0px)" }

function transitionOf(look: MotionSettings): Transition {
  const delay = Math.max(look.delay, 0) / 1000
  const duration = Math.max(look.duration, 100) / 1000
  if (look.type === "bounce") return { type: "spring", bounce: 0.45, duration, delay }
  return { duration, delay, ease: [0.22, 1, 0.36, 1] }
}

/** Pembungkus beranimasi. `preview`: diputar sekarang (editor), bukan saat masuk layar. */
export function Animate({
  settings,
  preview,
  className,
  style,
  children,
}: {
  settings?: Partial<MotionSettings>
  preview: boolean
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const look = { ...defaultMotion, ...settings }
  if (look.type === "none") {
    return className || style ? (
      <div className={className} style={style}>
        {children}
      </div>
    ) : (
      <>{children}</>
    )
  }
  const transition = transitionOf(look)
  if (preview) {
    return (
      // key: mengganti jenis, durasi, atau jeda memutar ulang animasinya.
      <motion.div key={`${look.type}-${look.duration}-${look.delay}`} initial={from[look.type]} animate={to} transition={transition} onAnimationComplete={settled} className={className} style={style}>
        {children}
      </motion.div>
    )
  }
  return (
    <motion.div
      initial={from[look.type]}
      whileInView={to}
      viewport={{ once: look.repeat === "once", amount: 0.2 }}
      transition={transition}
      onAnimationComplete={settled}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  )
}

/** Pengaturan gerak seluruh halaman: menghormati "kurangi gerakan" di perangkat pengunjung. */
export function PageMotion({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
