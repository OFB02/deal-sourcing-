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
 *
 * Live-verificeret:
 *  - autocomplete matcher IKKE på kommaer, så de strippes fra søgningen
 *  - matrikelnr/ejerlav ligger på det nestede adgangsadresse-svar
 *  - BFE-nummer hentes fra /jordstykker/{ejerlavkode}/{matrikelnr}
 */
export class RealDawaClient implements DawaClient {
  private base = "https://api.dataforsyningen.dk";

  async soegAdresse(query: string): Promise<AdresseMatch[]> {
    // Autocomplete matcher hverken kommaer eller postnr i selve q -
    // postnr udskilles til sin egen parameter
    let q = query.replace(/,/g, " ").replace(/\s+/g, " ").trim();
    const postnrMatch = q.match(/\b(\d{4})\b\s*$/);
    const params = new URLSearchParams({ per_side: "8" });
    if (postnrMatch) {
      params.set("postnr", postnrMatch[1]);
      q = q.slice(0, postnrMatch.index).trim();
    }
    params.set("q", q);
    const res = await fetch(`${this.base}/adgangsadresser/autocomplete?${params}`);
    if (!res.ok) throw new Error(`DAWA-fejl: HTTP ${res.status}`);
    const data: any[] = await res.json();
    const resultater = await Promise.all(
      data.map((d) => this.hentAdresse(d.adgangsadresse.id))
    );
    return resultater.filter((r): r is AdresseMatch => r !== null);
  }

  async hentAdresse(id: string): Promise<AdresseMatch | null> {
    const res = await fetch(`${this.base}/adgangsadresser/${id}?struktur=nestet`);
    if (!res.ok) return null;
    const a = await res.json();

    // BFE-nummeret ligger på jordstykket, ikke på adressen
    let bfeNummer = "";
    const ejerlavkode = a.ejerlav?.kode ?? a.jordstykke?.ejerlav?.kode;
    const matrikelnr = a.matrikelnr ?? a.jordstykke?.matrikelnr;
    if (ejerlavkode && matrikelnr) {
      try {
        const js = await fetch(`${this.base}/jordstykker/${ejerlavkode}/${encodeURIComponent(matrikelnr)}`);
        if (js.ok) bfeNummer = String((await js.json()).bfenummer ?? "");
      } catch {
        // BFE er rart at have, men må ikke vælte adresseopslaget
      }
    }

    return {
      id: a.id,
      betegnelse: `${a.vejstykke.navn} ${a.husnr}, ${a.postnummer.nr} ${a.postnummer.navn}`,
      vejnavn: a.vejstykke.navn,
      husnr: a.husnr,
      postnr: a.postnummer.nr,
      postnrnavn: a.postnummer.navn,
      kommunekode: a.kommune.kode,
      matrikelnr: matrikelnr ?? "",
      ejerlav: a.ejerlav?.navn ?? a.jordstykke?.ejerlav?.navn ?? "",
      ejerlavKode: ejerlavkode ? String(ejerlavkode) : undefined,
      bfeNummer,
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
  jordstykke?: string;
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
    const paaHusnummer = await datafordelerHent<BbrBygningRaa[]>(
      "BBR/BBRPublic/1/REST/bygning",
      { husnummer: adresse.id, pagesize: 50 }
    );

    let bygninger = paaHusnummer.filter(
      (b) => !b.status || AKTIVE_STATUSSER.has(String(b.status))
    );

    // Ét husnummer er kun én opgang - hele ejendommen ligger på
    // jordstykket, så genopslå pr. jordstykke for at fange alle
    // bygninger. Bygningen kan endda være registreret på en NABO-opgangs
    // husnummer, så finder husnummer-opslaget intet, udledes jordstykket
    // i stedet via DAWA (featureid = BBR's jordstykke-id, live-verificeret).
    let jordstykke = bygninger.find((b) => b.jordstykke)?.jordstykke;
    if (!jordstykke && adresse.ejerlavKode && adresse.matrikelnr) {
      try {
        const js = await fetch(
          `https://api.dataforsyningen.dk/jordstykker/${adresse.ejerlavKode}/${encodeURIComponent(adresse.matrikelnr)}`
        );
        if (js.ok) jordstykke = String((await js.json()).featureid ?? "") || undefined;
      } catch {
        // fallback må ikke vælte opslaget
      }
    }
    if (jordstykke) {
      const paaJordstykke = await datafordelerHent<BbrBygningRaa[]>(
        "BBR/BBRPublic/1/REST/bygning",
        { jordstykke, pagesize: 100 }
      );
      const aktive = paaJordstykke.filter(
        (b) => !b.status || AKTIVE_STATUSSER.has(String(b.status))
      );
      if (aktive.length > 0) bygninger = aktive;
    }

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
 * Ejendomssøgning til områdescreening - bygget alene på gratis kilder.
 *
 * Strategi (live-verificeret):
 *  1. Hent ALLE enhedsadresser i postnummeret fra DAWA i ét kald
 *     (struktur=mini) og tæl enheder pr. adgangsadresse/opgang.
 *     Det finder udlejningsejendommene uden ét eneste BBR-kald.
 *  2. Tag opgangene med flest enheder (kandidater), slå dem fuldt op
 *     og dedupliker pr. ejerlav+matrikel, så samme ejendom med flere
 *     opgange kun screenes én gang.
 *  3. BBR-filtreringen (arealer, anvendelse, præcist enhedstal) sker
 *     bagefter i screening-laget via BbrClient.
 *
 * KANDIDAT_LOFT begrænser hvor mange ejendomme der BBR-screenes live
 * pr. kørsel. Ved rigtig drift bør hele flowet køres som batch-job
 * med lokal cache (fx ugentligt), så loftet kan fjernes.
 */
const KANDIDAT_LOFT = 30;

export class RealEjendomsSoegningClient implements EjendomsSoegningClient {
  private base = "https://api.dataforsyningen.dk";

  async findAdresser(postnr: string): Promise<AdresseMatch[]> {
    // 1. Enhedsadresser -> antal pr. opgang
    const antalPrOpgang = new Map<string, number>();
    for (let side = 1; side <= 10; side++) {
      const res = await fetch(
        `${this.base}/adresser?postnr=${postnr}&struktur=mini&per_side=10000&side=${side}`
      );
      if (!res.ok) throw new Error(`DAWA-fejl ved adresseliste: HTTP ${res.status}`);
      const rows: { adgangsadresseid: string }[] = await res.json();
      for (const r of rows) {
        antalPrOpgang.set(r.adgangsadresseid, (antalPrOpgang.get(r.adgangsadresseid) ?? 0) + 1);
      }
      if (rows.length < 10000) break;
    }

    // 2. Kandidater: flest enheder først (mindst 3 enheder pr. opgang -
    //    den præcise lejemåls-filtrering sker mod BBR i screening-laget)
    const kandidater = [...antalPrOpgang.entries()]
      .filter(([, antal]) => antal >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, KANDIDAT_LOFT * 2); // hent ekstra: dedup pr. matrikel skærer ned

    const dawa = new RealDawaClient();
    const set = new Map<string, AdresseMatch>();
    const BATCH = 8;
    for (let i = 0; i < kandidater.length && set.size < KANDIDAT_LOFT; i += BATCH) {
      const batch = kandidater.slice(i, i + BATCH);
      const opslag = await Promise.all(batch.map(([id]) => dawa.hentAdresse(id)));
      for (const a of opslag) {
        if (!a) continue;
        const noegle = `${a.ejerlav}|${a.matrikelnr}`;
        if (!set.has(noegle) && set.size < KANDIDAT_LOFT) set.set(noegle, a);
      }
    }
    return [...set.values()];
  }
}
