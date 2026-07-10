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
 * Docs: https://confluence.sdfi.dk/pages/viewpage.action?pageId=16056582
 *
 * Relevante kald:
 *  - /BBRPublic/1/rest/bygning?husnummer={dawaId}  -> bygninger (byggeår, anvendelse, arealer, tag)
 *  - /BBRPublic/1/rest/enhed?bygning={bygningId}   -> enheder/lejemål
 */
export class RealBbrClient implements BbrClient {
  async hentBygningsdata(_adresse: AdresseMatch): Promise<BbrData> {
    // TODO:
    // 1. Kald bygning-endpointet med brugernavn/adgangskode fra
    //    DATAFORDELER_USERNAME / DATAFORDELER_PASSWORD.
    // 2. Summer arealer og enheder på tværs af bygninger på grunden.
    // 3. Map anvendelseskoder (140 = etagebolig, 150 = blandet, ...) til tekst.
    throw new IkkeImplementeret("BBR", "Opret tjenestebruger på datafordeler.dk.");
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
