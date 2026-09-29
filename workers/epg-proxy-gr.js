const EPG_URL = "https://ext.greektv.app/epg/epg.xml";
const SERVICE = "WebTV EPG Proxy GR";
const VERSION = "simple-v3";
const SOURCE = "ext.greektv.app";

function corsHeaders(contentType = "application/xml; charset=utf-8") {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": contentType,
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders("application/json; charset=utf-8"),
      "Cache-Control": "no-store",
    },
  });
}

function analyzeXmltv(xml = "") {
  const text = String(xml || "");
  const channels = (text.match(/<channel\b/g) || []).length;
  const programmes = (text.match(/<programme\b/g) || []).length;
  const bytes = new TextEncoder().encode(text).length;
  const valid = text.includes("<tv") && channels > 0 && programmes > 0;
  return { valid, channels, programmes, bytes };
}

async function loadXmltv() {
  const upstream = await fetch(EPG_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 WebTV-EPG-Proxy",
      "Accept": "application/xml,text/xml,*/*",
      "Cache-Control": "no-cache",
    },
    cf: {
      cacheEverything: true,
      cacheTtl: 600,
    },
  });

  if (!upstream.ok) {
    return {
      ok: false,
      status: upstream.status,
      xml: "",
      analysis: { valid: false, channels: 0, programmes: 0, bytes: 0 },
      error: `EPG upstream error: ${upstream.status}`,
    };
  }

  const xml = await upstream.text();
  const analysis = analyzeXmltv(xml);
  if (!analysis.valid) {
    return {
      ok: false,
      status: upstream.status,
      xml,
      analysis,
      error: "Invalid XMLTV received from upstream",
    };
  }

  return { ok: true, status: upstream.status, xml, analysis, error: "" };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders("text/plain; charset=utf-8"),
      });
    }

    if (request.method !== "GET") {
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders("text/plain; charset=utf-8"),
      });
    }

    if (url.pathname !== "/epg" && url.pathname !== "/epg.xml" && url.pathname !== "/status") {
      return new Response("OK. Use /epg, /epg.xml or /status", {
        status: 200,
        headers: corsHeaders("text/plain; charset=utf-8"),
      });
    }

    try {
      const loaded = await loadXmltv();
      const { valid, channels, programmes, bytes } = loaded.analysis;

      if (url.pathname === "/status") {
        if (!loaded.ok) {
          return json({
            ok: false,
            valid: false,
            service: SERVICE,
            version: VERSION,
            source: SOURCE,
            channels,
            programmes,
            bytes,
            error: loaded.error,
          }, 502);
        }
        return json({
          ok: true,
          valid: true,
          service: SERVICE,
          version: VERSION,
          source: SOURCE,
          channels,
          programmes,
          bytes,
        });
      }

      if (!loaded.ok) {
        return new Response(loaded.error, {
          status: 502,
          headers: corsHeaders("text/plain; charset=utf-8"),
        });
      }

      return new Response(loaded.xml, {
        status: 200,
        headers: {
          ...corsHeaders(),
          "Cache-Control": "public, max-age=300",
          "X-EPG-Source": SOURCE,
          "X-EPG-Proxy-Version": VERSION,
        },
      });
    } catch (error) {
      const message = error?.message || "unknown error";
      if (url.pathname === "/status") {
        return json({
          ok: false,
          valid: false,
          service: SERVICE,
          version: VERSION,
          source: SOURCE,
          channels: 0,
          programmes: 0,
          bytes: 0,
          error: `EPG proxy error: ${message}`,
        }, 502);
      }
      return new Response(`EPG proxy error: ${message}`, {
        status: 502,
        headers: corsHeaders("text/plain; charset=utf-8"),
      });
    }
  },
};

export { analyzeXmltv };
