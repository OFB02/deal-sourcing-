/**
 * Distress-scoring - kernen i værdiskabelsen.
 *
 * Modellen vægter signaler om, at der kan være et gab mellem ejendommens
 * nuværende tilstand/ejerforhold og dens potentielle værdi. Output er en
 * prioritering (0-100), IKKE en beslutning: formålet er at reducere fx
 * 500 ejendomme til de 10-20, der er værd at ringe på.
 *
 * Vægtene ligger samlet i DISTRESS_VAEGTE og kan justeres frit uden at
 * røre ingestion-laget - scoringen arbejder alene på AutoIndhentning.
 */
import type { AutoIndhentning } from "@/integrations/types";

/** Maksimumpoint pr. signal. Summen er skalaens teoretiske maksimum. */
export const DISTRESS_VAEGTE = {
  /** Selskab under konkurs/tvangsopløsning, manglende regnskab, negativ drift */
  selskabsstatus: 25,
  /** Dødsbo som ejer og/eller proklama i Statstidende */
  doedsbo: 20,
  /** Lang ejertid = lav bogført værdi, ofte salgsvilje */
  ejertid: 15,
  /** Gammel bygning uden registreret om-/tilbygning = vedligeholdsefterslæb */
  bygningsefterslaeb: 15,
  /** Ejendomsværdi pr. m² langt under områdets kvm-pris = muligt værdigab */
  vaerdigab: 15,
  /** Negativ udvikling i selskabets egenkapital */
  oekonomiskPres: 10,
} as const;

export const DISTRESS_MAKS = Object.values(DISTRESS_VAEGTE).reduce((a, b) => a + b, 0);

export interface DistressSignal {
  navn: string;
  point: number;
  maksPoint: number;
  begrundelse: string;
}

export interface DistressScore {
  /** 0-100 (normaliseret ift. DISTRESS_MAKS) */
  score: number;
  niveau: "hoej" | "mellem" | "lav";
  signaler: DistressSignal[];
}

export function beregnDistress(auto: AutoIndhentning | null): DistressScore {
  const signaler: DistressSignal[] = [];
  if (!auto) return { score: 0, niveau: "lav", signaler };

  const { bbr, ejer, vurdering, marked } = auto;
  const statstidende = auto.statstidende ?? [];
  const iAar = new Date().getFullYear();

  /* --- Selskabsstatus --- */
  {
    const maks = DISTRESS_VAEGTE.selskabsstatus;
    let point = 0;
    const grunde: string[] = [];
    if (ejer?.selskab) {
      const s = ejer.selskab;
      if (s.status === "Under konkurs") {
        point = maks;
        grunde.push("selskabet er under konkurs");
      } else if (s.status === "Under tvangsopløsning" || s.status === "Under likvidation") {
        point = maks;
        grunde.push(`selskabet er ${s.status.toLowerCase()}`);
      } else if (s.status === "Opløst") {
        point = Math.round(maks * 0.8);
        grunde.push("selskabet er opløst");
      }
      const senesteRegnskab = Math.max(...s.regnskaber.map((r) => r.aar), 0);
      if (senesteRegnskab > 0 && iAar - senesteRegnskab >= 2) {
        point = Math.max(point, Math.round(maks * 0.5));
        grunde.push(`seneste offentliggjorte regnskab er fra ${senesteRegnskab}`);
      }
    }
    if (point > 0)
      signaler.push({
        navn: "Selskabsstatus",
        point,
        maksPoint: maks,
        begrundelse: grunde.join("; "),
      });
  }

  /* --- Dødsbo / skifteretssignal --- */
  {
    const maks = DISTRESS_VAEGTE.doedsbo;
    const erDoedsbo = ejer?.ejertype === "doedsbo";
    const proklama = statstidende.find((m) => m.type === "doedsbo");
    if (erDoedsbo || proklama) {
      signaler.push({
        navn: "Dødsbo",
        point: maks,
        maksPoint: maks,
        begrundelse: proklama
          ? `proklama kundgjort i Statstidende ${proklama.dato}`
          : "ejendommen ejes af et dødsbo",
      });
    }
  }

  /* --- Statstidende: konkurs/tvangsopløsning forstærker selskabssignalet --- */
  {
    const dekret = statstidende.find(
      (m) => m.type === "konkurs" || m.type === "tvangsoploesning" || m.type === "likvidation"
    );
    if (dekret && !signaler.some((s) => s.navn === "Selskabsstatus" && s.point >= DISTRESS_VAEGTE.selskabsstatus)) {
      signaler.push({
        navn: "Statstidende",
        point: Math.round(DISTRESS_VAEGTE.selskabsstatus * 0.8),
        maksPoint: DISTRESS_VAEGTE.selskabsstatus,
        begrundelse: `${dekret.overskrift} (${dekret.dato})`,
      });
    }
  }

  /* --- Ejertid --- */
  if (ejer?.overtagelsesAar) {
    const maks = DISTRESS_VAEGTE.ejertid;
    const ejertid = iAar - ejer.overtagelsesAar;
    let point = 0;
    if (ejertid >= 25) point = maks;
    else if (ejertid >= 15) point = Math.round(maks * 0.65);
    else if (ejertid >= 8) point = Math.round(maks * 0.3);
    if (point > 0)
      signaler.push({
        navn: "Ejertid",
        point,
        maksPoint: maks,
        begrundelse: `ejet siden ${ejer.overtagelsesAar} (${ejertid} år) - ofte lav bogført værdi`,
      });
  }

  /* --- Bygningsefterslæb --- */
  if (bbr) {
    const maks = DISTRESS_VAEGTE.bygningsefterslaeb;
    const sidsteArbejde = bbr.omTilbygningsaar ?? bbr.byggeaar;
    const aarSiden = iAar - sidsteArbejde;
    let point = 0;
    if (aarSiden >= 60) point = maks;
    else if (aarSiden >= 35) point = Math.round(maks * 0.65);
    else if (aarSiden >= 20) point = Math.round(maks * 0.3);
    if (point > 0)
      signaler.push({
        navn: "Bygningsefterslæb",
        point,
        maksPoint: maks,
        begrundelse: bbr.omTilbygningsaar
          ? `seneste om-/tilbygning ${bbr.omTilbygningsaar} (${aarSiden} år siden)`
          : `opført ${bbr.byggeaar} uden registreret om-/tilbygning`,
      });
  }

  /* --- Værdigab: offentlig vurdering pr. m² vs. områdets kvm-pris --- */
  if (bbr && vurdering && marked) {
    const areal = bbr.samletBoligareal + bbr.samletErhvervsareal;
    if (areal > 0 && marked.kvmPrisSeneste > 0) {
      const maks = DISTRESS_VAEGTE.vaerdigab;
      const vurderingPrKvm = vurdering.ejendomsvaerdi / areal;
      const gabPct = Math.round((1 - vurderingPrKvm / marked.kvmPrisSeneste) * 100);
      let point = 0;
      if (gabPct >= 45) point = maks;
      else if (gabPct >= 30) point = Math.round(maks * 0.6);
      else if (gabPct >= 20) point = Math.round(maks * 0.3);
      if (point > 0)
        signaler.push({
          navn: "Værdigab",
          point,
          maksPoint: maks,
          begrundelse: `vurdering ${Math.round(vurderingPrKvm).toLocaleString("da-DK")} kr./m² mod områdets ${marked.kvmPrisSeneste.toLocaleString("da-DK")} kr./m² (${gabPct} % under)`,
        });
    }
  }

  /* --- Økonomisk pres: faldende egenkapital / negativt resultat --- */
  if (ejer?.selskab && ejer.selskab.regnskaber.length >= 2) {
    const maks = DISTRESS_VAEGTE.oekonomiskPres;
    const [nyeste, ...aeldre] = ejer.selskab.regnskaber;
    let point = 0;
    const grunde: string[] = [];
    if (nyeste.resultat != null && nyeste.resultat < 0) {
      point += Math.round(maks * 0.6);
      grunde.push(`negativt resultat i ${nyeste.aar}`);
    }
    const forrige = aeldre[0];
    if (
      nyeste.egenkapital != null &&
      forrige?.egenkapital != null &&
      nyeste.egenkapital < forrige.egenkapital * 0.85
    ) {
      point += Math.round(maks * 0.4);
      grunde.push("faldende egenkapital");
    }
    point = Math.min(point, maks);
    if (point > 0)
      signaler.push({
        navn: "Økonomisk pres",
        point,
        maksPoint: maks,
        begrundelse: grunde.join("; "),
      });
  }

  const sum = signaler.reduce((a, s) => a + s.point, 0);
  const score = Math.min(100, Math.round((sum / DISTRESS_MAKS) * 100));
  return {
    score,
    niveau: score >= 50 ? "hoej" : score >= 25 ? "mellem" : "lav",
    signaler: signaler.sort((a, b) => b.point - a.point),
  };
}
