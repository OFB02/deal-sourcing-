/**
 * Domænetyper for de automatiske datakilder.
 *
 * Hver type afspejler de felter, som deal sourcing-processen har brug for -
 * IKKE de rå API-svar. De rigtige klienter skal mappe API-svaret til disse
 * typer, så resten af applikationen er uafhængig af den konkrete kilde.
 */

/** Resultat af adressesøgning (DAWA) */
export interface AdresseMatch {
  /** DAWA adgangsadresse-id (UUID) - bruges som nøgle mod BBR m.fl. */
  id: string;
  /** Fuld betegnelse, fx "Vesterbrogade 12, 1620 København V" */
  betegnelse: string;
  vejnavn: string;
  husnr: string;
  postnr: string;
  postnrnavn: string;
  kommunekode: string;
  /** Matrikelnummer + ejerlav */
  matrikelnr: string;
  ejerlav: string;
  /** ESR/BFE-ejendomsnummer til opslag i vurdering og tingbog */
  bfeNummer: string;
}

/** Bygnings- og enhedsdata fra BBR (via Datafordeler) */
export interface BbrData {
  byggeaar: number;
  omTilbygningsaar: number | null;
  /** BBR-anvendelseskode, fx 140 = etagebolig */
  anvendelseskode: string;
  anvendelseTekst: string;
  samletBoligareal: number;
  samletErhvervsareal: number;
  antalBoligenheder: number;
  antalErhvervsenheder: number;
  antalEtager: number;
  tagmateriale: string | null;
  ydervaegsmateriale: string | null;
  varmeinstallation: string | null;
  /** Enkelt-enheder (lejemål) som BBR kender dem */
  enheder: BbrEnhed[];
}

export interface BbrEnhed {
  adresse: string;
  anvendelse: string;
  areal: number;
  vaerelser: number | null;
  erhverv: boolean;
}

/** Offentlig ejendomsvurdering (Vurderingsportalen / Datafordeler) */
export interface Vurdering {
  vurderingsaar: number;
  ejendomsvaerdi: number;
  grundvaerdi: number;
  /** Historik til at se udvikling */
  historik: { aar: number; ejendomsvaerdi: number }[];
}

/** Ejeroplysninger - CVR-opslag hvis ejer er et selskab */
export interface EjerInfo {
  ejertype: "privatperson" | "selskab" | "doedsbo" | "offentlig" | "ukendt";
  navn: string;
  cvrNummer: string | null;
  /** Årstal ejeren overtog ejendommen (Ejerfortegnelsen). Lang ejertid
   *  = ofte lav bogført værdi og potentiel salgsvilje. */
  overtagelsesAar: number | null;
  /** Kun udfyldt for selskaber */
  selskab: CvrSelskab | null;
}

export type CvrStatus =
  | "Normal"
  | "Under tvangsopløsning"
  | "Under konkurs"
  | "Under likvidation"
  | "Opløst";

export interface CvrSelskab {
  cvrNummer: string;
  navn: string;
  virksomhedsform: string;
  stiftelsesdato: string;
  /** Distress-signal: tvangsopløsning/konkurs vægter tungt i scoringen */
  status: CvrStatus;
  branche: string;
  /** Nøgletal fra seneste offentliggjorte årsregnskaber */
  regnskaber: {
    aar: number;
    resultat: number | null;
    egenkapital: number | null;
  }[];
  reelleEjere: string[];
}

/** Meddelelse fra Statstidende (gratis, opdateres dagligt) */
export interface StatstidendeMeddelelse {
  type: "doedsbo" | "konkurs" | "tvangsoploesning" | "likvidation" | "andet";
  dato: string; // ISO
  overskrift: string;
  resume: string;
  link: string | null;
}

/** Plangrundlag for området (Plandata.dk) */
export interface PlanData {
  kommuneplanramme: string | null;
  anvendelseGenerel: string | null;
  maksBebyggelsesprocent: number | null;
  maksEtager: number | null;
  lokalplaner: {
    planId: string;
    navn: string;
    status: "vedtaget" | "forslag" | "aflyst";
    dato: string;
    link: string | null;
  }[];
}

/** Markedsdata på områdeniveau (Finans Danmark / boligmarkedsstatistik) */
export interface MarkedsData {
  postnr: string;
  /** Realiseret kvm-pris for udlejningsejendomme/etageboliger i området */
  kvmPrisSeneste: number;
  kvmPrisUdvikling1Aar: number; // pct.
  kvmPrisUdvikling5Aar: number; // pct.
  antalHandlerSenesteAar: number;
  /** Typisk afkastkrav i området (skøn) */
  typiskAfkastkravPct: number | null;
}

/**
 * Klient-interfaces. Mock- og rigtige implementeringer skal begge
 * opfylde disse. Se `mock/` og `real/` i samme mappe.
 */
export interface DawaClient {
  /** Autocomplete/adressesøgning */
  soegAdresse(query: string): Promise<AdresseMatch[]>;
  /** Fuldt opslag på ét adresse-id */
  hentAdresse(id: string): Promise<AdresseMatch | null>;
}

export interface BbrClient {
  hentBygningsdata(adresse: AdresseMatch): Promise<BbrData>;
}

export interface VurderingClient {
  hentVurdering(adresse: AdresseMatch): Promise<Vurdering>;
}

export interface EjerClient {
  hentEjerInfo(adresse: AdresseMatch): Promise<EjerInfo>;
}

export interface PlanDataClient {
  hentPlanData(adresse: AdresseMatch): Promise<PlanData>;
}

export interface MarkedsDataClient {
  hentMarkedsData(postnr: string): Promise<MarkedsData>;
}

export interface StatstidendeClient {
  /**
   * Søger meddelelser (dødsboer, konkursdekreter, tvangsopløsninger)
   * der matcher ejendommens ejer. Søg på CVR-nummer når det findes,
   * ellers på navn.
   */
  soegMeddelelser(params: {
    navn?: string;
    cvrNummer?: string | null;
  }): Promise<StatstidendeMeddelelse[]>;
}

/** Kriterier for områdescreening */
export interface ScreeningKriterier {
  postnr: string;
  minLejemaal: number; // typisk 4
  maksLejemaal: number; // typisk 15
}

export interface EjendomsSoegningClient {
  /**
   * Finder kandidat-adresser i et område (postnr). Den rigtige
   * implementering henter alle adgangsadresser fra DAWA og filtrerer
   * efterfølgende på BBR-data (anvendelse + antal enheder).
   */
  findAdresser(postnr: string): Promise<AdresseMatch[]>;
}

/** Samlet resultat af en automatisk indhentning for en ejendom */
export interface AutoIndhentning {
  bbr: BbrData | null;
  vurdering: Vurdering | null;
  ejer: EjerInfo | null;
  plandata: PlanData | null;
  marked: MarkedsData | null;
  /** Statstidende-meddelelser knyttet til ejeren (kan mangle på ældre indhentninger) */
  statstidende?: StatstidendeMeddelelse[] | null;
  /** Kilder der fejlede, med fejlbesked - vises i UI */
  fejl: { kilde: string; besked: string }[];
  hentetTidspunkt: string;
}
