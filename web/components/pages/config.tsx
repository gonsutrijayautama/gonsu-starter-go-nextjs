"use client"

import type { ComponentProps } from "react"
import type { ComponentConfig, Config, DefaultComponentProps, Dictionary } from "@puckeditor/core"

import { ColumnsBlock, SpacerBlock, type ColumnsProps, type SpacerProps } from "./blocks"
import {
  AccordionBlock,
  AlertBlock,
  BadgeBlock,
  ButtonBlock,
  CardBlock,
  DividerBlock,
  FeatureBlock,
  GridBlock,
  HeadingBlock,
  IconBlock,
  ImageBlock,
  ListBlock,
  ParagraphBlock,
  ProfileBlock,
  QuoteBlock,
  RowBlock,
  SectionBlock,
  StatBlock,
  TabsBlock,
  type AccordionProps,
  type AlertProps,
  type BadgeProps,
  type ButtonProps,
  type CardProps,
  type DividerProps,
  type FeatureProps,
  type GridProps,
  type HeadingProps,
  type IconProps,
  type ImageProps,
  type ListProps,
  type ParagraphProps,
  type ProfileProps,
  type QuoteProps,
  type RowProps,
  type SectionProps,
  type StatProps,
  type TabsProps,
} from "./elements"
import { defaultAppearance, Surface, type Appearance } from "./appearance"
import {
  AnimatedListBlock,
  AvatarStackBlock,
  OrbitBlock,
  TextMarqueeBlock,
  VideoBlock,
  type AnimatedListProps,
  type AvatarStackProps,
  type OrbitProps,
  type TextMarqueeProps,
  type VideoProps,
} from "./extras"
import { colorField, iconField, sizeField } from "./field-kit"
import { PageRoot } from "./chrome-canvas"
import { heroConfig, type HeroProps } from "./library/hero"
import {
  aboutConfig,
  featuresConfig,
  historyConfig,
  imageTextConfig,
  servicesConfig,
  stepsConfig,
  teamConfig,
  textConfig,
  type AboutProps,
  type FeaturesProps,
  type HistoryProps,
  type ImageTextProps,
  type ServicesProps,
  type StepsProps,
  type TeamProps,
  type TextProps,
} from "./library/content"
import {
  awardsConfig,
  logosConfig,
  reviewsConfig,
  statsConfig,
  testimonialsConfig,
  type AwardsProps,
  type LogosProps,
  type ReviewsProps,
  type StatsProps,
  type TestimonialsProps,
} from "./library/proof"
import { beforeAfterConfig, galleryConfig, portfolioConfig, type BeforeAfterProps, type GalleryProps, type PortfolioProps } from "./library/gallery"
import { callToActionConfig, contactConfig, locationConfig, type CallToActionProps, type ContactProps, type LocationProps } from "./library/contact"
import { faqConfig, priceListConfig, pricingConfig, promoConfig, type FaqProps, type PriceListProps, type PricingProps, type PromoProps } from "./library/offer"
import {
  CarouselBlock,
  CodeBlockBlock,
  DialogBlock,
  IconStackBlock,
  ProgressBlock,
  RatingBlock,
  ScrollspyBlock,
  TableBlock,
  TimelineBlock,
  type CarouselProps,
  type CodeProps,
  type DialogProps,
  type IconStackProps,
  type ProgressProps,
  type RatingProps,
  type ScrollspyProps,
  type TableProps,
  type TimelineProps,
} from "./widgets"
import { Animate, defaultMotion, type MotionSettings } from "./motion"
import { motionField } from "./motion-input"
import { migrateStat } from "./stat-number"
import { alignField, animateField, buttonEffectField, cardEffectOptions, decimalsField, imageField, linkField, numberFormatField } from "./fields"
import { PageTitleBlock, type PageTitleProps } from "./library/page-title"

// Konfigurasi Puck: blok apa saja yang ada, isiannya, dan nilai awalnya.
// Nama blok (type di data) berbahasa Inggris dan menjadi kontrak data: server
// kelak memeriksa data halaman terhadap daftar yang sama, jadi nama yang sudah
// dipakai tidak diganti. Blok kembar yang digabung (Pembuka sorot, Ajakan
// sorot, Testimoni berjalan) dibaca ulang lewat migrate.ts. Blok siap pakai
// (tab Blok) ada di library/, lengkap dengan isian dan susunannya.

type Blocks = {
  Hero: HeroProps
  Text: TextProps
  ImageText: ImageTextProps
  Services: ServicesProps
  Gallery: GalleryProps
  BeforeAfter: BeforeAfterProps
  Portfolio: PortfolioProps
  Testimonials: TestimonialsProps
  Faq: FaqProps
  CallToAction: CallToActionProps
  Contact: ContactProps
  Location: LocationProps
  Columns: ColumnsProps
  Spacer: SpacerProps
  Logos: LogosProps
  Features: FeaturesProps
  Stats: StatsProps
  Reviews: ReviewsProps
  Awards: AwardsProps
  Steps: StepsProps
  Pricing: PricingProps
  PriceList: PriceListProps
  Promo: PromoProps
  Team: TeamProps
  About: AboutProps
  History: HistoryProps
  // Wadah
  Section: SectionProps
  Row: RowProps
  Grid: GridProps
  Card: CardProps
  // Elemen
  Heading: HeadingProps
  Paragraph: ParagraphProps
  Button: ButtonProps
  Badge: BadgeProps
  Image: ImageProps
  Icon: IconProps
  List: ListProps
  Divider: DividerProps
  // Komponen
  Alert: AlertProps
  Accordion: AccordionProps
  Tabs: TabsProps
  Quote: QuoteProps
  Profile: ProfileProps
  Stat: StatProps
  Feature: FeatureProps
  // Media dan efek
  Video: VideoProps
  AvatarStack: AvatarStackProps
  Orbit: OrbitProps
  TextMarquee: TextMarqueeProps
  AnimatedList: AnimatedListProps
  PageTitle: PageTitleProps
  // Interaktif dan data
  Carousel: CarouselProps
  Dialog: DialogProps
  Scrollspy: ScrollspyProps
  Table: TableProps
  Progress: ProgressProps
  Rating: RatingProps
  Timeline: TimelineProps
  Code: CodeProps
  IconStack: IconStackProps
}

// Yang boleh masuk ke setiap wadah. Bagian siap pakai punya lebar dan jaraknya
// sendiri, jadi hanya diletakkan langsung di halaman.
const elements = ["Heading", "Paragraph", "Button", "Badge", "Image", "Icon", "List", "Divider"]
const components = [
  "Alert",
  "Accordion",
  "Tabs",
  "Quote",
  "Profile",
  "Stat",
  "Feature",
  "Video",
  "AvatarStack",
  "Orbit",
  "TextMarquee",
  "AnimatedList",
  "Carousel",
  "Dialog",
  "Scrollspy",
  "Table",
  "Progress",
  "Rating",
  "Timeline",
  "Code",
  "IconStack",
]
const inSection = [...elements, ...components, "Row", "Grid", "Card", "Columns", "Spacer"]
const inCard = [...elements, ...components, "Row", "Grid"]
const inGrid = [...elements, ...components, "Card", "Row"]
// Isi tambahan di dalam butir Tab, Buka-tutup, dan Dialog: tanpa ketiganya bersarang.
const inItem = [...elements, ...components.filter((name) => name !== "Tabs" && name !== "Accordion" && name !== "Dialog"), "Row", "Grid", "Card"]
const inRow = ["Button", "Badge", "Icon", "Heading", "Paragraph", "Profile", "Stat", "AvatarStack"]

export const pageConfig: Config<Blocks> = {
  root: {
    // Judul, alamat, dan SEO diatur di Pengaturan halaman, bukan di sini.
    fields: {},
    // Di editor root juga merender navbar dan kaki situs (chrome-canvas.tsx).
    render: ({ children }) => <PageRoot>{children}</PageRoot>,
  },
  // Editor menampilkan kategori ini di dua tab (lihat `drawerTabs`): Blok
  // untuk bagian siap pakai, Komponen untuk bahan menyusun sendiri.
  categories: {
    pembuka: { title: "Pembuka", components: ["Hero", "PageTitle"] },
    fitur: { title: "Fitur & layanan", components: ["Features", "Services", "ImageText", "Steps"] },
    tentang: { title: "Tentang & cerita", components: ["About", "Text", "Team", "History"] },
    kepercayaan: { title: "Bukti & kepercayaan", components: ["Testimonials", "Logos", "Stats", "Reviews", "Awards"] },
    galeri: { title: "Galeri & portofolio", components: ["Gallery", "BeforeAfter", "Portfolio"] },
    harga: { title: "Harga & penawaran", components: ["PriceList", "Pricing", "Promo", "Faq"] },
    ajakan: { title: "Ajakan & kontak", components: ["CallToAction", "Contact", "Location"] },
    tata_letak: { title: "Tata letak", components: ["Section", "Columns", "Grid", "Row", "Card", "Spacer"] },
    dasar: { title: "Dasar", components: ["Heading", "Paragraph", "Button", "Badge", "Image", "Icon", "List", "Divider"] },
    lainnya: { title: "Lainnya", components: ["Alert", "Accordion", "Tabs", "Quote", "Profile", "Stat", "Feature"] },
    interaktif: { title: "Interaktif", components: ["Carousel", "Dialog", "Scrollspy"] },
    data: { title: "Data & informasi", components: ["Table", "Progress", "Rating", "Timeline", "Code"] },
    efek: { title: "Media & efek", components: ["Video", "AvatarStack", "TextMarquee", "AnimatedList", "Orbit", "IconStack"] },
  },
  components: {
    Hero: heroConfig,
    Text: textConfig,
    ImageText: imageTextConfig,
    Services: servicesConfig,
    Gallery: galleryConfig,
    BeforeAfter: beforeAfterConfig,
    Portfolio: portfolioConfig,
    Testimonials: testimonialsConfig,
    Faq: faqConfig,
    CallToAction: callToActionConfig,
    Contact: contactConfig,
    Location: locationConfig,
    Columns: {
      label: "Kolom",
      fields: {
        count: {
          type: "select",
          label: "Jumlah kolom",
          options: ["1", "2", "3", "4", "5", "6"].map((value) => ({ label: `${value} kolom`, value })),
        },
        ratio: {
          type: "select",
          label: "Lebar kolom (untuk 2 kolom)",
          options: [
            { label: "Sama lebar", value: "equal" },
            { label: "Kiri sempit (1:2)", value: "1-2" },
            { label: "Kanan sempit (2:1)", value: "2-1" },
            { label: "Kiri sangat sempit (1:3)", value: "1-3" },
            { label: "Kanan sangat sempit (3:1)", value: "3-1" },
          ],
        },
        gap: {
          type: "radio",
          label: "Jarak antarkolom",
          options: [
            { label: "Rapat", value: "small" },
            { label: "Sedang", value: "medium" },
            { label: "Lega", value: "large" },
          ],
        },
        valign: {
          type: "radio",
          label: "Perataan isi",
          options: [
            { label: "Atas", value: "top" },
            { label: "Tengah", value: "center" },
            { label: "Bawah", value: "bottom" },
          ],
        },
        first: { type: "slot", label: "Kolom 1", disallow: ["Columns", "Hero", "Section"] },
        second: { type: "slot", label: "Kolom 2", disallow: ["Columns", "Hero", "Section"] },
        third: { type: "slot", label: "Kolom 3", disallow: ["Columns", "Hero", "Section"] },
        fourth: { type: "slot", label: "Kolom 4", disallow: ["Columns", "Hero", "Section"] },
        fifth: { type: "slot", label: "Kolom 5", disallow: ["Columns", "Hero", "Section"] },
        sixth: { type: "slot", label: "Kolom 6", disallow: ["Columns", "Hero", "Section"] },
      },
      defaultProps: { count: "2", ratio: "equal", gap: "medium", valign: "top", first: [], second: [], third: [], fourth: [], fifth: [], sixth: [] },
      render: (props) => <ColumnsBlock {...props} />,
    },
    Spacer: {
      label: "Spasi",
      fields: {
        size: {
          type: "radio",
          label: "Tinggi",
          options: [
            { label: "Kecil", value: "small" },
            { label: "Sedang", value: "medium" },
            { label: "Besar", value: "large" },
          ],
        },
        line: {
          type: "radio",
          label: "Garis pemisah",
          options: [
            { label: "Tanpa", value: "no" },
            { label: "Dengan garis", value: "yes" },
          ],
        },
      },
      defaultProps: { size: "medium", line: "no" },
      render: (props) => <SpacerBlock {...props} />,
    },

    // --- Bagian siap pakai bergaya halaman produk ---------------------------
    Logos: logosConfig,
    Features: featuresConfig,
    Stats: statsConfig,
    Reviews: reviewsConfig,
    Awards: awardsConfig,
    Steps: stepsConfig,
    Pricing: pricingConfig,
    PriceList: priceListConfig,
    Promo: promoConfig,
    Team: teamConfig,
    About: aboutConfig,
    History: historyConfig,
    // --- Judul halaman, interaktif, dan data --------------------------------
    PageTitle: {
      label: "Judul halaman",
      fields: {
        variant: {
          type: "select",
          label: "Susunan",
          options: [
            { label: "Sederhana (rata kiri)", value: "simple" },
            { label: "Di tengah", value: "centered" },
            { label: "Terbagi dua", value: "split" },
            { label: "Dengan gambar", value: "image" },
            { label: "Banner bergambar", value: "banner" },
          ],
        },
        breadcrumb: {
          type: "radio",
          label: "Jejak halaman (Beranda › …)",
          options: [
            { label: "Tampil", value: "yes" },
            { label: "Tidak", value: "no" },
          ],
        },
        eyebrow: { type: "text", label: "Label kecil", placeholder: "Kosongkan bila tidak perlu" },
        title: { type: "textarea", label: "Judul" },
        subtitle: { type: "textarea", label: "Kalimat di bawahnya" },
        size: {
          type: "radio",
          label: "Ukuran judul",
          options: [
            { label: "Kecil", value: "sm" },
            { label: "Sedang", value: "md" },
            { label: "Besar", value: "lg" },
          ],
        },
        image: imageField("Gambar (untuk susunan bergambar dan banner)"),
        primary_label: { type: "text", label: "Tombol utama", placeholder: "Kosongkan bila tanpa tombol" },
        primary_link: linkField,
        secondary_label: { type: "text", label: "Tombol kedua", placeholder: "Kosongkan bila tanpa tombol" },
        secondary_link: { ...linkField, label: "Tautan tombol kedua" },
      },
      defaultProps: {
        variant: "simple",
        breadcrumb: "yes",
        eyebrow: "",
        title: "Judul halaman",
        subtitle: "Satu-dua kalimat yang menjelaskan isi halaman ini.",
        size: "md",
        image: null,
        primary_label: "",
        primary_link: "",
        secondary_label: "",
        secondary_link: "",
      },
      render: (props) => <PageTitleBlock {...props} />,
    },
    Carousel: {
      label: "Carousel",
      fields: {
        slides: {
          type: "array",
          label: "Slide",
          max: 20,
          getItemSummary: (item, index) => item.title || `Slide ${(index ?? 0) + 1}`,
          defaultItemProps: { image: null, title: "", caption: "", link: "" },
          arrayFields: {
            image: imageField("Gambar"),
            title: { type: "text", label: "Judul" },
            caption: { type: "textarea", label: "Keterangan" },
            link: { ...linkField, label: "Tautan (boleh kosong)" },
          },
        },
        style: {
          type: "radio",
          label: "Tampilan",
          options: [
            { label: "Kartu", value: "card" },
            { label: "Gambar penuh", value: "image" },
          ],
        },
        per_view: { type: "select", label: "Slide sekaligus", options: ["1", "2", "3", "4"].map((value) => ({ label: `${value} slide`, value })) },
        ratio: {
          type: "select",
          label: "Bentuk gambar",
          options: [
            { label: "Lebar (16:9)", value: "16/9" },
            { label: "Foto (4:3)", value: "4/3" },
            { label: "Persegi (1:1)", value: "1/1" },
            { label: "Tegak (3:4)", value: "3/4" },
          ],
        },
        controls: {
          type: "select",
          label: "Kontrol",
          options: [
            { label: "Panah dan titik", value: "both" },
            { label: "Panah saja", value: "arrows" },
            { label: "Titik saja", value: "dots" },
            { label: "Tanpa kontrol", value: "none" },
          ],
        },
        autoplay: {
          type: "select",
          label: "Putar otomatis",
          options: [
            { label: "Tidak", value: "off" },
            { label: "Setiap 3 detik", value: "3" },
            { label: "Setiap 5 detik", value: "5" },
            { label: "Setiap 8 detik", value: "8" },
          ],
        },
        loop: {
          type: "radio",
          label: "Berulang",
          options: [
            { label: "Ya", value: "yes" },
            { label: "Tidak", value: "no" },
          ],
        },
      },
      defaultProps: {
        style: "card",
        per_view: "3",
        ratio: "4/3",
        controls: "both",
        autoplay: "off",
        loop: "yes",
        slides: [
          { image: null, title: "Slide pertama", caption: "Satu kalimat keterangan.", link: "" },
          { image: null, title: "Slide kedua", caption: "Satu kalimat keterangan.", link: "" },
          { image: null, title: "Slide ketiga", caption: "Satu kalimat keterangan.", link: "" },
          { image: null, title: "Slide keempat", caption: "Satu kalimat keterangan.", link: "" },
        ],
      },
      render: (props) => <CarouselBlock {...props} />,
    },
    Dialog: {
      label: "Dialog",
      fields: {
        trigger_label: { type: "text", label: "Teks tombol pembuka" },
        trigger_variant: {
          type: "select",
          label: "Gaya tombol",
          options: [
            { label: "Utama", value: "default" },
            { label: "Bergaris", value: "outline" },
            { label: "Kedua", value: "secondary" },
            { label: "Polos", value: "ghost" },
          ],
        },
        title: { type: "text", label: "Judul dialog" },
        description: { type: "textarea", label: "Keterangan" },
        size: {
          type: "radio",
          label: "Lebar dialog",
          options: [
            { label: "Kecil", value: "sm" },
            { label: "Sedang", value: "md" },
            { label: "Lebar", value: "lg" },
          ],
        },
        align: alignField,
        body: { type: "slot", label: "Isi dialog", allow: inItem },
      },
      defaultProps: {
        trigger_label: "Lihat detail",
        trigger_variant: "outline",
        title: "Judul dialog",
        description: "Satu kalimat keterangan.",
        size: "md",
        align: "left",
        body: [],
      },
      render: (props) => <DialogBlock {...props} />,
    },
    Scrollspy: {
      label: "Daftar isi",
      fields: {
        title: { type: "text", label: "Judul" },
        items: {
          type: "array",
          label: "Bagian",
          max: 20,
          getItemSummary: (item) => item.label || "Bagian tanpa nama",
          defaultItemProps: { label: "Bagian", target: "" },
          arrayFields: {
            label: { type: "text", label: "Teks" },
            target: { type: "text", label: "ID bagian tujuan", placeholder: "harga (diatur di Tampilan bagian)" },
          },
        },
        style: {
          type: "radio",
          label: "Gaya",
          options: [
            { label: "Daftar", value: "list" },
            { label: "Kapsul", value: "pills" },
            { label: "Garis", value: "line" },
          ],
        },
        orientation: {
          type: "radio",
          label: "Arah",
          options: [
            { label: "Tegak", value: "vertical" },
            { label: "Mendatar", value: "horizontal" },
          ],
        },
      },
      defaultProps: {
        title: "Di halaman ini",
        style: "line",
        orientation: "vertical",
        items: [
          { label: "Layanan", target: "layanan" },
          { label: "Harga", target: "harga" },
          { label: "Kontak", target: "kontak" },
        ],
      },
      render: (props) => <ScrollspyBlock {...props} />,
    },
    Table: {
      label: "Tabel",
      fields: {
        header: { type: "text", label: "Judul kolom (pisahkan dengan |)", placeholder: "Paket | Harga | Isi" },
        rows: {
          type: "array",
          label: "Baris",
          max: 50,
          getItemSummary: (item) => item.cells.split("|")[0]?.trim() || "Baris kosong",
          defaultItemProps: { cells: "" },
          arrayFields: { cells: { type: "text", label: "Isi sel (pisahkan dengan |)" } },
        },
        variant: {
          type: "select",
          label: "Gaya",
          options: [
            { label: "Polos", value: "plain" },
            { label: "Belang", value: "striped" },
            { label: "Bergaris penuh", value: "bordered" },
            { label: "Kartu", value: "card" },
          ],
        },
        first_column: {
          type: "radio",
          label: "Kolom pertama",
          options: [
            { label: "Biasa", value: "normal" },
            { label: "Tebal", value: "bold" },
          ],
        },
      },
      defaultProps: {
        header: "Paket | Harga | Isi",
        variant: "card",
        first_column: "bold",
        rows: [
          { cells: "Dasar | Rp150.000 | Satu layanan" },
          { cells: "Usaha | Rp350.000 | Semua layanan, dukungan prioritas" },
          { cells: "Lengkap | Hubungi kami | Sesuai kebutuhan" },
        ],
      },
      render: (props) => <TableBlock {...props} />,
    },
    Progress: {
      label: "Progres",
      fields: {
        items: {
          type: "array",
          label: "Batang",
          max: 12,
          getItemSummary: (item) => `${item.label || "Tanpa nama"} · ${item.value}%`,
          defaultItemProps: { label: "Keahlian", value: 80 },
          arrayFields: { label: { type: "text", label: "Nama" }, value: { type: "number", label: "Nilai (0–100)", min: 0, max: 100 } },
        },
        size: {
          type: "radio",
          label: "Tebal batang",
          options: [
            { label: "Tipis", value: "thin" },
            { label: "Sedang", value: "medium" },
            { label: "Tebal", value: "thick" },
          ],
        },
        show_value: {
          type: "radio",
          label: "Tampilkan persen",
          options: [
            { label: "Ya", value: "yes" },
            { label: "Tidak", value: "no" },
          ],
        },
        color: colorField("Warna batang", "Otomatis: warna utama."),
        animate: {
          type: "radio",
          label: "Mengisi saat terlihat",
          options: [
            { label: "Ya", value: "yes" },
            { label: "Tidak", value: "no" },
          ],
        },
      },
      defaultProps: {
        size: "medium",
        show_value: "yes",
        color: "",
        animate: "yes",
        items: [
          { label: "Kepuasan pelanggan", value: 98 },
          { label: "Tepat waktu", value: 95 },
          { label: "Pesanan berulang", value: 72 },
        ],
      },
      render: (props) => <ProgressBlock {...props} />,
    },
    Rating: {
      label: "Rating",
      fields: {
        rating: { type: "number", label: "Nilai", min: 0, max: 10, step: 0.1 },
        max: { type: "number", label: "Jumlah bintang", min: 3, max: 10 },
        size: {
          type: "radio",
          label: "Ukuran",
          options: [
            { label: "Kecil", value: "sm" },
            { label: "Sedang", value: "default" },
            { label: "Besar", value: "lg" },
          ],
        },
        show_value: {
          type: "radio",
          label: "Tampilkan angka",
          options: [
            { label: "Ya", value: "yes" },
            { label: "Tidak", value: "no" },
          ],
        },
        caption: { type: "text", label: "Keterangan", placeholder: "Misalnya: dari 120 ulasan" },
        color: colorField("Warna bintang", "Otomatis: kuning."),
        align: alignField,
      },
      defaultProps: { rating: 4.8, max: 5, size: "default", show_value: "yes", caption: "dari 120 ulasan", color: "", align: "left" },
      render: (props) => <RatingBlock {...props} />,
    },
    Timeline: {
      label: "Linimasa",
      fields: {
        items: {
          type: "array",
          label: "Peristiwa",
          max: 20,
          getItemSummary: (item) => item.title || "Peristiwa",
          defaultItemProps: { date: "", title: "Peristiwa", description: "", icon: "" },
          arrayFields: {
            date: { type: "text", label: "Tanggal atau tahun" },
            title: { type: "text", label: "Judul" },
            description: { type: "textarea", label: "Keterangan" },
            icon: iconField("Ikon (untuk penanda ikon)"),
          },
        },
        orientation: {
          type: "radio",
          label: "Arah",
          options: [
            { label: "Tegak", value: "vertical" },
            { label: "Mendatar", value: "horizontal" },
          ],
        },
        marker: {
          type: "radio",
          label: "Penanda",
          options: [
            { label: "Titik", value: "dot" },
            { label: "Ikon", value: "icon" },
          ],
        },
        progress: { type: "number", label: "Sudah sampai langkah ke (0 = semua)", min: 0, max: 20 },
      },
      defaultProps: {
        orientation: "vertical",
        marker: "dot",
        progress: 0,
        items: [
          { date: "2018", title: "Usaha dimulai", description: "Berawal dari garasi rumah.", icon: "house" },
          { date: "2021", title: "Toko pertama", description: "Buka toko di pusat kota.", icon: "store" },
          { date: "2024", title: "1.000 pelanggan", description: "Terima kasih atas kepercayaannya.", icon: "users" },
        ],
      },
      render: (props) => <TimelineBlock {...props} />,
    },
    Code: {
      label: "Kode",
      fields: {
        title: { type: "text", label: "Judul (boleh kosong)" },
        language: {
          type: "select",
          label: "Bahasa",
          options: [
            { label: "Teks biasa", value: "text" },
            { label: "Bash / terminal", value: "bash" },
            { label: "JavaScript", value: "javascript" },
            { label: "TypeScript", value: "typescript" },
            { label: "JSON", value: "json" },
            { label: "HTML", value: "html" },
            { label: "CSS", value: "css" },
            { label: "Go", value: "go" },
            { label: "Python", value: "python" },
          ],
        },
        code: { type: "textarea", label: "Kode" },
        line_numbers: {
          type: "radio",
          label: "Nomor baris",
          options: [
            { label: "Tampil", value: "yes" },
            { label: "Tidak", value: "no" },
          ],
        },
      },
      defaultProps: { title: "", language: "bash", code: "curl https://contoh.id/api/pesanan", line_numbers: "no" },
      render: (props) => <CodeBlockBlock {...props} />,
    },
    IconStack: {
      label: "Tumpukan ikon",
      fields: {
        icon: iconField("Ikon"),
        caption: { type: "text", label: "Keterangan (boleh kosong)" },
        size: {
          type: "radio",
          label: "Ukuran",
          options: [
            { label: "Kecil", value: "sm" },
            { label: "Sedang", value: "md" },
            { label: "Besar", value: "lg" },
          ],
        },
        color: colorField("Warna ikon"),
        align: alignField,
      },
      defaultProps: { icon: "package", caption: "", size: "md", color: "", align: "left" },
      render: (props) => <IconStackBlock {...props} />,
    },

    // --- Wadah -------------------------------------------------------------
    Section: {
      label: "Bagian kosong",
      fields: {
        content: { type: "slot", label: "Isi", allow: inSection },
      },
      defaultProps: {
        content: [
          { type: "Heading", props: { text: "Judul bagian", level: "h2", font_size: 0, weight: "default", color: "", align: "left" } },
          {
            type: "Paragraph",
            props: {
              text: "<p>Tulis isinya di sini, lalu seret elemen lain ke dalam bagian ini.</p>",
              size: "large",
              tone: "muted",
              font_size: 0,
              color: "",
              align: "left",
            },
          },
        ],
      },
      render: (props) => <SectionBlock {...props} />,
    },
    Row: {
      label: "Baris",
      fields: {
        justify: {
          type: "select",
          label: "Letak isi",
          options: [
            { label: "Kiri", value: "start" },
            { label: "Tengah", value: "center" },
            { label: "Kanan", value: "end" },
            { label: "Rata kiri-kanan", value: "between" },
          ],
        },
        items: { type: "slot", label: "Isi", allow: inRow },
      },
      defaultProps: {
        justify: "start",
        items: [
          {
            type: "Button",
            props: {
              label: "Hubungi kami",
              link: "#kontak",
              variant: "default",
              icon: "",
              icon_position: "right",
              shape: "default",
              shadow: "no",
              new_tab: "no",
              align: "left",
              effect: "none",
              size: "md",
              width: "auto",
              width_px: 0,
            },
          },
          {
            type: "Button",
            props: {
              label: "Lihat layanan",
              link: "/layanan",
              variant: "outline",
              icon: "",
              icon_position: "right",
              shape: "default",
              shadow: "no",
              new_tab: "no",
              align: "left",
              effect: "none",
              size: "md",
              width: "auto",
              width_px: 0,
            },
          },
        ],
      },
      render: (props) => <RowBlock {...props} />,
    },
    Grid: {
      label: "Kisi",
      fields: {
        columns: {
          type: "select",
          label: "Kolom di layar lebar",
          options: ["1", "2", "3", "4", "5", "6"].map((value) => ({ label: `${value} kolom`, value })),
        },
        mobile: {
          type: "radio",
          label: "Kolom di ponsel",
          options: [
            { label: "1", value: "1" },
            { label: "2", value: "2" },
          ],
        },
        gap: {
          type: "radio",
          label: "Jarak",
          options: [
            { label: "Rapat", value: "small" },
            { label: "Sedang", value: "medium" },
            { label: "Lega", value: "large" },
          ],
        },
        items: { type: "slot", label: "Isi", allow: inGrid },
      },
      defaultProps: {
        columns: "3",
        mobile: "1",
        gap: "small",
        items: [
          {
            type: "Stat",
            props: { value: "10+", label: "Tahun melayani", align: "left", count: "yes", format: "plain", decimals: 0, font_size: 0, color: "" },
          },
          { type: "Stat", props: { value: "500+", label: "Pelanggan", align: "left", count: "yes", format: "plain", decimals: 0, font_size: 0, color: "" } },
          {
            type: "Stat",
            props: { value: "24 jam", label: "Waktu tanggap", align: "left", count: "yes", format: "plain", decimals: 0, font_size: 0, color: "" },
          },
        ],
      },
      render: (props) => <GridBlock {...props} />,
    },
    Card: {
      label: "Kartu",
      fields: {
        title: { type: "text", label: "Judul" },
        description: { type: "text", label: "Keterangan" },
        style: {
          type: "radio",
          label: "Gaya",
          options: [
            { label: "Kartu", value: "card" },
            { label: "Bingkai", value: "frame" },
          ],
        },
        effect: { type: "select", label: "Efek tepi", options: cardEffectOptions },
        content: { type: "slot", label: "Isi", allow: inCard },
      },
      defaultProps: {
        title: "Judul kartu",
        description: "Satu kalimat keterangan.",
        style: "card",
        effect: "none",
        content: [{ type: "Paragraph", props: { text: "<p>Isi kartu.</p>", size: "normal", tone: "muted", font_size: 0, color: "", align: "left" } }],
      },
      render: (props) => <CardBlock {...props} />,
    },

    // --- Elemen ------------------------------------------------------------
    Heading: {
      label: "Judul",
      fields: {
        text: { type: "textarea", label: "Teks" },
        level: {
          type: "select",
          label: "Ukuran",
          options: [
            { label: "Sangat besar (judul halaman)", value: "h1" },
            { label: "Besar (judul bagian)", value: "h2" },
            { label: "Sedang", value: "h3" },
            { label: "Kecil", value: "h4" },
          ],
        },
        font_size: sizeField("Ukuran huruf", { min: 14, max: 120, unit: "px", fallback: 36, description: "Bawaan: mengikuti pilihan Ukuran di atas." }),
        weight: {
          type: "select",
          label: "Tebal huruf",
          options: [
            { label: "Bawaan", value: "default" },
            { label: "Biasa", value: "normal" },
            { label: "Sedang", value: "medium" },
            { label: "Tebal", value: "semibold" },
            { label: "Sangat tebal", value: "bold" },
          ],
        },
        color: colorField("Warna teks", "Otomatis: mengikuti latar bagian."),
        align: alignField,
      },
      defaultProps: { text: "Judul", level: "h2", font_size: 0, weight: "default", color: "", align: "left" },
      render: (props) => <HeadingBlock {...props} />,
    },
    Paragraph: {
      label: "Paragraf",
      fields: {
        text: { type: "richtext", label: "Teks" },
        size: {
          type: "radio",
          label: "Ukuran",
          options: [
            { label: "Kecil", value: "small" },
            { label: "Biasa", value: "normal" },
            { label: "Besar", value: "large" },
          ],
        },
        tone: {
          type: "radio",
          label: "Warna",
          options: [
            { label: "Lembut", value: "muted" },
            { label: "Tegas", value: "normal" },
          ],
        },
        font_size: sizeField("Ukuran huruf kustom", { min: 12, max: 40, unit: "px", fallback: 16 }),
        color: colorField("Warna teks kustom", "Otomatis: memakai pilihan Warna di atas."),
        align: alignField,
      },
      defaultProps: { text: "<p>Tulis paragrafnya di sini.</p>", size: "normal", tone: "muted", font_size: 0, color: "", align: "left" },
      render: (props) => <ParagraphBlock {...props} />,
    },
    Button: {
      label: "Tombol",
      fields: {
        label: { type: "text", label: "Teks tombol" },
        link: linkField,
        variant: {
          type: "select",
          label: "Gaya",
          options: [
            { label: "Utama", value: "default" },
            { label: "Kedua", value: "secondary" },
            { label: "Bergaris", value: "outline" },
            { label: "Polos", value: "ghost" },
            { label: "Tautan", value: "link" },
            { label: "Lembut", value: "soft" },
            { label: "Kontras (hitam/putih)", value: "mono" },
            { label: "Gradien", value: "gradient" },
            { label: "Garis putus-putus", value: "dashed" },
            { label: "Bahaya (merah)", value: "destructive" },
          ],
        },
        icon: iconField("Ikon (boleh kosong)"),
        icon_position: {
          type: "radio",
          label: "Letak ikon",
          options: [
            { label: "Kiri", value: "left" },
            { label: "Kanan", value: "right" },
            { label: "Ikon saja", value: "only" },
          ],
        },
        shape: {
          type: "radio",
          label: "Bentuk",
          options: [
            { label: "Biasa", value: "default" },
            { label: "Kapsul", value: "pill" },
            { label: "Kotak", value: "square" },
          ],
        },
        shadow: {
          type: "radio",
          label: "Bayangan",
          options: [
            { label: "Tidak", value: "no" },
            { label: "Ya", value: "yes" },
          ],
        },
        new_tab: {
          type: "radio",
          label: "Buka di tab baru",
          options: [
            { label: "Tidak", value: "no" },
            { label: "Ya", value: "yes" },
          ],
        },
        size: {
          type: "radio",
          label: "Ukuran",
          options: [
            { label: "Kecil", value: "sm" },
            { label: "Sedang", value: "md" },
            { label: "Besar", value: "lg" },
            { label: "Sangat besar", value: "xl" },
          ],
        },
        width: {
          type: "radio",
          label: "Lebar",
          options: [
            { label: "Mengikuti teks", value: "auto" },
            { label: "Penuh", value: "full" },
            { label: "Atur sendiri", value: "custom" },
          ],
        },
        width_px: sizeField("Lebar tombol (bila diatur sendiri)", { min: 80, max: 480, step: 8, unit: "px", fallback: 200 }),
        effect: { ...buttonEffectField, label: "Efek" },
        align: alignField,
      },
      defaultProps: {
        label: "Hubungi kami",
        link: "#kontak",
        variant: "default",
        icon: "",
        icon_position: "right",
        shape: "default",
        shadow: "no",
        new_tab: "no",
        align: "left",
        effect: "none",
        size: "md",
        width: "auto",
        width_px: 0,
      },
      render: (props) => <ButtonBlock {...props} />,
    },
    Badge: {
      label: "Label",
      fields: {
        text: { type: "text", label: "Teks" },
        variant: {
          type: "select",
          label: "Warna",
          options: [
            { label: "Utama", value: "default" },
            { label: "Abu-abu", value: "secondary" },
            { label: "Bergaris", value: "outline" },
            { label: "Hijau", value: "success-light" },
            { label: "Kuning", value: "warning-light" },
            { label: "Biru", value: "info-light" },
          ],
        },
        shape: {
          type: "radio",
          label: "Bentuk",
          options: [
            { label: "Sudut tumpul", value: "rounded" },
            { label: "Bulat", value: "pill" },
          ],
        },
        align: alignField,
      },
      defaultProps: { text: "Baru", variant: "default", shape: "pill", align: "left" },
      render: (props) => <BadgeBlock {...props} />,
    },
    Image: {
      label: "Gambar",
      fields: {
        image: imageField("Gambar"),
        alt: { type: "text", label: "Keterangan untuk pembaca layar", placeholder: "Apa yang tampak di gambar" },
        ratio: {
          type: "select",
          label: "Bentuk",
          options: [
            { label: "Lebar (16:9)", value: "16/9" },
            { label: "Foto (4:3)", value: "4/3" },
            { label: "Persegi (1:1)", value: "1/1" },
            { label: "Tegak (3:4)", value: "3/4" },
          ],
        },
        frame: {
          type: "select",
          label: "Bingkai",
          options: [
            { label: "Tanpa bingkai", value: "none" },
            { label: "Jendela peramban", value: "browser" },
            { label: "Ponsel", value: "phone" },
          ],
        },
        caption: { type: "text", label: "Keterangan di bawah gambar" },
      },
      defaultProps: { image: null, alt: "", ratio: "16/9", frame: "none", caption: "" },
      render: (props) => <ImageBlock {...props} />,
    },
    Icon: {
      label: "Ikon",
      fields: {
        icon: iconField("Ikon"),
        style: {
          type: "select",
          label: "Gaya",
          options: [
            { label: "Bergaris", value: "outline" },
            { label: "Berwarna penuh", value: "solid" },
            { label: "Berbingkai", value: "frame" },
          ],
        },
        align: alignField,
      },
      defaultProps: { icon: "star", style: "outline", align: "left" },
      render: (props) => <IconBlock {...props} />,
    },
    List: {
      label: "Daftar",
      fields: {
        style: {
          type: "radio",
          label: "Penanda",
          options: [
            { label: "Centang", value: "check" },
            { label: "Titik", value: "bullet" },
            { label: "Nomor", value: "number" },
          ],
        },
        items: {
          type: "array",
          label: "Butir",
          max: 30,
          getItemSummary: (item) => item.text || "Butir kosong",
          defaultItemProps: { text: "Butir baru" },
          arrayFields: { text: { type: "text", label: "Teks" } },
        },
      },
      defaultProps: { style: "check", items: [{ text: "Keunggulan pertama" }, { text: "Keunggulan kedua" }, { text: "Keunggulan ketiga" }] },
      render: (props) => <ListBlock {...props} />,
    },
    Divider: {
      label: "Garis pemisah",
      fields: {
        style: {
          type: "select",
          label: "Gaya garis",
          options: [
            { label: "Garis penuh", value: "solid" },
            { label: "Putus-putus", value: "dashed" },
            { label: "Titik-titik", value: "dotted" },
            { label: "Ganda", value: "double" },
            { label: "Memudar di kedua ujung", value: "gradient" },
            { label: "Memudar menjauhi teks", value: "fade" },
          ],
        },
        thickness: sizeField("Tebal garis", { min: 1, max: 8, unit: "px", fallback: 1 }),
        color: colorField("Warna garis", "Otomatis: warna garis tema."),
        length: {
          type: "radio",
          label: "Panjang",
          options: [
            { label: "Penuh", value: "full" },
            { label: "Setengah", value: "half" },
            { label: "Pendek", value: "short" },
          ],
        },
        text: { type: "text", label: "Teks (boleh kosong)", placeholder: "Misalnya: atau" },
        icon: iconField("Ikon (boleh kosong)"),
        position: {
          type: "radio",
          label: "Letak teks",
          options: [
            { label: "Kiri", value: "left" },
            { label: "Tengah", value: "center" },
            { label: "Kanan", value: "right" },
          ],
        },
        label_style: {
          type: "radio",
          label: "Gaya teks",
          options: [
            { label: "Polos", value: "plain" },
            { label: "Kapsul", value: "pill" },
          ],
        },
      },
      defaultProps: { style: "solid", thickness: 0, color: "", length: "full", text: "", icon: "", position: "center", label_style: "plain" },
      render: (props) => <DividerBlock {...props} />,
    },

    // --- Komponen ----------------------------------------------------------
    Alert: {
      label: "Pengumuman",
      fields: {
        variant: {
          type: "select",
          label: "Jenis",
          options: [
            { label: "Biasa", value: "default" },
            { label: "Info", value: "info" },
            { label: "Berhasil", value: "success" },
            { label: "Perhatian", value: "warning" },
            { label: "Penting", value: "destructive" },
          ],
        },
        title: { type: "text", label: "Judul" },
        description: { type: "textarea", label: "Isi" },
      },
      defaultProps: { variant: "info", title: "Libur nasional", description: "Kami tutup pada tanggal merah dan buka kembali keesokan harinya." },
      render: (props) => <AlertBlock {...props} />,
    },
    Accordion: {
      label: "Buka-tutup",
      fields: {
        variant: {
          type: "select",
          label: "Gaya",
          options: [
            { label: "Polos", value: "plain" },
            { label: "Satu kotak", value: "boxed" },
            { label: "Kotak terpisah", value: "separated" },
            { label: "Berlatar", value: "solid" },
            { label: "Kartu berbayang", value: "shadow" },
          ],
        },
        indicator: {
          type: "radio",
          label: "Penanda",
          options: [
            { label: "Panah", value: "chevron" },
            { label: "Plus / silang", value: "plus" },
            { label: "Tanpa", value: "none" },
          ],
        },
        multiple: {
          type: "radio",
          label: "Beberapa butir terbuka bersamaan",
          options: [
            { label: "Tidak", value: "no" },
            { label: "Ya", value: "yes" },
          ],
        },
        open: { type: "number", label: "Butir yang terbuka saat halaman dibuka (0 = semua tertutup)", min: 0, max: 30 },
        items: {
          type: "array",
          label: "Butir",
          max: 30,
          getItemSummary: (item) => item.title || "Butir kosong",
          defaultItemProps: { title: "Judul", icon: "", content: "Isinya.", body: [] },
          arrayFields: {
            title: { type: "text", label: "Judul" },
            icon: iconField("Ikon (boleh kosong)"),
            content: { type: "textarea", label: "Isi" },
            body: { type: "slot", label: "Komponen tambahan", allow: inItem },
          },
        },
      },
      defaultProps: {
        variant: "plain",
        indicator: "chevron",
        multiple: "no",
        open: 0,
        items: [
          { title: "Judul pertama", icon: "", content: "Isi yang muncul saat judul diklik.", body: [] },
          { title: "Judul kedua", icon: "", content: "Isi yang muncul saat judul diklik.", body: [] },
        ],
      },
      render: (props) => <AccordionBlock {...(props as unknown as ComponentProps<typeof AccordionBlock>)} />,
    },
    Tabs: {
      label: "Tab",
      fields: {
        variant: {
          type: "select",
          label: "Gaya",
          options: [
            { label: "Pil (bawaan)", value: "pill" },
            { label: "Garis bawah", value: "line" },
            { label: "Tombol bulat", value: "outline" },
            { label: "Tegak di samping", value: "vertical" },
          ],
        },
        align: {
          type: "radio",
          label: "Letak tab",
          options: [
            { label: "Kiri", value: "left" },
            { label: "Tengah", value: "center" },
            { label: "Penuh", value: "stretch" },
          ],
        },
        active: { type: "number", label: "Tab yang terbuka saat halaman dibuka (urutan)", min: 1, max: 8 },
        items: {
          type: "array",
          label: "Tab",
          min: 1,
          max: 8,
          getItemSummary: (item) => item.label || "Tab tanpa nama",
          defaultItemProps: { label: "Tab baru", icon: "", content: "Isi tab.", body: [] },
          arrayFields: {
            label: { type: "text", label: "Nama tab" },
            icon: iconField("Ikon (boleh kosong)"),
            content: { type: "textarea", label: "Isi" },
            body: { type: "slot", label: "Komponen tambahan", allow: inItem },
          },
        },
      },
      defaultProps: {
        variant: "pill",
        align: "left",
        active: 1,
        items: [
          { label: "Pagi", icon: "sun", content: "Buka pukul 08.00–12.00.", body: [] },
          { label: "Sore", icon: "moon", content: "Buka pukul 13.00–17.00.", body: [] },
        ],
      },
      render: (props) => <TabsBlock {...(props as unknown as ComponentProps<typeof TabsBlock>)} />,
    },
    Quote: {
      label: "Kutipan",
      fields: {
        quote: { type: "textarea", label: "Kutipan" },
        name: { type: "text", label: "Nama" },
        role: { type: "text", label: "Keterangan" },
      },
      defaultProps: { quote: "Kalimat yang ingin ditonjolkan.", name: "", role: "" },
      render: (props) => <QuoteBlock {...props} />,
    },
    Profile: {
      label: "Profil",
      fields: {
        image: imageField("Foto"),
        name: { type: "text", label: "Nama" },
        role: { type: "text", label: "Jabatan atau keterangan" },
      },
      defaultProps: { image: null, name: "Nama orang", role: "Jabatan" },
      render: (props) => <ProfileBlock {...props} />,
    },
    Stat: {
      label: "Angka",
      fields: {
        number: { type: "number", label: "Angka" },
        prefix: { type: "text", label: "Awalan", placeholder: "Misalnya: ±" },
        suffix: { type: "text", label: "Akhiran", placeholder: "Misalnya: +, jam, pelanggan" },
        label: { type: "text", label: "Keterangan" },
        format: numberFormatField,
        decimals: decimalsField,
        count: animateField,
        font_size: sizeField("Ukuran angka", { min: 20, max: 120, unit: "px", fallback: 36 }),
        color: colorField("Warna angka"),
        align: alignField,
      },
      defaultProps: {
        number: 500,
        prefix: "",
        suffix: "+",
        label: "Pelanggan",
        format: "plain",
        decimals: 0,
        count: "yes",
        font_size: 0,
        color: "",
        align: "left",
      },
      // Data lama menyimpan angka sebagai teks; dipindah ke isian baru saat dibuka di editor.
      resolveData: ({ props }) => ({ props: migrateStat(props) }),
      render: (props) => <StatBlock {...props} />,
    },

    // --- Media dan efek ----------------------------------------------------
    Video: {
      label: "Video",
      fields: {
        url: { type: "text", label: "Tautan YouTube", placeholder: "https://www.youtube.com/watch?v=…" },
        title: { type: "text", label: "Judul video (untuk pembaca layar)" },
        style: {
          type: "radio",
          label: "Cara memutar",
          options: [
            { label: "Gambar + tombol putar", value: "dialog" },
            { label: "Langsung di halaman", value: "inline" },
          ],
        },
        thumbnail: imageField("Gambar sampul (kosongkan untuk sampul YouTube)"),
        frame: {
          type: "select",
          label: "Bingkai",
          options: [
            { label: "Tanpa bingkai", value: "none" },
            { label: "Jendela peramban", value: "browser" },
          ],
        },
      },
      defaultProps: { url: "", title: "", style: "dialog", thumbnail: null, frame: "none" },
      render: (props) => <VideoBlock {...props} />,
    },
    AvatarStack: {
      label: "Tumpukan avatar",
      fields: {
        people: {
          type: "array",
          label: "Orang",
          max: 8,
          getItemSummary: (item) => item.name || "Tanpa nama",
          defaultItemProps: { name: "Nama", image: null },
          arrayFields: { name: { type: "text", label: "Nama" }, image: imageField("Foto") },
        },
        more: { type: "text", label: "Lingkaran terakhir", placeholder: "Misalnya: +99" },
        caption: { type: "text", label: "Kalimat di sampingnya" },
        avatar_style: {
          type: "radio",
          label: "Avatar bila tanpa foto",
          options: [
            { label: "Ilustrasi (DiceBear)", value: "notionists" },
            { label: "Inisial nama", value: "initials" },
          ],
        },
        align: alignField,
      },
      defaultProps: {
        avatar_style: "notionists",
        people: ["Sari Wulandari", "Budi Santoso", "Rina Wati", "Agus Pratama"].map((name) => ({ name, image: null })),
        more: "+500",
        caption: "Dipercaya lebih dari 500 pelanggan",
        align: "left",
      },
      render: (props) => <AvatarStackBlock {...props} />,
    },
    TextMarquee: {
      label: "Teks berjalan",
      fields: {
        text: { type: "textarea", label: "Kata-kata (pisahkan dengan koma)" },
        size: {
          type: "radio",
          label: "Ukuran",
          options: [
            { label: "Sedang", value: "medium" },
            { label: "Besar", value: "large" },
          ],
        },
        font_size: sizeField("Ukuran huruf kustom", { min: 16, max: 160, unit: "px", fallback: 60 }),
        color: colorField("Warna teks"),
        separator: iconField("Ikon pemisah (boleh kosong)"),
        separator_color: colorField("Warna ikon pemisah", "Otomatis: warna aksen."),
        speed: {
          type: "radio",
          label: "Kecepatan",
          options: [
            { label: "Pelan", value: "slow" },
            { label: "Sedang", value: "normal" },
            { label: "Cepat", value: "fast" },
          ],
        },
        reverse: {
          type: "radio",
          label: "Arah",
          options: [
            { label: "Ke kiri", value: "no" },
            { label: "Ke kanan", value: "yes" },
          ],
        },
      },
      defaultProps: {
        text: "Cepat, Rapi, Terpercaya, Harga jelas, Bergaransi",
        size: "large",
        font_size: 0,
        color: "",
        separator: "sparkle",
        separator_color: "",
        speed: "normal",
        reverse: "no",
      },
      render: (props) => <TextMarqueeBlock {...props} />,
    },
    AnimatedList: {
      label: "Notifikasi berjalan",
      fields: {
        items: {
          type: "array",
          label: "Notifikasi",
          max: 20,
          getItemSummary: (item) => item.title || "Notifikasi kosong",
          defaultItemProps: { icon: "package", title: "Pesanan baru", description: "", time: "baru saja" },
          arrayFields: {
            icon: iconField("Ikon"),
            title: { type: "text", label: "Judul" },
            description: { type: "text", label: "Keterangan" },
            time: { type: "text", label: "Waktu", placeholder: "Misalnya: 2 menit lalu" },
          },
        },
        visible: {
          type: "radio",
          label: "Yang tampil sekaligus",
          options: [
            { label: "3", value: "3" },
            { label: "4", value: "4" },
            { label: "5", value: "5" },
          ],
        },
      },
      defaultProps: {
        visible: "4",
        items: [
          { icon: "package", title: "Pesanan baru", description: "Sari dari Bandung memesan 2 paket.", time: "baru saja" },
          { icon: "star", title: "Ulasan bintang 5", description: "“Cepat dan rapi, pasti pesan lagi.”", time: "3 menit lalu" },
          { icon: "truck", title: "Pesanan dikirim", description: "Pesanan Budi sedang dalam perjalanan.", time: "10 menit lalu" },
          { icon: "users", title: "Pelanggan baru", description: "Rina bergabung hari ini.", time: "15 menit lalu" },
          { icon: "wallet", title: "Pembayaran diterima", description: "Terima kasih, Agus!", time: "20 menit lalu" },
        ],
      },
      render: (props) => <AnimatedListBlock {...props} />,
    },
    Orbit: {
      label: "Ikon mengorbit",
      fields: {
        center: iconField("Ikon tengah"),
        center_color: colorField("Warna ikon tengah", "Otomatis: warna utama."),
        shape: {
          type: "radio",
          label: "Bentuk ikon",
          options: [
            { label: "Sudut tumpul", value: "rounded" },
            { label: "Bulat", value: "circle" },
          ],
        },
        items: {
          type: "array",
          label: "Ikon yang mengorbit",
          min: 1,
          max: 10,
          getItemSummary: (item, index) => item.icon || `Ikon ${(index ?? 0) + 1}`,
          defaultItemProps: { icon: "star", color: "" },
          arrayFields: { icon: iconField("Ikon"), color: colorField("Warna", "Otomatis: bergaris.") },
        },
        speed: {
          type: "radio",
          label: "Kecepatan",
          options: [
            { label: "Pelan", value: "slow" },
            { label: "Sedang", value: "normal" },
            { label: "Cepat", value: "fast" },
          ],
        },
      },
      defaultProps: {
        center: "store",
        center_color: "",
        shape: "circle",
        speed: "normal",
        items: [
          { icon: "truck", color: "#0ea5e9" },
          { icon: "wallet", color: "#22c55e" },
          { icon: "headset", color: "" },
          { icon: "shield", color: "#6366f1" },
          { icon: "clock", color: "" },
          { icon: "star", color: "#f59e0b" },
          { icon: "users", color: "" },
        ],
      },
      render: (props) => <OrbitBlock {...props} />,
    },
    Feature: {
      label: "Poin unggulan",
      fields: {
        icon: iconField("Ikon"),
        title: { type: "text", label: "Judul" },
        description: { type: "textarea", label: "Keterangan" },
        style: {
          type: "radio",
          label: "Gaya",
          options: [
            { label: "Polos", value: "default" },
            { label: "Bergaris", value: "outline" },
            { label: "Berlatar", value: "muted" },
          ],
        },
      },
      defaultProps: { icon: "sparkles", title: "Keunggulan", description: "Satu kalimat: apa untungnya bagi pelanggan.", style: "outline" },
      render: (props) => <FeatureBlock {...props} />,
    },
  },
}

/**
 * Tampilan bagian (ukuran, latar, pola, id, layar) untuk setiap bagian
 * halaman: nilai bawaan `appearance`, dan render yang dibungkus `Surface`.
 * Isiannya bukan isian Puck, melainkan tab Tampilan di panel editor
 * (`AppearanceInput`). Elemen dan komponen di dalam wadah tidak memakainya —
 * wadahnya yang mengatur.
 */
function withLook<C>(component: C, look: Partial<Appearance> = {}): C {
  const base = component as unknown as ComponentConfig<DefaultComponentProps>
  const wrapped: ComponentConfig<DefaultComponentProps> = {
    ...base,
    defaultProps: { ...base.defaultProps, appearance: { ...defaultAppearance, ...look } },
    render: (props) => (
      <Surface appearance={props.appearance as Partial<Appearance> | undefined} puck={props.puck}>
        {base.render(props)}
      </Surface>
    ),
  }
  return wrapped as unknown as C
}

function applyLook<K extends keyof Blocks>(name: K, look?: Partial<Appearance>) {
  pageConfig.components[name] = withLook(pageConfig.components[name], look)
}

/**
 * Animasi muncul (motion) untuk setiap elemen dan komponen: isian "Animasi"
 * di akhir panel, dan render yang dibungkus `Animate`. Bagian halaman
 * mengaturnya di tab Tampilan.
 */
function withMotion<C>(component: C): C {
  const base = component as unknown as ComponentConfig<DefaultComponentProps>
  const wrapped: ComponentConfig<DefaultComponentProps> = {
    ...base,
    fields: { ...base.fields, motion: motionField },
    defaultProps: { ...base.defaultProps, motion: defaultMotion },
    render: (props) => (
      <Animate settings={props.motion as Partial<MotionSettings> | undefined} preview={props.puck.isEditing}>
        {base.render(props)}
      </Animate>
    ),
  }
  return wrapped as unknown as C
}

function applyMotion<K extends keyof Blocks>(name: K) {
  pageConfig.components[name] = withMotion(pageConfig.components[name])
}

for (const name of [...elements, ...components, "Row", "Grid", "Card"] as (keyof Blocks)[]) applyMotion(name)

/** Blok yang punya Tampilan bagian. */
export const sectionBlocks: (keyof Blocks)[] = [
  "Hero",
  "Text",
  "ImageText",
  "Services",
  "Gallery",
  "Testimonials",
  "Faq",
  "CallToAction",
  "Contact",
  "Logos",
  "Features",
  "Stats",
  "Steps",
  "Pricing",
  "Team",
  "PageTitle",
  "PriceList",
  "Promo",
  "Location",
  "BeforeAfter",
  "Portfolio",
  "Reviews",
  "Awards",
  "About",
  "History",
  "Section",
]
for (const name of sectionBlocks) applyLook(name, name === "Hero" ? { pattern: "grid" } : undefined)

/** Kategori di setiap tab daftar blok editor. */
export const drawerTabs = {
  blocks: ["pembuka", "fitur", "tentang", "kepercayaan", "galeri", "harga", "ajakan"],
  components: ["tata_letak", "dasar", "lainnya", "interaktif", "data", "efek"],
} as const

/** Teks bawaan editor Puck dalam bahasa Indonesia. */
export const editorDictionary: Dictionary = {
  "header-publish": "Terbitkan",
  "header-undo": "Urungkan",
  "header-redo": "Ulangi",
  "header-toggle-leftsidebar": "Tampilkan atau sembunyikan daftar blok",
  "header-toggle-rightsidebar": "Tampilkan atau sembunyikan isian",
  "header-toggle-menubar": "Tampilkan atau sembunyikan menu",
  "action-selectparent": "Pilih induknya",
  "action-duplicate": "Gandakan",
  "action-delete": "Hapus",
  "label-page": "Halaman",
  "label-component": "Blok",
  "outline-empty": "Belum ada blok",
  "outline-item-collapse": "Tutup",
  "outline-item-expand": "Buka",
  "outline-header-title": "Susunan",
  "outline-header-collapseall": "Tutup semua",
  "outline-item-duplicate": "Gandakan",
  "outline-item-delete": "Hapus",
  "drawer-category-collapse": "Tutup {title}",
  "drawer-category-expand": "Buka {title}",
  "drawer-category-other": "Lainnya",
  "canvas-noconfig": "Blok {type} tidak dikenal",
  "field-readonly": "Hanya baca",
  "field-arrayitem-summary": "Butir #{index}",
  "field-arrayitem-duplicate": "Gandakan",
  "field-arrayitem-delete": "Hapus",
  "field-richtext-bold": "Tebal",
  "field-richtext-italic": "Miring",
  "field-richtext-underline": "Garis bawah",
  "field-richtext-strikethrough": "Coret",
  "field-richtext-blockquote": "Kutipan",
  "field-richtext-code-inline": "Kode",
  "field-richtext-code-block": "Blok kode",
  "field-richtext-list-bullet": "Daftar berpoin",
  "field-richtext-list-ordered": "Daftar bernomor",
  "field-richtext-horizontalrule": "Garis pemisah",
  "field-richtext-align-left": "Rata kiri",
  "field-richtext-align-center": "Rata tengah",
  "field-richtext-align-right": "Rata kanan",
  "field-richtext-align-justify": "Rata penuh",
  "field-richtext-select": "Pilih",
  "field-richtext-headingselect-1": "Judul 1",
  "field-richtext-headingselect-2": "Judul 2",
  "field-richtext-headingselect-3": "Judul 3",
  "field-richtext-headingselect-4": "Judul 4",
  "field-richtext-headingselect-5": "Judul 5",
  "field-richtext-headingselect-6": "Judul 6",
  "field-richtext-alignselect-left": "Kiri",
  "field-richtext-alignselect-center": "Tengah",
  "field-richtext-alignselect-right": "Kanan",
  "field-richtext-alignselect-justify": "Penuh",
  "field-richtext-listselect-bullet": "Daftar berpoin",
  "field-richtext-listselect-ordered": "Daftar bernomor",
}
