"use client"

import { ChevronRightIcon } from "lucide-react"
import { cn } from "cn"

import { Badge } from "@/components/reui/badge"

import { ColorScope } from "../appearance"
import { BlockImage, LinkButton, resolveLink, Section, type BlockProps } from "../blocks"

// Judul halaman dalam: jejak halaman, judul, kalimat, dan tombol.

export type PageTitleProps = {
  variant: "simple" | "centered" | "split" | "image" | "banner"
  breadcrumb: "yes" | "no"
  eyebrow: string
  title: string
  subtitle: string
  size: "sm" | "md" | "lg"
  image: string | null
  primary_label: string
  primary_link: string
  secondary_label: string
  secondary_link: string
}

const titleSize = {
  sm: "text-3xl sm:text-4xl",
  md: "text-4xl sm:text-5xl",
  lg: "text-5xl leading-[1.04] sm:text-6xl",
}

/** Judul halaman dalam: jejak halaman, judul, kalimat, dan tombol, dalam beberapa susunan. */
export function PageTitleBlock(props: BlockProps<PageTitleProps>) {
  const { variant, breadcrumb, eyebrow, title, subtitle, size, image, puck } = props
  const centered = variant === "centered"
  const banner = variant === "banner"
  const home = resolveLink("/", puck)
  const crumbs =
    breadcrumb === "yes" ? (
      <nav aria-label="Jejak halaman" className={cn("flex items-center gap-1.5 text-sm text-muted-foreground", centered && "justify-center")}>
        <a href={puck.isEditing ? undefined : home} className="hover:text-foreground">
          Beranda
        </a>
        <ChevronRightIcon aria-hidden="true" className="size-3.5" />
        <span aria-current="page" className="text-foreground">
          {title}
        </span>
      </nav>
    ) : null
  const heading = (
    <div className={cn("flex flex-col gap-4", centered && "items-center text-center")}>
      {crumbs}
      {eyebrow ? (
        <Badge variant="outline" radius="full" className="self-start">
          {eyebrow}
        </Badge>
      ) : null}
      <h1 className={cn("page-title font-semibold tracking-tight text-balance", titleSize[size] ?? titleSize.md)}>{title}</h1>
    </div>
  )
  const lead = subtitle ? (
    <p className={cn("page-lead max-w-2xl text-lg text-pretty text-muted-foreground", centered && "mx-auto text-center")}>{subtitle}</p>
  ) : null
  const buttons =
    props.primary_label || props.secondary_label ? (
      <div className={cn("flex flex-wrap gap-3", centered && "justify-center")}>
        <LinkButton label={props.primary_label} href={props.primary_link} variant="default" puck={puck} />
        <LinkButton label={props.secondary_label} href={props.secondary_link} variant="outline" puck={puck} />
      </div>
    ) : null

  if (banner) {
    return (
      <Section>
        <ColorScope background="inverse" className="relative isolate overflow-hidden rounded-3xl px-6 py-16 sm:px-12 lg:py-24">
          {image ? (
            <div aria-hidden="true" className="absolute inset-0 -z-10">
              <BlockImage src={image} alt="" className="size-full rounded-none border-0" puck={puck} />
              <div className="absolute inset-0 bg-black/55" />
            </div>
          ) : null}
          <div className="flex max-w-3xl flex-col gap-5">
            {heading}
            {lead}
            {buttons}
          </div>
        </ColorScope>
      </Section>
    )
  }
  if (variant === "split") {
    return (
      <Section className="grid gap-8 md:grid-cols-2 md:items-end">
        {heading}
        <div className="flex flex-col gap-5">
          {lead}
          {buttons}
        </div>
      </Section>
    )
  }
  if (variant === "image") {
    return (
      <Section className="grid items-center gap-10 md:grid-cols-2">
        <div className="flex flex-col gap-5">
          {heading}
          {lead}
          {buttons}
        </div>
        <BlockImage src={image} alt="" className="aspect-4/3 w-full rounded-2xl" puck={puck} />
      </Section>
    )
  }
  return (
    <Section className={cn("flex flex-col gap-5", centered && "items-center")}>
      {heading}
      {lead}
      {buttons}
    </Section>
  )
}
