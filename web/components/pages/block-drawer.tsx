"use client"

import { useState } from "react"
import { Drawer } from "@puckeditor/core"
import {
  BookOpenIcon,
  HistoryIcon,
  AwardIcon,
  BriefcaseIcon,
  SquareSplitHorizontalIcon,
  MapPinnedIcon,
  TicketPercentIcon,
  UtensilsIcon,
  AppWindowIcon,
  BellIcon,
  BellRingIcon,
  BracesIcon,
  ChartColumnIcon,
  GalleryHorizontalEndIcon,
  GaugeIcon,
  HeadingIcon,
  CircleHelpIcon,
  CircleUserIcon,
  Columns3Icon,
  ContactIcon,
  GalleryHorizontalIcon,
  HandshakeIcon,
  Grid2x2Icon,
  ImageIcon,
  ImagesIcon,
  LayoutDashboardIcon,
  LayoutGridIcon,
  LayoutPanelTopIcon,
  LayoutTemplateIcon,
  ListChecksIcon,
  ListCollapseIcon,
  ListTreeIcon,
  MilestoneIcon,
  ListOrderedIcon,
  MegaphoneIcon,
  MessageSquareQuoteIcon,
  MinusIcon,
  MousePointerClickIcon,
  MoveVerticalIcon,
  OrbitIcon,
  PanelLeftIcon,
  PilcrowIcon,
  PictureInPicture2Icon,
  QuoteIcon,
  ReceiptIcon,
  SearchIcon,
  ShapesIcon,
  SparklesIcon,
  SquareIcon,
  SquareStackIcon,
  StarIcon,
  Table2Icon,
  TagIcon,
  TextAlignStartIcon,
  TrendingUpIcon,
  TypeIcon,
  UsersIcon,
  UsersRoundIcon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react"

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"

import { drawerTabs, pageConfig } from "./config"

type BlockName = keyof typeof pageConfig.components

/** Ikon setiap blok di daftar blok editor. */
const blockIcons: Record<BlockName, LucideIcon> = {
  Hero: LayoutTemplateIcon,
  Text: TextAlignStartIcon,
  ImageText: PanelLeftIcon,
  Services: LayoutGridIcon,
  BeforeAfter: SquareSplitHorizontalIcon,
  Portfolio: BriefcaseIcon,
  Gallery: ImagesIcon,
  Testimonials: MessageSquareQuoteIcon,
  Faq: CircleHelpIcon,
  CallToAction: MegaphoneIcon,
  Location: MapPinnedIcon,
  Contact: ContactIcon,
  Logos: HandshakeIcon,
  Features: LayoutDashboardIcon,
  Reviews: StarIcon,
  Awards: AwardIcon,
  Stats: ChartColumnIcon,
  Steps: ListOrderedIcon,
  PriceList: UtensilsIcon,
  Promo: TicketPercentIcon,
  Pricing: ReceiptIcon,
  About: BookOpenIcon,
  History: HistoryIcon,
  Team: UsersIcon,
  Section: LayoutPanelTopIcon,
  Columns: Columns3Icon,
  Grid: Grid2x2Icon,
  Row: GalleryHorizontalIcon,
  Card: SquareIcon,
  Spacer: MoveVerticalIcon,
  Heading: HeadingIcon,
  Paragraph: PilcrowIcon,
  Button: MousePointerClickIcon,
  Badge: TagIcon,
  Image: ImageIcon,
  Icon: ShapesIcon,
  List: ListChecksIcon,
  Divider: MinusIcon,
  Alert: BellIcon,
  Accordion: ListCollapseIcon,
  Tabs: AppWindowIcon,
  Quote: QuoteIcon,
  Profile: CircleUserIcon,
  Stat: TrendingUpIcon,
  Feature: SparklesIcon,
  Video: VideoIcon,
  AvatarStack: UsersRoundIcon,
  TextMarquee: TypeIcon,
  AnimatedList: BellRingIcon,
  Orbit: OrbitIcon,
  PageTitle: HeadingIcon,
  Carousel: GalleryHorizontalEndIcon,
  Dialog: PictureInPicture2Icon,
  Scrollspy: ListTreeIcon,
  Table: Table2Icon,
  Progress: GaugeIcon,
  Rating: StarIcon,
  Timeline: MilestoneIcon,
  Code: BracesIcon,
  IconStack: SquareStackIcon,
}

function labelOf(name: BlockName): string {
  return pageConfig.components[name]?.label ?? name
}

const tabText = {
  blocks: { search: "Cari blok", empty: "Tidak ada blok bernama" },
  components: { search: "Cari komponen", empty: "Tidak ada komponen bernama" },
}

/**
 * Isi satu tab daftar blok: kategorinya (`drawerTabs`) berupa kisi ubin yang
 * bisa diseret ke kanvas, dengan pencarian menurut nama.
 */
export function BlockDrawer({ tab }: { tab: keyof typeof drawerTabs }) {
  const [query, setQuery] = useState("")
  const needle = query.trim().toLowerCase()
  const text = tabText[tab]
  const groups = drawerTabs[tab]
    .map((key) => {
      const category = pageConfig.categories?.[key]
      return {
        key,
        title: category?.title ?? key,
        names: (category?.components ?? []).filter((name) => !needle || labelOf(name).toLowerCase().includes(needle)),
      }
    })
    .filter((group) => group.names.length > 0)

  return (
    <div className="flex flex-col gap-4">
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.search} aria-label={text.search} />
      </InputGroup>
      <Drawer>
        {groups.map((group) => (
          <section key={group.key} aria-label={group.title} className="flex flex-col gap-2">
            <h3 className="text-xs font-medium text-muted-foreground">{group.title}</h3>
            <div className="grid grid-cols-2 gap-2">
              {group.names.map((name) => (
                <Drawer.Item key={name} name={name} label={labelOf(name)}>
                  {() => <BlockTile name={name} />}
                </Drawer.Item>
              ))}
            </div>
          </section>
        ))}
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {text.empty} “{query.trim()}”.
          </p>
        ) : null}
      </Drawer>
    </div>
  )
}

function BlockTile({ name }: { name: BlockName }) {
  const Icon = blockIcons[name]
  return (
    <div className="flex h-16 cursor-grab flex-col items-center justify-center gap-1.5 rounded-lg border bg-card px-2 text-center text-xs leading-tight font-medium shadow-xs transition-colors hover:bg-accent dark:hover:bg-primary/10 active:cursor-grabbing">
      <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
      {labelOf(name)}
    </div>
  )
}
