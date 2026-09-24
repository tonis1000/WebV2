export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Range",
      "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // -------------------------
    // Helpers
    // -------------------------
    const cleanUrl = (raw) => {
      if (!raw) return "";
      return String(raw).split("#")[0].trim();
    };

    const jsonResponse = (obj, status = 200) =>
      new Response(JSON.stringify(obj), {
        status,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          ...corsHeaders
        }
      });

    const textResponse = (text, contentType = "text/plain; charset=utf-8", status = 200) =>
      new Response(text, {
        status,
        headers: {
          "Content-Type": contentType,
          ...corsHeaders
        }
      });

    const isLikelyM3U8ByUrl = (u) => /\.m3u8(\?.*)?$/i.test(u || "");
    const isSegmentLike = (u) =>
      /\.(ts|m4s|mp4|aac|mp3|key)(\?.*)?$/i.test(u || "");

    // Header-aware proxy transport. Only these non-sensitive request headers
    // may be supplied by IPTV/Kodi URL options.
    const ALLOWED_UPSTREAM_HEADERS = Object.freeze({
      "user-agent": "User-Agent",
      "referer": "Referer",
      "origin": "Origin"
    });
    const HEADER_CONTEXT_MAX_LENGTH = 8192;
    const HEADER_VALUE_MAX_LENGTH = 2048;
    const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

    const decodeBase64UrlUtf8 = (raw) => {
      const normalized = String(raw || "").replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    };

    const parseHeaderContext = (raw) => {
      if (!raw) return { headers: {}, error: "" };
      if (String(raw).length > HEADER_CONTEXT_MAX_LENGTH) {
        return { headers: {}, error: "Header context too large" };
      }

      let payload;
      try {
        payload = JSON.parse(decodeBase64UrlUtf8(raw));
      } catch {
        return { headers: {}, error: "Invalid header context" };
      }

      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return { headers: {}, error: "Invalid header context" };
      }

      const headers = {};
      for (const [rawName, rawValue] of Object.entries(payload)) {
        const canonical = ALLOWED_UPSTREAM_HEADERS[String(rawName || "").trim().toLowerCase()];
        if (!canonical) continue;
        if (typeof rawValue !== "string") {
          return { headers: {}, error: `Invalid ${canonical} value` };
        }

        const value = rawValue.trim();
        if (!value || value.length > HEADER_VALUE_MAX_LENGTH || CONTROL_CHARS.test(value)) {
          return { headers: {}, error: `Invalid ${canonical} value` };
        }
        headers[canonical] = value;
      }

      return { headers, error: "" };
    };

    const toProxyUrl = (absoluteUrl, headerContext = "") => {
      const target = encodeURIComponent(cleanUrl(absoluteUrl));
      if (!headerContext) return `${url.origin}/?url=${target}`;
      return `${url.origin}/?h=${encodeURIComponent(headerContext)}&url=${target}`;
    };

    const absoluteFrom = (baseUrl, relativeOrAbsolute) => {
      return new URL(relativeOrAbsolute, baseUrl).href;
    };

    const addCorsAndCacheHeaders = (resp, maxAge = 60, extraHeaders = {}) => {
      const out = new Response(resp.body, resp);
      out.headers.set("Access-Control-Allow-Origin", "*");
      out.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      out.headers.set("Access-Control-Allow-Headers", "Content-Type, Range");
      out.headers.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
      out.headers.set("Cache-Control", `public, max-age=${maxAge}`);
      for (const [k, v] of Object.entries(extraHeaders)) {
        out.headers.set(k, v);
      }
      return out;
    };

    const toNumber = (v, fallback = 0) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };

    const nowMs = () => Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const normalizeMeta = (meta = {}) => ({
      timestamp: meta.timestamp || new Date().toISOString(),
      proxy: meta.proxy || "",
      player: meta.player || "",
      type: meta.type || "",
      tvgId: meta.tvgId || "",

      finalUrl: cleanUrl(meta.finalUrl || ""),
      mode: meta.mode || "",

      success: toNumber(meta.success, 0),
      fail: toNumber(meta.fail, 0),
      lastSuccess: toNumber(meta.lastSuccess, 0) || null
    });

    const isQuarantined = (meta = {}) => {
      const success = toNumber(meta.success, 0);
      const fail = toNumber(meta.fail, 0);
      const lastSuccess = toNumber(meta.lastSuccess, 0);

      if (success === 0 && fail >= 5) return true;
      if (fail >= 6 && fail > success * 3) return true;

      if (lastSuccess > 0) {
        const age = nowMs() - lastSuccess;
        if (age > 30 * dayMs && fail >= 4 && success <= 1) return true;
      }

      return false;
    };

    const shouldPrune = (meta = {}) => {
      const success = toNumber(meta.success, 0);
      const fail = toNumber(meta.fail, 0);
      const lastSuccess = toNumber(meta.lastSuccess, 0);

      if (success === 0 && fail >= 10) return true;

      if (lastSuccess > 0) {
        const age = nowMs() - lastSuccess;
        if (age > 45 * dayMs && fail >= 8 && success <= 1) return true;
      }

      return false;
    };

    const reliabilityScore = (meta = {}) => {
      const success = toNumber(meta.success, 0);
      const fail = toNumber(meta.fail, 0);
      const lastSuccess = toNumber(meta.lastSuccess, 0);

      let score = 0;
      score += success * 3;
      score -= fail * 5;

      if (lastSuccess > 0) {
        const ageMs = nowMs() - lastSuccess;
        if (ageMs < 1 * dayMs) score += 20;
        else if (ageMs < 3 * dayMs) score += 12;
        else if (ageMs < 7 * dayMs) score += 6;
        else if (ageMs < 14 * dayMs) score += 2;
      }

      if (fail >= 5 && success === 0) score -= 50;
      if (fail > success * 2 && fail >= 3) score -= 25;
      if (isQuarantined(meta)) score -= 1000;

      return score;
    };

    const dedupeUrls = (urls = []) => {
      return [...new Set((urls || []).map(cleanUrl).filter(Boolean))];
    };

    const buildRankedChannelStreams = (streamsMap = {}, proxyMap = {}, options = {}) => {
      const ranked = {};
      const maxPerChannel = options.maxPerChannel || 10;

      for (const [tvgId, urls] of Object.entries(streamsMap)) {
        if (!Array.isArray(urls)) {
          ranked[tvgId] = [];
          continue;
        }

        let cleanedUnique = dedupeUrls(urls);
        cleanedUnique = cleanedUnique.filter((u) => !shouldPrune(proxyMap[u] || {}));

        cleanedUnique.sort((a, b) => {
          const metaA = proxyMap[a] || {};
          const metaB = proxyMap[b] || {};

          const scoreA = reliabilityScore(metaA);
          const scoreB = reliabilityScore(metaB);

          if (scoreB !== scoreA) return scoreB - scoreA;

          const lastA = toNumber(metaA.lastSuccess, 0);
          const lastB = toNumber(metaB.lastSuccess, 0);

          return lastB - lastA;
        });

        ranked[tvgId] = cleanedUnique.slice(0, maxPerChannel);
      }

      return ranked;
    };

    const cleanupOrphanProxyMap = (streamsMap = {}, proxyMap = {}) => {
      const activeUrls = new Set();

      for (const urls of Object.values(streamsMap)) {
        if (!Array.isArray(urls)) continue;
        for (const u of urls) {
          activeUrls.add(cleanUrl(u));
        }
      }

      const cleanedProxyMap = {};
      for (const [streamUrl, meta] of Object.entries(proxyMap)) {
        if (activeUrls.has(cleanUrl(streamUrl))) {
          cleanedProxyMap[streamUrl] = meta;
        }
      }

      return cleanedProxyMap;
    };

    const classifyM3U8 = (text) => {
      const t = text || "";
      const isMaster =
        t.includes("#EXT-X-STREAM-INF") ||
        t.includes("#EXT-X-MEDIA");

      const isMedia =
        t.includes("#EXTINF:") ||
        t.includes("#EXT-X-TARGETDURATION") ||
        t.includes("#EXT-X-MEDIA-SEQUENCE");

      const isEnded = t.includes("#EXT-X-ENDLIST");

      return {
        isMaster,
        isMedia,
        isEnded,
        isLive: isMedia && !isEnded
      };
    };

    // -------------------------
    // GET /channel-streams.json
    // -------------------------
    if (url.pathname === "/channel-streams.json" && request.method === "GET") {
      const rawStreams = await env.TV_CACHE.get("channel-streams", "text");
      const rawProxyMap = await env.TV_CACHE.get("proxy-map", "text");

      const streamsMap = rawStreams ? JSON.parse(rawStreams) : {};
      const proxyMap = rawProxyMap ? JSON.parse(rawProxyMap) : {};

      const ranked = buildRankedChannelStreams(streamsMap, proxyMap, { maxPerChannel: 10 });

      return textResponse(JSON.stringify(ranked), "application/json; charset=utf-8");
    }

    // -------------------------
    // GET /proxy-map.json
    // -------------------------
    if (url.pathname === "/proxy-map.json" && request.method === "GET") {
      const data = await env.TV_CACHE.get("proxy-map", "text");
      return textResponse(data || "{}", "application/json; charset=utf-8");
    }

    // -------------------------
    // POST /upload-cache
    // -------------------------
    if (url.pathname === "/upload-cache" && request.method === "POST") {
      try {
        const incoming = await request.json();

        const oldStreamsRaw = await env.TV_CACHE.get("channel-streams", "text");
        const oldProxyMapRaw = await env.TV_CACHE.get("proxy-map", "text");

        const oldStreams = oldStreamsRaw ? JSON.parse(oldStreamsRaw) : {};
        const oldProxyMap = oldProxyMapRaw ? JSON.parse(oldProxyMapRaw) : {};

        let addedCount = 0;

        for (const [streamUrlRaw, metaRaw] of Object.entries(incoming)) {
          const streamUrl = cleanUrl(streamUrlRaw);
          if (!streamUrl || !metaRaw || !metaRaw.tvgId) continue;

          const meta = normalizeMeta(metaRaw);
          const tvgId = String(meta.tvgId).trim();
          if (!tvgId) continue;

          if (!oldStreams[tvgId]) oldStreams[tvgId] = [];

          if (!oldStreams[tvgId].includes(streamUrl)) {
            oldStreams[tvgId].push(streamUrl);
            addedCount++;
          }

          const existing = normalizeMeta(oldProxyMap[streamUrl] || { tvgId });

          oldProxyMap[streamUrl] = {
            timestamp: meta.timestamp || existing.timestamp || new Date().toISOString(),
            proxy: meta.proxy || existing.proxy || "",
            player: meta.player || existing.player || "",
            type: meta.type || existing.type || "",
            tvgId,

            finalUrl: cleanUrl(meta.finalUrl || existing.finalUrl || ""),
            mode: meta.mode || existing.mode || "",

            success: Math.max(
              toNumber(existing.success, 0),
              toNumber(meta.success, 0)
            ),
            fail: Math.max(
              toNumber(existing.fail, 0),
              toNumber(meta.fail, 0)
            ),

            lastSuccess:
              toNumber(meta.lastSuccess, 0) ||
              toNumber(existing.lastSuccess, 0) ||
              null
          };

          if (meta.finalUrl && meta.finalUrl !== streamUrl) {
            const finalKey = cleanUrl(meta.finalUrl);
            const existingFinal = normalizeMeta(oldProxyMap[finalKey] || { tvgId });

            oldProxyMap[finalKey] = {
              timestamp: meta.timestamp || existingFinal.timestamp || new Date().toISOString(),
              proxy: meta.proxy || existingFinal.proxy || "",
              player: meta.player || existingFinal.player || "",
              type: meta.type || existingFinal.type || "",
              tvgId,

              finalUrl: cleanUrl(meta.finalUrl || existingFinal.finalUrl || ""),
              mode: meta.mode || existingFinal.mode || "",

              success: Math.max(
                toNumber(existingFinal.success, 0),
                toNumber(meta.success, 0)
              ),
              fail: Math.max(
                toNumber(existingFinal.fail, 0),
                toNumber(meta.fail, 0)
              ),

              lastSuccess:
                toNumber(meta.lastSuccess, 0) ||
                toNumber(existingFinal.lastSuccess, 0) ||
                null
            };
          }
        }

        for (const [tvgId, urls] of Object.entries(oldStreams)) {
          oldStreams[tvgId] = dedupeUrls(urls);
        }

        const rankedStreams = buildRankedChannelStreams(oldStreams, oldProxyMap, { maxPerChannel: 10 });
        const cleanedProxyMap = cleanupOrphanProxyMap(rankedStreams, oldProxyMap);

        await env.TV_CACHE.put("channel-streams", JSON.stringify(rankedStreams));
        await env.TV_CACHE.put("proxy-map", JSON.stringify(cleanedProxyMap));

        return jsonResponse({
          status: addedCount > 0 ? "Updated" : "No changes",
          tvgCount: addedCount
        });
      } catch (err) {
        return jsonResponse({
          status: "Error",
          message: err.message
        }, 500);
      }
    }

    // -------------------------
    // Stream proxy: GET /?url=... or /proxy?url=...
    // Optional approved header context: ?h=<base64url-json>
    // -------------------------
    const targetRaw = url.searchParams.get("url");
    if (targetRaw) {
      const target = cleanUrl(targetRaw);
      if (!target) {
        return textResponse("Invalid target url", "text/plain; charset=utf-8", 400);
      }

      const headerContext = url.searchParams.get("h") || "";
      const parsedHeaderContext = parseHeaderContext(headerContext);
      if (parsedHeaderContext.error) {
        return textResponse(parsedHeaderContext.error, "text/plain; charset=utf-8", 400);
      }

      const cache = caches.default;
      const cacheKey = new Request(request.url, { method: "GET" });
      const range = request.headers.get("Range");

      const upstreamHeaders = new Headers();
      upstreamHeaders.set("User-Agent", "Mozilla/5.0");
      upstreamHeaders.set("Referer", target);
      for (const [name, value] of Object.entries(parsedHeaderContext.headers)) {
        upstreamHeaders.set(name, value);
      }
      if (range) upstreamHeaders.set("Range", range);

      const targetLooksLikeM3U8 = isLikelyM3U8ByUrl(target);

      if (!range && !targetLooksLikeM3U8) {
        const cached = await cache.match(cacheKey);
        if (cached) {
          return addCorsAndCacheHeaders(
            cached,
            isSegmentLike(target) ? 60 : 20
          );
        }
      }

      const upstreamResp = await fetch(target, {
        method: "GET",
        headers: upstreamHeaders,
        redirect: "follow"
      });

      if (!upstreamResp.ok) {
        return new Response(upstreamResp.body, {
          status: upstreamResp.status,
          statusText: upstreamResp.statusText,
          headers: {
            ...corsHeaders,
            "Content-Type": upstreamResp.headers.get("Content-Type") || "text/plain; charset=utf-8",
            "Cache-Control": "no-store"
          }
        });
      }

      const contentType = upstreamResp.headers.get("Content-Type") || "";
      const isM3U8 =
        targetLooksLikeM3U8 ||
        /application\/(vnd\.apple\.mpegurl|x-mpegurl)/i.test(contentType) ||
        /audio\/mpegurl/i.test(contentType);

      if (isM3U8) {
        const text = await upstreamResp.text();
        const kind = classifyM3U8(text);

        const rewritten = text.split(/\r?\n/).map((line) => {
          const trimmed = line.trim();

          if (!trimmed || trimmed.startsWith("#")) {
            return line.replace(/URI="([^"]+)"/gi, (_, uriValue) => {
              const abs = absoluteFrom(target, cleanUrl(uriValue));
              return `URI="${toProxyUrl(abs, headerContext)}"`;
            });
          }

          const absolute = absoluteFrom(target, cleanUrl(trimmed));
          return toProxyUrl(absolute, headerContext);
        }).join("\n");

        const cacheControl = kind.isLive ? "no-store" : "public, max-age=5";

        return new Response(rewritten, {
          status: 200,
          headers: {
            "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
            ...corsHeaders,
            "Cache-Control": cacheControl
          }
        });
      }

      const maxAge = isSegmentLike(target) ? 60 : 20;
      const proxiedResp = addCorsAndCacheHeaders(upstreamResp, maxAge);

      if (!range) {
        ctx.waitUntil(cache.put(cacheKey, proxiedResp.clone()));
      }

      return proxiedResp;
    }

    return textResponse("Not found", "text/plain; charset=utf-8", 404);
  }
};
