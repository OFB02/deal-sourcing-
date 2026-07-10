/**
 * Skeletter til de RIGTIGE API-klienter.
 *
 * Hver klasse indeholder en beskrivelse af, hvilket API der skal kaldes,
 * og hvordan svaret skal mappes til domænetyperne i `../types.ts`.
 * Når en klient er implementeret, sættes DATASOURCE_<KILDE>=real i .env,
 * og resten af applikationen virker uændret.
 *
 * Kilderne (jf. README):
 *  - DAWA:            åben, gratis, ingen nøgle           -> kan implementeres først
 *  - BBR:             Datafordeler.dk, kræver tjenestebruger
 *  - Vurdering:       Datafordeler.dk (EJVF) el. Vurderingsportalen
 *  - Ejer/CVR:        Datafordeler (EJF ejerfortegnelse) + CVR hos Virk
 *  - Plandata:        Plandata.dk WFS/REST, åben
 *  - Markedsdata:     Finans Danmark boligmarkedsstatistik (åben, aggregeret)
 *
 * OBS: Lejeforhold, driftsregnskaber og tingbog kan IKKE hentes via API
 * (tingbog kræver login + betaling pr. opslag) - de indtastes manuelt i
 * appen under den enkelte deal.
 */
import type {
  AdresseMatch,
  BbrClient,
  BbrData,
  DawaClient,
  EjendomsSoegningClient,
  EjerClient,
  EjerInfo,
  MarkedsData,
  MarkedsDataClient,
  PlanData,
  PlanDataClient,
  StatstidendeClient,
  StatstidendeMeddelelse,
  Vurdering,
  VurderingClient,
} from "../types";

class IkkeImplementeret extends Error {
  constructor(kilde: string, hjaelp: string) {
    super(
      `${kilde}: den rigtige API-klient er ikke implementeret endnu. ${hjaelp} ` +
        `Sæt DATASOURCE-variablen tilbage til "mock", eller implementér klienten i src/integrations/real/clients.ts.`
    );
  }
}

/**
 * DAWA - Danmarks Adressers Web API. Åben og gratis, ingen nøgle.
 * Docs: https://dawadocs.dataforsyningen.dk
 */
export class RealDawaClient implements DawaClient {
  private base = "https://api.dataforsyningen.dk";

  async soegAdresse(query: string): Promise<AdresseMatch[]> {
    // Autocomplete på adgangsadresser:
    const res = await fetch(
      `${this.base}/adgangsadresser/autocomplete?q=${encodeURIComponent(query)}&per_side=10`
    );
    if (!res.ok) throw new Error(`DAWA-fejl: HTTP ${res.status}`);
    const data: any[] = await res.json();
    return Promise.all(
      data.map(async (d) => this.mapAdgangsadresse(await this.hentRaa(d.adgangsadresse.id)))
    );
  }

  async hentAdresse(id: string): Promise<AdresseMatch | null> {
    try {
      return this.mapAdgangsadresse(await this.hentRaa(id));
    } catch {
      return null;
    }
  }

  private async hentRaa(id: string): Promise<any> {
    const res = await fetch(`${this.base}/adgangsadresser/${id}?struktur=nestet`);
    if (!res.ok) throw new Error(`DAWA-fejl: HTTP ${res.status}`);
    return res.json();
  }

  private mapAdgangsadresse(a: any): AdresseMatch {
    return {
      id: a.id,
      betegnelse: `${a.vejstykke.navn} ${a.husnr}, ${a.postnummer.nr} ${a.postnummer.navn}`,
      vejnavn: a.vejstykke.navn,
      husnr: a.husnr,
      postnr: a.postnummer.nr,
      postnrnavn: a.postnummer.navn,
      kommunekode: a.kommune.kode,
      matrikelnr: a.matrikelnr ?? "",
      ejerlav: a.ejerlav?.navn ?? "",
      // BFE-nummer kan slås op via jordstykke/BBR - udfyldes ved BBR-opslaget
      bfeNummer: a.esrejendomsnr ?? "",
    };
  }
}

/**
 * BBR via Datafordeler.dk (REST-tjenesten "BBR Publik").
 * Kræver tjenestebruger (gratis): https://datafordeler.dk
 * Docs: https://confluence.sdfi.dk/x/BgH1 (bemærk: REST-tjenesten
 * udfases ultimo 2026 - mapping-laget her er adskilt fra HTTP-kaldet,
 * så skiftet til afløseren kun rammer datafordeler.ts + felt-navnene).
 *
 * Kald:
 *  - BBR/BBRPublic/1/REST/bygning?husnummer={dawaId}  -> bygninger
 *  - BBR/BBRPublic/1/REST/enhed?bygning={id_lokalId}  -> enheder/lejemål
 *
 * OBS: Felt-mapningen er skrevet efter BBR's grunddatamodel, men er
 * ikke live-testet endnu - kør `node scripts/test-datafordeler.mjs`
 * og justér, hvis et felt afviger.
 */

/** BBR-kodelister (uddrag af de hyppigste koder) */
const TAG_KODER: Record<string, string> = {
  "1": "Tagpap (built-up)",
  "2": "Tagpap (med hældning)",
  "3": "Fibercement (asbest)",
  "4": "Betontagsten",
  "5": "Tegl",
  "6": "Metal",
  "7": "Stråtag",
  "10": "Fibercement (uden asbest)",
  "11": "Plast",
  "12": "Glas",
  "20": "Grønt tag",
  "80": "Ukendt",
  "90": "Andet",
};

const YDERVAEG_KODER: Record<string, string> = {
  "1": "Mursten",
  "2": "Letbeton",
  "3": "Fibercement (asbest)",
  "4": "Bindingsværk",
  "5": "Træ",
  "6": "Betonelementer",
  "8": "Metal",
  "10": "Fibercement (uden asbest)",
  "11": "Plast",
  "12": "Glas",
  "80": "Ukendt",
  "90": "Andet",
};

const VARME_KODER: Record<string, string> = {
  "1": "Fjernvarme/blokvarme",
  "2": "Centralvarme, ét fyringsanlæg",
  "3": "Ovne",
  "5": "Varmepumpe",
  "6": "Centralvarme, to fyringsanlæg",
  "7": "Elovne",
  "8": "Gasradiatorer",
  "9": "Ingen varmeinstallation",
};

interface BbrBygningRaa {
  id_lokalId: string;
  status?: string;
  byg007Bygningsnummer?: number;
  byg021BygningensAnvendelse?: string;
  byg026Opførelsesår?: number;
  byg027OmTilbygningsår?: number;
  byg032YdervæggensMateriale?: string;
  byg033Tagdækningsmateriale?: string;
  byg038SamletBygningsareal?: number;
  byg039BygningensSamledeBoligAreal?: number;
  byg040BygningensSamledeErhvervsAreal?: number;
  byg054AntalEtager?: number;
  byg056Varmeinstallation?: string;
}

interface BbrEnhedRaa {
  id_lokalId: string;
  status?: string;
  enh020EnhedensAnvendelse?: string;
  enh026EnhedensSamledeAreal?: number;
  enh027ArealTilBeboelse?: number;
  enh028ArealTilErhverv?: number;
  enh031AntalVærelser?: number;
}

/** BBR-status 6 = opført, 7 = gældende - resten er anmeldelser/historik */
const AKTIVE_STATUSSER = new Set(["6", "7"]);

export class RealBbrClient implements BbrClient {
  async hentBygningsdata(adresse: AdresseMatch): Promise<BbrData> {
    const { datafordelerHent } = await import("./datafordeler");

    // DAWA's adgangsadresse-id er identisk med DAR-husnummerets id,
    // som BBR's bygninger er knyttet til.
    const bygningerRaa = await datafordelerHent<BbrBygningRaa[]>(
      "BBR/BBRPublic/1/REST/bygning",
      { husnummer: adresse.id, pagesize: 50 }
    );

    const bygninger = bygningerRaa.filter(
      (b) => !b.status || AKTIVE_STATUSSER.has(String(b.status))
    );
    if (bygninger.length === 0) {
      throw new Error(`BBR: ingen aktive bygninger fundet for ${adresse.betegnelse}`);
    }

    // Primær bygning = den med størst boligareal (materialer/byggeår tages herfra)
    const primaer = [...bygninger].sort(
      (a, b) => (b.byg039BygningensSamledeBoligAreal ?? 0) - (a.byg039BygningensSamledeBoligAreal ?? 0)
    )[0];

    // Hent enheder for alle bygninger på adressen
    const enhederRaa: BbrEnhedRaa[] = [];
    for (const byg of bygninger) {
      const e = await datafordelerHent<BbrEnhedRaa[]>("BBR/BBRPublic/1/REST/enhed", {
        bygning: byg.id_lokalId,
        pagesize: 100,
      });
      enhederRaa.push(...e.filter((x) => !x.status || AKTIVE_STATUSSER.has(String(x.status))));
    }

    const enheder = enhederRaa.map((e, i) => {
      // Enhedsanvendelseskoder < 200 er beboelse; erhverv ligger højere
      const erhverv = Number(e.enh020EnhedensAnvendelse ?? 0) >= 200;
      return {
        adresse: `${adresse.vejnavn} ${adresse.husnr}, enhed ${i + 1}`,
        anvendelse: erhverv ? "Erhverv" : "Bolig",
        areal: e.enh026EnhedensSamledeAreal ?? e.enh027ArealTilBeboelse ?? 0,
        vaerelser: e.enh031AntalVærelser ?? null,
        erhverv,
      };
    });

    const boligareal = bygninger.reduce((s, b) => s + (b.byg039BygningensSamledeBoligAreal ?? 0), 0);
    const erhvervsareal = bygninger.reduce((s, b) => s + (b.byg040BygningensSamledeErhvervsAreal ?? 0), 0);
    const antalBolig = enheder.filter((e) => !e.erhverv).length;
    const antalErhverv = enheder.filter((e) => e.erhverv).length;

    // Map til appens interne anvendelses-bucket (styrer screening-filtret):
    // "150" = blandet bolig/erhverv, "140" = ren beboelse (etage m.m.)
    const raaKode = primaer.byg021BygningensAnvendelse ?? "";
    const blandet = boligareal > 0 && erhvervsareal > 0;
    const anvendelseskode = blandet ? "150" : boligareal > 0 ? "140" : raaKode;
    const anvendelseTekst = blandet
      ? `Blandet bolig og erhverv (BBR-kode ${raaKode})`
      : boligareal > 0
        ? `Beboelsesejendom (BBR-kode ${raaKode})`
        : `BBR-kode ${raaKode}`;

    return {
      byggeaar: primaer.byg026Opførelsesår ?? 0,
      omTilbygningsaar: primaer.byg027OmTilbygningsår ?? null,
      anvendelseskode,
      anvendelseTekst,
      samletBoligareal: boligareal,
      samletErhvervsareal: erhvervsareal,
      antalBoligenheder: antalBolig,
      antalErhvervsenheder: antalErhverv,
      antalEtager: Math.max(...bygninger.map((b) => b.byg054AntalEtager ?? 1)),
      tagmateriale: TAG_KODER[primaer.byg033Tagdækningsmateriale ?? ""] ?? primaer.byg033Tagdækningsmateriale ?? null,
      ydervaegsmateriale: YDERVAEG_KODER[primaer.byg032YdervæggensMateriale ?? ""] ?? primaer.byg032YdervæggensMateriale ?? null,
      varmeinstallation: VARME_KODER[primaer.byg056Varmeinstallation ?? ""] ?? primaer.byg056Varmeinstallation ?? null,
      enheder,
    };
  }
}

/**
 * Offentlig ejendomsvurdering via Datafordeler (tjenesten "Ejendomsvurdering").
 * Alternativ: opslag på vurderingsportalen.dk (kun manuel/web).
 */
export class RealVurderingClient implements VurderingClient {
  async hentVurdering(_adresse: AdresseMatch): Promise<Vurdering> {
    // TODO: Kald EJVF-tjenesten med BFE-nummer, map ejendomsværdi/grundværdi
    // og byg historik af de seneste vurderingsår.
    throw new IkkeImplementeret("Ejendomsvurdering", "Kræver Datafordeler-tjenestebruger.");
  }
}

/**
 * Ejeroplysninger: Ejerfortegnelsen (EJF) på Datafordeler giver ejers navn
 * og CVR-nummer. Er ejeren et selskab, beriges med CVR-data fra
 * Erhvervsstyrelsens system-til-system-API (Elasticsearch-baseret):
 * http://distribution.virk.dk/cvr-permanent - kræver aftale med ERST.
 * Årsregnskaber (XBRL) kan hentes åbent via
 * http://distribution.virk.dk/offentliggoerelser
 */
export class RealEjerClient implements EjerClient {
  async hentEjerInfo(_adresse: AdresseMatch): Promise<EjerInfo> {
    // TODO:
    // 1. EJF-opslag på BFE-nummer -> ejers navn + evt. CVR-nummer.
    // 2. Hvis CVR-nummer: slå virksomheden op i CVR og hent seneste
    //    offentliggjorte årsrapporter (resultat + egenkapital).
    // 3. Klassificér ejertype (privatperson/selskab/dødsbo).
    throw new IkkeImplementeret("Ejer/CVR", "Kræver Datafordeler (EJF) og CVR-adgang hos Virk.");
  }
}

/**
 * Plandata.dk - lokalplaner og kommuneplanrammer. Åbne WFS/REST-services.
 * Docs: https://www.plandata.dk/ (se "Datafordeling")
 * Typisk flow: punkt-i-polygon-opslag med adressens koordinat mod
 * temaerne "lokalplan, vedtaget", "lokalplan, forslag" og "kommuneplanramme".
 */
export class RealPlanDataClient implements PlanDataClient {
  async hentPlanData(_adresse: AdresseMatch): Promise<PlanData> {
    // TODO: Hent adressens koordinat fra DAWA-svaret og lav spatialt opslag
    // mod Plandata WFS. Map plannavn, status, dato og bebyggelsesregler.
    throw new IkkeImplementeret("Plandata", "Åbent API - kræver kun implementering.");
  }
}

/**
 * Markedsdata: Finans Danmarks boligmarkedsstatistik (åben, aggregeret
 * på postnr/kommune): https://rkr.statistikbank.dk / boligstat.dk
 * Bemærk: Boliga/DinGeo har ikke åbne API'er til kommerciel brug -
 * systematisk scraping er imod deres vilkår.
 */
export class RealMarkedsDataClient implements MarkedsDataClient {
  async hentMarkedsData(_postnr: string): Promise<MarkedsData> {
    // TODO: Hent kvm-priser og handelsaktivitet for postnummeret/kommunen
    // og beregn 1- og 5-års udvikling.
    throw new IkkeImplementeret("Markedsdata", "Finans Danmark-statistikken er åben.");
  }
}

/**
 * Statstidende - kundgørelser af dødsboer (proklama), konkursdekreter og
 * tvangsopløsninger. Gratis og opdateres dagligt.
 * API: https://api.statstidende.dk (kræver gratis oprettelse/certifikat -
 * se "Statstidende API" på statstidende.dk under "Om Statstidende").
 *
 * Flow: søg meddelelser på CVR-nummer (selskaber) eller navn (dødsboer)
 * og map meddelelsestypen: "Dødsboer" -> doedsbo,
 * "Konkursboer/dekret" -> konkurs, "Tvangsopløsning" -> tvangsoploesning.
 */
export class RealStatstidendeClient implements StatstidendeClient {
  async soegMeddelelser(_params: {
    navn?: string;
    cvrNummer?: string | null;
  }): Promise<StatstidendeMeddelelse[]> {
    // TODO:
    // 1. Kald Statstidendes søge-endpoint med CVR-nummer eller navn.
    // 2. Filtrér på relevante meddelelsestyper og map til
    //    StatstidendeMeddelelse (type, dato, overskrift, resume, link).
    // 3. Overvej et dagligt cron-job der cacher meddelelser lokalt,
    //    så screening ikke rammer API'et for hver ejendom.
    throw new IkkeImplementeret("Statstidende", "API'et er gratis, kræver kun oprettelse.");
  }
}

/**
 * Ejendomssøgning til områdescreening - bygget alene på gratis kilder:
 *  1. DAWA: alle adgangsadresser i et postnr:
 *     https://api.dataforsyningen.dk/adgangsadresser?postnr=2200&struktur=nestet
 *     (åbent, ingen nøgle; brug per_side + side til paginering)
 *  2. BBR (Datafordeler): filtrér på anvendelseskode 140/150 og
 *     antal enheder inden for kriterierne.
 *
 * VIGTIGT ved rigtig drift: et postnr har tusindvis af adresser, så
 * BBR-opslagene bør køres som batch-job med lokal caching (tabellen kan
 * genopfriskes fx ugentligt) i stedet for live pr. screening. Det holder
 * antallet af API-kald nede og gør screeningen hurtig og stabil.
 */
export class RealEjendomsSoegningClient implements EjendomsSoegningClient {
  async findAdresser(_postnr: string): Promise<AdresseMatch[]> {
    // TODO: Hent adgangsadresser fra DAWA (paginér), dedupliker pr.
    // opgang/ejendom (samme jordstykke) og returnér AdresseMatch-listen.
    // BBR-filtreringen sker i screening-laget via BbrClient.
    throw new IkkeImplementeret("Ejendomssøgning", "Bygger på åbne DAWA + BBR.");
  }
}
