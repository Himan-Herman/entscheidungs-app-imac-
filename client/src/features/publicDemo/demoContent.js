/**
 * Static dummy content for the public Messe/DemoDay showcase ("/demo").
 *
 * EVERYTHING here is fictional sample data. There is no API call, no token, and no
 * real patient/practice information anywhere in this file. Names, dates, values and
 * codes are invented purely for visual demonstration.
 *
 * Prose (tile label / subtitle / detail intro / status badges) lives in the i18n
 * namespace `publicDemo`; the language-neutral sample rows (fake names, dates,
 * numbers) live here so the modal looks realistic in every language.
 */
import {
  Activity,
  CalendarDays,
  ClipboardList,
  FolderOpen,
  MessageSquare,
  Pill,
  Receipt,
  ShieldCheck,
  TrendingUp,
  Users,
  Video,
} from "lucide-react";

/**
 * @typedef {{ primary: string; secondary: string; badge?: string }} DemoRow
 * @typedef {{ id: string; icon: import('react').ComponentType<{ size?: number; strokeWidth?: number }>; rows: DemoRow[] }} DemoTile
 */

/** Patient-side showcase tiles. @type {DemoTile[]} */
export const PATIENT_DEMO_TILES = [
  {
    id: "appointments",
    icon: CalendarDays,
    rows: [
      { primary: "Dr. Anna Schmidt — Hausarztpraxis", secondary: "12.07.2026 · 09:30", badge: "scheduled" },
      { primary: "Radiologie Mitte — MRT Knie", secondary: "18.07.2026 · 14:00", badge: "scheduled" },
      { primary: "Dr. Lukas Weber — Kontrolle", secondary: "02.08.2026 · 11:15", badge: "pending" },
    ],
  },
  {
    id: "messages",
    icon: MessageSquare,
    rows: [
      { primary: "Hausarztpraxis Schmidt", secondary: "Ihr Befund liegt vor — bitte Termin vereinbaren.", badge: "info" },
      { primary: "Praxis am Park", secondary: "Rezept wurde ausgestellt und liegt bereit.", badge: "done" },
    ],
  },
  {
    id: "medication",
    icon: Pill,
    rows: [
      { primary: "Ramipril 5 mg", secondary: "1-0-0 · morgens", badge: "ok" },
      { primary: "Metformin 850 mg", secondary: "1-0-1 · zu den Mahlzeiten", badge: "ok" },
      { primary: "Ibuprofen 400 mg", secondary: "bei Bedarf · max. 3×/Tag", badge: "info" },
    ],
  },
  {
    id: "documents",
    icon: FolderOpen,
    rows: [
      { primary: "Laborbefund_Blutbild.pdf", secondary: "05.07.2026 · Hausarztpraxis Schmidt", badge: "done" },
      { primary: "Befund_MRT_Knie.pdf", secondary: "20.07.2026 · Radiologie Mitte", badge: "info" },
    ],
  },
  {
    id: "vitals",
    icon: TrendingUp,
    rows: [
      { primary: "Blutdruck", secondary: "126/82 mmHg · 06.07.2026", badge: "ok" },
      { primary: "Puls", secondary: "72 /min · 06.07.2026", badge: "ok" },
      { primary: "Gewicht", secondary: "74,5 kg · 01.07.2026", badge: "info" },
    ],
  },
  {
    id: "vaccinations",
    icon: ShieldCheck,
    rows: [
      { primary: "Tetanus / Diphtherie", secondary: "Aufgefrischt 03.2024 · nächste 2034", badge: "ok" },
      { primary: "Influenza (Grippe)", secondary: "Saison 2025/2026", badge: "ok" },
      { primary: "FSME", secondary: "Empfehlung offen", badge: "pending" },
    ],
  },
];

/** Practice-side showcase tiles. @type {DemoTile[]} */
export const PRACTICE_DEMO_TILES = [
  {
    id: "patients",
    icon: Users,
    rows: [
      { primary: "M. Mustermann", secondary: "Verknüpft · Einwilligung aktiv", badge: "ok" },
      { primary: "S. Bauer", secondary: "Verknüpft · Pre-Visit eingegangen", badge: "info" },
      { primary: "T. Yılmaz", secondary: "Einladung versendet", badge: "pending" },
    ],
  },
  {
    id: "booking",
    icon: CalendarDays,
    rows: [
      { primary: "Neue Terminanfrage — Erstgespräch", secondary: "Eingegangen 06.07.2026", badge: "pending" },
      { primary: "Terminanfrage — Nachkontrolle", secondary: "Bestätigt für 14.07.2026", badge: "done" },
    ],
  },
  {
    id: "anamnesis",
    icon: ClipboardList,
    rows: [
      { primary: "Vorlage: Allgemeine Anamnese", secondary: "3 neue Einreichungen", badge: "info" },
      { primary: "Einreichung #2041", secondary: "Eingegangen · noch nicht gesichtet", badge: "pending" },
    ],
  },
  {
    id: "billing",
    icon: Receipt,
    rows: [
      { primary: "GOÄ-Prüfung Beleg #5582", secondary: "Katalog geprüft · keine Auffälligkeit", badge: "ok" },
      { primary: "GOÄ-Prüfung Beleg #5583", secondary: "Hinweis: Ziffer 5 prüfen", badge: "review" },
    ],
  },
  {
    id: "telemedicine",
    icon: Video,
    rows: [
      { primary: "Videosprechstunde — M. Mustermann", secondary: "Heute · 16:00", badge: "scheduled" },
      { primary: "Videosprechstunde — S. Bauer", secondary: "Abgeschlossen 05.07.2026", badge: "done" },
    ],
  },
  {
    id: "activity",
    icon: Activity,
    rows: [
      { primary: "Befund freigegeben", secondary: "06.07.2026 · 10:24 · Team-Mitglied A", badge: "done" },
      { primary: "Einwilligung erfasst", secondary: "06.07.2026 · 09:58 · Team-Mitglied B", badge: "ok" },
      { primary: "Terminanfrage angenommen", secondary: "05.07.2026 · 17:12 · Team-Mitglied A", badge: "info" },
    ],
  },
];
