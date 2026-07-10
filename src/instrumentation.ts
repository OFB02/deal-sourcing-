/**
 * Next.js instrumentation-hook (kører én gang ved serverstart).
 *
 * Gør serverens fetch() proxy-bevidst: Nodes indbyggede fetch ignorerer
 * HTTP(S)_PROXY-miljøvariabler, så i miljøer bag en udgående proxy
 * (fx CI/sandkasser) ville alle API-kald ellers fejle. EnvHttpProxyAgent
 * læser HTTP_PROXY/HTTPS_PROXY/NO_PROXY og opfører sig som en normal
 * agent, når variablerne ikke er sat - så dette er harmløst i drift
 * uden proxy.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && (process.env.HTTPS_PROXY || process.env.HTTP_PROXY)) {
    const { EnvHttpProxyAgent, setGlobalDispatcher } = await import("undici");
    setGlobalDispatcher(new EnvHttpProxyAgent());
  }
}
