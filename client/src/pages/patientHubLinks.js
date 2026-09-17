import {
  Activity,
  CalendarDays,
  ClipboardList,
  FileText,
  Heart,
  HeartPulse,
  ImageIcon,
  Map as MapIcon,
  Inbox,
  MessageSquare,
  MapPinned,
  Mic,
  Pill,
  Receipt,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  UserRound,
  Users,
  Video,
  Building2,
  ListChecks,
  BookHeart,
  Search,
} from "lucide-react";

/** @typedef {{ to: string; key: string; subtitleKey?: string; ariaKey?: string; icon: import('react').ComponentType<{ size?: number; strokeWidth?: number }>; tileClass?: string }} PatientHubLink */

/** Practice / hybrid — shown under „Meine Praxis“. */
// Phase 2E.1: the appointments tile moved into the practice context
// (/patient/practice/:linkId/appointments) and was removed here. Phase 2E.2 did
// the same for documents (/patient/practice/:linkId/documents). The transitional
// area shrinks one tile per migration; when it is empty the route goes with it.
//
// The cross-practice list at /patient/practice-documents still EXISTS and still
// owns what the scoped page does not: translation, plain language and the
// share-grant management. It stays reachable from the account documents page,
// the data-control page and the mobile bottom navigation — only this entry point
// is gone, so the two document views no longer compete for the same tile.
export const PATIENT_PRACTICE_HUB_LINKS = /** @type {PatientHubLink[]} */ ([
  { to: "/patient/inbox", key: "hubLinkInbox", subtitleKey: "hubLinkInboxSub", icon: Inbox },
  {
    to: "/patient/messages",
    key: "hubLinkThreads",
    subtitleKey: "hubLinkThreadsSub",
    icon: MessageSquare,
  },
  {
    to: "/patient/telemedicine",
    key: "hubLinkTelemedicine",
    subtitleKey: "hubLinkTelemedicineSub",
    icon: Video,
  },
  {
    to: "/patient/erezept",
    key: "hubLinkPracticeErezept",
    subtitleKey: "hubLinkPracticeErezeptSub",
    icon: Receipt,
  },
  {
    to: "/pre-visit/medications",
    key: "hubLinkVisitMedications",
    subtitleKey: "hubLinkVisitMedicationsSub",
    icon: Pill,
  },
  {
    to: "/patient/data-control",
    key: "hubLinkDataControl",
    subtitleKey: "hubLinkDataControlSub",
    icon: Users,
  },
  {
    to: "/patient/activity",
    key: "hubLinkPatientActivity",
    subtitleKey: "hubLinkPatientActivitySub",
    icon: Activity,
  },
  {
    to: "/pre-visit/cases",
    key: "hubLinkCases",
    subtitleKey: "hubLinkCasesSub",
    icon: Stethoscope,
  },
  {
    to: "/patient/find-practices",
    key: "hubLinkFindPractices",
    subtitleKey: "hubLinkFindPracticesSub",
    icon: MapPinned,
  },
  {
    to: "/patient/medscoutx-practices",
    key: "hubLinkMedScoutXDirectory",
    subtitleKey: "hubLinkMedScoutXDirectorySub",
    icon: Search,
  },
]);

/** Symptom Check, Bildanalyse, Körperkarte — grouped under „Beschwerden erfassen“. */
export const PATIENT_ORIENTATION_HUB_LINKS = /** @type {PatientHubLink[]} */ ([
  {
    to: "/symptom",
    key: "hubLinkSymptom",
    subtitleKey: "hubLinkSymptomSub",
    icon: Activity,
  },
  {
    to: "/bild",
    key: "hubLinkImage",
    subtitleKey: "hubLinkImageSub",
    icon: ImageIcon,
  },
  {
    to: "/region-start",
    key: "hubLinkBody",
    subtitleKey: "hubLinkBodySub",
    icon: MapIcon,
  },
]);

export const PATIENT_ORIENTATION_MAIN_HUB_LINK = /** @type {PatientHubLink} */ ({
  to: "/patient/orientation",
  key: "hubLinkOrientation",
  subtitleKey: "hubLinkOrientationSub",
  ariaKey: "hubLinkOrientationAria",
  icon: ListChecks,
  tileClass: "workspace-hub__tile--orientation-hub",
});

/** B2C / personal — remain on the main patient overview. */
export const PATIENT_MAIN_HUB_LINKS = /** @type {PatientHubLink[]} */ ([
  {
    to: "/patient/medication-plans",
    key: "hubLinkMedicationPlans",
    subtitleKey: "hubLinkMedicationPlansSub",
    icon: Pill,
  },
  {
    to: "/account/health",
    key: "hubLinkHealthProfile",
    subtitleKey: "hubLinkHealthProfileSub",
    icon: Heart,
  },
  {
    to: "/pre-visit",
    key: "hubLinkPreVisit",
    subtitleKey: "hubLinkPreVisitSub",
    icon: HeartPulse,
  },
  PATIENT_ORIENTATION_MAIN_HUB_LINK,
  {
    to: "/pre-visit/my-preparations",
    key: "hubLinkMyPrep",
    subtitleKey: "hubLinkMyPrepSub",
    icon: ClipboardList,
  },
  {
    to: "/settings/doctor-contacts",
    key: "hubLinkDoctors",
    subtitleKey: "hubLinkDoctorsSub",
    icon: UserRound,
  },
  {
    to: "/account/documents",
    key: "hubLinkDocuments",
    subtitleKey: "hubLinkDocumentsSub",
    icon: FileText,
  },
  {
    to: "/patient/vaccinations",
    key: "hubLinkVaccinations",
    subtitleKey: "hubLinkVaccinationsSub",
    icon: ShieldCheck,
  },
  {
    to: "/patient/vitals",
    key: "hubLinkVitals",
    subtitleKey: "hubLinkVitalsSub",
    icon: TrendingUp,
  },
  {
    to: "/patient/health-history",
    key: "hubLinkHealthHistory",
    subtitleKey: "hubLinkHealthHistorySub",
    icon: BookHeart,
  },
  {
    to: "/patient/meda-realtime",
    key: "hubLinkMedaLive",
    subtitleKey: "hubLinkMedaLiveSub",
    icon: Mic,
  },
]);

export const PATIENT_MY_PRACTICE_HUB_LINK = /** @type {PatientHubLink} */ ({
  to: "/patient/practice",
  key: "hubLinkMyPractice",
  subtitleKey: "hubLinkMyPracticeSub",
  ariaKey: "hubLinkMyPracticeAria",
  icon: Building2,
  tileClass: "workspace-hub__tile--practice-hub",
});
