/**
 * Adressesøgning (autocomplete) - bruges af søgefeltet ved oprettelse
 * af en ny deal. Går gennem DAWA-klienten (mock eller rigtig).
 */
import { NextRequest, NextResponse } from "next/server";
import { getDawaClient } from "@/integrations";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json([]);
  try {
    const resultater = await getDawaClient().soegAdresse(q);
    return NextResponse.json(resultater);
  } catch (e) {
    return NextResponse.json(
      { fejl: e instanceof Error ? e.message : "Ukendt fejl" },
      { status: 502 }
    );
  }
}
