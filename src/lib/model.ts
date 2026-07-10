/**
 * Datamodel for en deal: de manuelt indhentede oplysninger, som ikke kan
 * hentes via API (lejeforhold, driftsøkonomi, stand, pris, juridisk).
 * Strukturen følger spørgerammen til sælger/mægler.
 */
import type { AdresseMatch, AutoIndhentning } from "@/integrations/types";

export type DealStatus =
  | "screening"
  | "shortlist"
  | "dialog"
  | "indhentning"
  | "klar"
  | "lukket"
  | "afvist";

export const STATUS_LABELS: Record<DealStatus, string> = {
  screening: "Screening",
  shortlist: "Shortlist",
  dialog: "Dialog med sælger",
  indhentning: "Manuel indhentning",
  klar: "Klar til sourcing",
  lukket: "Lukket",
  afvist: "Afvist",
};

export const STATUS_RAEKKEFOELGE: DealStatus[] = [
  "screening",
  "shortlist",
  "dialog",
  "indhentning",
  "klar",
  "lukket",
  "afvist",
];

/* ---------- Lejeforhold (manuel - fra sælger/mægler) ---------- */

export interface Lejemaal {
  id: string;
  betegnelse: string; // fx "2. tv"
  type: "bolig" | "erhverv";
  areal: number | null;
  maanedsleje: number | null; // kr./md. ekskl. forbrug
  tomgang: boolean;
  tomgangSiden: string | null; // ISO-dato
  lejemaalStart: string | null;
  opsigelsesvarsel: string | null;
  huslejenaevnssag: boolean;
  note: string;
}

export interface Lejeforhold {
  /** Afgørende for afkastpotentiale */
  lejeregulering: "omkostningsbestemt" | "fri_leje" | "smaahusreglerne" | "blandet" | "ukendt";
  lejemaal: Lejemaal[];
  verserendeHuslejenaevnssager: string;
  note: string;
}

/* ---------- Driftsøkonomi (manuel - bed om 2-3 års regnskab) ---------- */

export interface DriftsAar {
  aar: number;
  bruttolejeindtaegt: number | null;
  ejendomsskat: number | null;
  forsikring: number | null;
  vedligehold: number | null;
  administration: number | null;
  renovation: number | null;
  oevrigeUdgifter: number | null;
}

export interface Oekonomi {
  driftsaar: DriftsAar[];
  planlagteForbedringer: string;
  pblVarsling: string; // §-varslinger der påvirker fremtidig leje
}

/* ---------- Stand (manuel - besigtigelse) ---------- */

export type StandKarakter = 1 | 2 | 3 | 4 | 5 | null; // 1 = kritisk, 5 = nyistandsat

export interface Stand {
  tag: StandKarakter;
  facade: StandKarakter;
  vvs: StandKarakter;
  el: StandKarakter;
  vinduer: StandKarakter;
  renoveringsbudget: number | null; // skønnet, kr.
  note: string;
}

/* ---------- Pris og finansiering (manuel) ---------- */

export interface PrisFinansiering {
  udbudspris: number | null;
  forventetKoebspris: number | null;
  eksisterendeBelaaning: number | null;
  belaaningKanOvertages: boolean;
  belaaningRentePct: number | null;
  saelgersMotivation: string;
  tidshorisont: string;
}

/* ---------- Juridisk (manuel - tingbogsattest m.m.) ---------- */

export interface Juridisk {
  tingbogsattestIndhentet: boolean;
  haeftelser: string;
  servitutter: string;
  verserendeSager: string; // huslejenævn, boligret, syn & skøn
  note: string;
}

/* ---------- Dokumenter ---------- */

export const DOKUMENT_KATEGORIER = [
  "Driftsregnskab",
  "Lejekontrakt",
  "Tingbogsattest",
  "Tilstandsvurdering",
  "Salgsprospekt",
  "Andet",
] as const;

export interface Dokument {
  id: number;
  dealId: number;
  kategori: string;
  filnavn: string;
  sti: string;
  uploadet: string;
}

/* ---------- CRM: kontaktlog og investorer ---------- */

export const KONTAKT_KANALER = ["Telefon", "E-mail", "Brev", "Møde", "Besigtigelse", "Andet"] as const;

export interface Kontakt {
  id: number;
  dealId: number;
  dato: string; // ISO-dato
  kanal: string;
  person: string; // hvem talte du med (sælger, mægler, kurator...)
  resume: string;
  naesteSkridt: string;
  naesteSkridtDato: string | null;
}

export const INVESTOR_MATCH_STATUSSER = ["Foreslået", "Kontaktet", "Interesseret", "Afvist"] as const;

export interface Investor {
  id: number;
  navn: string;
  selskab: string;
  kontaktinfo: string; // e-mail/telefon
  fokus: string; // område/ejendomstype
  budget: string; // fritekst, fx "10-30 mio."
  note: string;
  oprettet: string;
}

export interface InvestorMatch {
  id: number;
  dealId: number;
  investorId: number;
  investorNavn: string;
  status: string;
  note: string;
  opdateret: string;
}

/* ---------- Den samlede deal ---------- */

export interface Deal {
  id: number;
  status: DealStatus;
  oprettet: string;
  opdateret: string;
  adresse: AdresseMatch;
  auto: AutoIndhentning | null;
  lejeforhold: Lejeforhold;
  oekonomi: Oekonomi;
  stand: Stand;
  pris: PrisFinansiering;
  juridisk: Juridisk;
  noter: string;
}

export function tomLejeforhold(): Lejeforhold {
  return { lejeregulering: "ukendt", lejemaal: [], verserendeHuslejenaevnssager: "", note: "" };
}
export function tomOekonomi(): Oekonomi {
  return { driftsaar: [], planlagteForbedringer: "", pblVarsling: "" };
}
export function tomStand(): Stand {
  return { tag: null, facade: null, vvs: null, el: null, vinduer: null, renoveringsbudget: null, note: "" };
}
export function tomPris(): PrisFinansiering {
  return {
    udbudspris: null,
    forventetKoebspris: null,
    eksisterendeBelaaning: null,
    belaaningKanOvertages: false,
    belaaningRentePct: null,
    saelgersMotivation: "",
    tidshorisont: "",
  };
}
export function tomJuridisk(): Juridisk {
  return { tingbogsattestIndhentet: false, haeftelser: "", servitutter: "", verserendeSager: "", note: "" };
}
