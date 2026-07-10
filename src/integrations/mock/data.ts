/**
 * Deterministisk pseudo-tilfældig testdata.
 *
 * Samme adresse giver altid samme data, så appen føles realistisk at
 * arbejde med, selvom alt er mock. Slettes når de rigtige API'er er
 * koblet på.
 */

/** Simpel streng-hash til at seede "tilfældige" værdier */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Deterministisk værdi i intervallet [min, max] ud fra seed + salt */
export function seeded(seed: string, salt: string, min: number, max: number): number {
  const h = hash(seed + "|" + salt);
  return min + (h % (max - min + 1));
}

export function pick<T>(seed: string, salt: string, arr: T[]): T {
  return arr[hash(seed + "|" + salt) % arr.length];
}

export const MOCK_ADRESSER = [
  { vejnavn: "Vesterbrogade", husnr: "142", postnr: "1620", postnrnavn: "København V", kommunekode: "0101" },
  { vejnavn: "Nørrebrogade", husnr: "66", postnr: "2200", postnrnavn: "København N", kommunekode: "0101" },
  { vejnavn: "Amagerbrogade", husnr: "23", postnr: "2300", postnrnavn: "København S", kommunekode: "0101" },
  { vejnavn: "Istedgade", husnr: "88", postnr: "1650", postnrnavn: "København V", kommunekode: "0101" },
  { vejnavn: "Jagtvej", husnr: "111", postnr: "2200", postnrnavn: "København N", kommunekode: "0101" },
  { vejnavn: "Søndergade", husnr: "12", postnr: "8000", postnrnavn: "Aarhus C", kommunekode: "0751" },
  { vejnavn: "Jægergårdsgade", husnr: "45", postnr: "8000", postnrnavn: "Aarhus C", kommunekode: "0751" },
  { vejnavn: "Vestergade", husnr: "31", postnr: "5000", postnrnavn: "Odense C", kommunekode: "0461" },
  { vejnavn: "Danmarksgade", husnr: "19", postnr: "9000", postnrnavn: "Aalborg", kommunekode: "0851" },
  { vejnavn: "Algade", husnr: "54", postnr: "4000", postnrnavn: "Roskilde", kommunekode: "0265" },
  { vejnavn: "Nygade", husnr: "7", postnr: "6000", postnrnavn: "Kolding", kommunekode: "0621" },
  { vejnavn: "Storegade", husnr: "28", postnr: "6700", postnrnavn: "Esbjerg", kommunekode: "0561" },
];

export const EJERLAV = [
  "Udenbys Vester Kvarter, København",
  "Udenbys Klædebo Kvarter, København",
  "Sundbyøster, København",
  "Aarhus Bygrunde",
  "Odense Bygrunde",
  "Aalborg Bygrunde",
  "Roskilde Bygrunde",
];

/** Basis-kvm-priser pr. postnr-gruppe (mock af Finans Danmark-statistik) */
export function basisKvmPris(postnr: string): number {
  const p = parseInt(postnr, 10);
  if (p < 2000) return 38000; // København C/V/N-niveau
  if (p < 2500) return 32000; // Københavns brokvarterer/Amager
  if (p < 3000) return 27000; // omegn
  if (p >= 8000 && p < 8300) return 30000; // Aarhus C
  if (p >= 5000 && p < 5300) return 20000; // Odense
  if (p >= 9000 && p < 9300) return 18000; // Aalborg
  if (p >= 4000 && p < 4100) return 22000; // Roskilde
  return 14000;
}
