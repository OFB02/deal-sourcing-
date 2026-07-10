/**
 * Nøgletalsberegning for en deal: NOI, brutto-/nettoafkast, kvm-pris
 * vs. markedet samt automatiske opmærksomhedspunkter (flags).
 */
import type { Deal, DriftsAar } from "./model";

export interface Noegletal {
  /** Pris der regnes på: forventet købspris, ellers udbudspris */
  beregningspris: number | null;
  samletAreal: number | null;
  kvmPris: number | null;
  markedsKvmPris: number | null;
  kvmPrisAfvigelsePct: number | null; // negativ = billigere end markedet
  /** Fra seneste driftsår */
  bruttoleje: number | null;
  driftsudgifter: number | null;
  noi: number | null;
  bruttoafkastPct: number | null;
  nettoafkastPct: number | null;
  /** Årlig leje pr. kvm - relevant ift. omkostningsbestemt leje */
  lejePrKvm: number | null;
  tomgangsprocent: number | null;
  vurderingIftPris: number | null; // offentlig vurdering / pris
  flags: Flag[];
}

export interface Flag {
  type: "positiv" | "advarsel" | "info";
  tekst: string;
}

export function beregnDriftsudgifter(aar: DriftsAar): number {
  return (
    (aar.ejendomsskat ?? 0) +
    (aar.forsikring ?? 0) +
    (aar.vedligehold ?? 0) +
    (aar.administration ?? 0) +
    (aar.renovation ?? 0) +
    (aar.oevrigeUdgifter ?? 0)
  );
}

export function beregnNoi(aar: DriftsAar): number | null {
  if (aar.bruttolejeindtaegt == null) return null;
  return aar.bruttolejeindtaegt - beregnDriftsudgifter(aar);
}

export function beregnNoegletal(deal: Deal): Noegletal {
  const flags: Flag[] = [];
  const bbr = deal.auto?.bbr ?? null;
  const marked = deal.auto?.marked ?? null;
  const vurdering = deal.auto?.vurdering ?? null;

  const beregningspris = deal.pris.forventetKoebspris ?? deal.pris.udbudspris ?? null;
  const samletAreal = bbr ? bbr.samletBoligareal + bbr.samletErhvervsareal : null;

  const kvmPris = beregningspris && samletAreal ? Math.round(beregningspris / samletAreal) : null;
  const markedsKvmPris = marked?.kvmPrisSeneste ?? null;
  const kvmPrisAfvigelsePct =
    kvmPris && markedsKvmPris ? Math.round(((kvmPris - markedsKvmPris) / markedsKvmPris) * 1000) / 10 : null;

  // Seneste driftsår med data
  const senesteAar = [...deal.oekonomi.driftsaar]
    .filter((a) => a.bruttolejeindtaegt != null)
    .sort((a, b) => b.aar - a.aar)[0];

  const bruttoleje = senesteAar?.bruttolejeindtaegt ?? null;
  const driftsudgifter = senesteAar ? beregnDriftsudgifter(senesteAar) : null;
  const noi = senesteAar ? beregnNoi(senesteAar) : null;

  const bruttoafkastPct =
    bruttoleje && beregningspris ? Math.round((bruttoleje / beregningspris) * 1000) / 10 : null;
  const nettoafkastPct =
    noi != null && beregningspris ? Math.round((noi / beregningspris) * 1000) / 10 : null;

  const lejePrKvm = bruttoleje && samletAreal ? Math.round(bruttoleje / samletAreal) : null;

  const antalLejemaal = deal.lejeforhold.lejemaal.length;
  const tomme = deal.lejeforhold.lejemaal.filter((l) => l.tomgang).length;
  const tomgangsprocent = antalLejemaal > 0 ? Math.round((tomme / antalLejemaal) * 100) : null;

  const vurderingIftPris =
    vurdering && beregningspris
      ? Math.round((vurdering.ejendomsvaerdi / beregningspris) * 100) / 100
      : null;

  /* ---------- Flags ---------- */

  if (kvmPrisAfvigelsePct != null) {
    if (kvmPrisAfvigelsePct <= -15)
      flags.push({ type: "positiv", tekst: `Kvm-pris ${Math.abs(kvmPrisAfvigelsePct)}% under områdets niveau` });
    else if (kvmPrisAfvigelsePct >= 15)
      flags.push({ type: "advarsel", tekst: `Kvm-pris ${kvmPrisAfvigelsePct}% over områdets niveau` });
  }

  if (nettoafkastPct != null && marked?.typiskAfkastkravPct != null) {
    if (nettoafkastPct >= marked.typiskAfkastkravPct + 0.5)
      flags.push({ type: "positiv", tekst: `Nettoafkast ${nettoafkastPct}% ligger over områdets typiske afkastkrav (${marked.typiskAfkastkravPct}%)` });
    else if (nettoafkastPct < marked.typiskAfkastkravPct - 0.5)
      flags.push({ type: "advarsel", tekst: `Nettoafkast ${nettoafkastPct}% ligger under områdets typiske afkastkrav (${marked.typiskAfkastkravPct}%)` });
  }

  if (deal.lejeforhold.lejeregulering === "omkostningsbestemt")
    flags.push({ type: "info", tekst: "Omkostningsbestemt leje - undersøg potentiale ved §5, stk. 2-moderniseringer og gældende regler" });
  if (deal.lejeforhold.lejeregulering === "fri_leje")
    flags.push({ type: "positiv", tekst: "Fri leje - lejen kan følge markedet" });

  if (tomgangsprocent != null && tomgangsprocent >= 20)
    flags.push({ type: "advarsel", tekst: `Høj tomgang: ${tomme} af ${antalLejemaal} lejemål står tomme` });

  if (deal.lejeforhold.lejemaal.some((l) => l.huslejenaevnssag) || deal.lejeforhold.verserendeHuslejenaevnssager.trim())
    flags.push({ type: "advarsel", tekst: "Verserende huslejenævnssag(er)" });

  if (deal.juridisk.verserendeSager.trim())
    flags.push({ type: "advarsel", tekst: "Verserende juridiske sager - se juridisk sektion" });

  if (bbr && bbr.byggeaar < 1950 && !bbr.omTilbygningsaar)
    flags.push({ type: "advarsel", tekst: `Byggeår ${bbr.byggeaar} uden registreret renovering - afsæt grundigt renoveringsbudget` });

  const kritiskStand = (["tag", "facade", "vvs", "el", "vinduer"] as const).filter(
    (k) => deal.stand[k] != null && (deal.stand[k] as number) <= 2
  );
  if (kritiskStand.length > 0)
    flags.push({ type: "advarsel", tekst: `Kritisk stand på: ${kritiskStand.join(", ")}` });

  if (deal.auto?.ejer?.ejertype === "doedsbo")
    flags.push({ type: "positiv", tekst: "Ejer er et dødsbo - ofte motiveret sælger" });

  if (deal.pris.saelgersMotivation.toLowerCase().includes("hurtig"))
    flags.push({ type: "positiv", tekst: "Sælger ønsker hurtigt salg - forhandlingsstyrke" });

  if (deal.auto?.plandata?.lokalplaner.some((l) => l.status === "forslag"))
    flags.push({ type: "info", tekst: "Lokalplanforslag i området - kan påvirke fremtidig værdi" });

  if (vurderingIftPris != null && vurderingIftPris > 1.05)
    flags.push({ type: "positiv", tekst: "Offentlig vurdering ligger over prisen - sanity check ser fornuftig ud" });

  return {
    beregningspris,
    samletAreal,
    kvmPris,
    markedsKvmPris,
    kvmPrisAfvigelsePct,
    bruttoleje,
    driftsudgifter,
    noi,
    bruttoafkastPct,
    nettoafkastPct,
    lejePrKvm,
    tomgangsprocent,
    vurderingIftPris,
    flags,
  };
}

/* ---------- Formatering ---------- */

export function kr(n: number | null | undefined): string {
  if (n == null) return "–";
  return n.toLocaleString("da-DK", { maximumFractionDigits: 0 }) + " kr.";
}

export function pct(n: number | null | undefined): string {
  if (n == null) return "–";
  return n.toLocaleString("da-DK") + " %";
}

export function tal(n: number | null | undefined, suffix = ""): string {
  if (n == null) return "–";
  return n.toLocaleString("da-DK") + suffix;
}
