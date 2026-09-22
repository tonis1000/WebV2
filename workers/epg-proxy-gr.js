const EPG_URL = "https://ext.greektv.app/epg/epg.xml";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders("text/plain; charset=utf-8"),
      });
    }

    if (url.pathname !== "/epg" && url.pathname !== "/epg.xml") {
      return new Response("OK. Use /epg or /epg.xml", {
        status: 200,
        headers: corsHeaders("text/plain; charset=utf-8"),
      });
    }

    try {
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
        return new Response(
          `EPG upstream error: ${upstream.status}`,
          {
            status: 502,
            headers: corsHeaders("text/plain; charset=utf-8"),
          }
        );
      }

      const xml = await upstream.text();

      // Μικρός έλεγχος ότι πήραμε όντως XMLTV.
      if (
        !xml.includes("<tv") ||
        !xml.includes("<channel") ||
        !xml.includes("<programme")
      ) {
        return new Response(
          "Invalid XMLTV received from upstream",
          {
            status: 502,
            headers: corsHeaders("text/plain; charset=utf-8"),
          }
        );
      }

      return new Response(xml, {
        status: 200,
        headers: {
          ...corsHeaders(),
          "Cache-Control": "public, max-age=300",
          "X-EPG-Source": "ext.greektv.app",
          "X-EPG-Proxy-Version": "simple-v3",
        },
      });

    } catch (error) {
      return new Response(
        `EPG proxy error: ${error?.message || "unknown error"}`,
        {
          status: 502,
          headers: corsHeaders("text/plain; charset=utf-8"),
        }
      );
    }
  },
};

function corsHeaders(
  contentType = "application/xml; charset=utf-8"
) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": contentType,
  };
}