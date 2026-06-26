var BASE_URL = "https://4khdhub.one";

function fetchText(url) {
  return fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      Referer: BASE_URL,
      Accept: "text/html,application/xhtml+xml,*/*",
    },
  }).then(function (res) {
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.text();
  });
}

function searchTitle(title, year, mediaType) {
  var query = encodeURIComponent(title);
  var searchUrl = BASE_URL + "/?s=" + query;

  return fetchText(searchUrl).then(function (html) {
    var typeKeyword = mediaType === "tv" ? "series" : "movie";
    var linkRegex = /href="(https:\/\/4khdhub\.one\/[^"]+(?:movie|series)[^"]+)"/g;
    var match;
    var candidates = [];

    while ((match = linkRegex.exec(html)) !== null) {
      var href = match[1];
      if (
        href.indexOf("/category/") === -1 &&
        href.indexOf("/page/") === -1 &&
        href.indexOf("/?") === -1
      ) {
        candidates.push(href);
      }
    }

    if (candidates.length === 0) return null;

    var scored = candidates.map(function (url) {
      var score = 0;
      var urlLower = url.toLowerCase();
      var titleWords = title.toLowerCase().split(/\s+/).filter(function (w) { return w.length > 2; });

      if (urlLower.indexOf(typeKeyword) !== -1) score += 3;
      titleWords.forEach(function (word) { if (urlLower.indexOf(word) !== -1) score += 1; });
      if (year && urlLower.indexOf(String(year)) !== -1) score += 2;

      return { url: url, score: score };
    });

    scored.sort(function (a, b) { return b.score - a.score; });
    return scored[0].score > 0 ? scored[0].url : null;
  });
}

function scrapePage(pageUrl, season, episode) {
  return fetchText(pageUrl).then(function (html) {
    var streams = [];
    var htmlSection = html;

    if (season && episode) {
      var seasonTag = season < 10 ? "S0" + season : "S" + season;
      var epTag = episode < 10 ? "E0" + episode : "E" + episode;

      var epPattern = new RegExp(
        "Episode[-\\s]*0*" + episode + "[\\s\\S]{0,2000}?(?=Episode[-\\s]*0*" + (episode + 1) + "|Download Complete|You May Also Like|$)",
        "i"
      );
      var epMatch = epPattern.exec(html);
      if (epMatch) {
        htmlSection = epMatch[0];
      } else {
        var filePattern = new RegExp(
          seasonTag + epTag + "[\\s\\S]{0,3000}?(?=" + seasonTag + "E0*" + (episode + 1) + "|Download Complete|You May Also Like|$)",
          "i"
        );
        var fileMatch = filePattern.exec(html);
        if (fileMatch) htmlSection = fileMatch[0];
      }
    }

    var blockRegex = /([^\n]{20,120}(?:2160p|1080p|720p)[^\n]{0,100})\s*[\s\S]{0,500}?href="(https:\/\/hubcloud\.[a-z]+\/drive\/[a-zA-Z0-9_-]+)"/g;
    var blockMatch;

    while ((blockMatch = blockRegex.exec(htmlSection)) !== null) {
      var label = blockMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      var link = blockMatch[2];

      var quality = "Unknown";
      if (label.indexOf("2160p") !== -1 || label.indexOf("4K") !== -1) {
        quality = label.indexOf("REMUX") !== -1 ? "4K REMUX" : "4K";
        if (label.indexOf("DV HDR") !== -1) quality += " DV HDR";
      } else if (label.indexOf("1080p") !== -1) {
        quality = label.indexOf("REMUX") !== -1 ? "1080p REMUX" : "1080p";
        if (label.indexOf("DV HDR") !== -1) quality += " DV HDR";
      }

      var source = "WEB";
      if (label.indexOf("BluRay") !== -1) source = "BluRay";
      if (label.indexOf("WEB-DL") !== -1) source = "WEB-DL";
      if (label.indexOf("IMAX") !== -1) source = "IMAX " + source;

      var codec = "";
      if (label.indexOf("H265") !== -1 || label.indexOf("HEVC") !== -1) codec = " H265";
      else if (label.indexOf("H264") !== -1) codec = " H264";

      streams.push({
        title: "4KHDHub · " + quality + " " + source + codec,
        url: link,
        behaviorHints: { notWebReady: true, bingeGroup: "4khdhub" },
      });
    }

    if (streams.length === 0) {
      var hubcloudRegex = /href="(https:\/\/hubcloud\.[a-z]+\/drive\/[a-zA-Z0-9_-]+)"/g;
      var hubdriveRegex = /href="(https:\/\/hubdrive\.[a-z]+\/file\/[0-9]+)"/g;
      var m;
      var idx = 0;
      while ((m = hubcloudRegex.exec(htmlSection)) !== null) {
        streams.push({ title: "4KHDHub · Link " + (idx + 1), url: m[1], behaviorHints: { notWebReady: true } });
        idx++;
      }
      while ((m = hubdriveRegex.exec(htmlSection)) !== null) {
        streams.push({ title: "4KHDHub HubDrive · Link " + (idx + 1), url: m[1], behaviorHints: { notWebReady: true } });
        idx++;
      }
    }

    var seen = {};
    streams = streams.filter(function (s) {
      if (seen[s.url]) return false;
      seen[s.url] = true;
      return true;
    });

    return streams;
  });
}

function getStreams(tmdbId, mediaType, season, episode, metadata) {
  if (!metadata || !metadata.title) return Promise.resolve([]);

  var title = metadata.title;
  var year = metadata.year || null;

  return searchTitle(title, year, mediaType)
    .then(function (pageUrl) {
      if (!pageUrl) return [];
      return scrapePage(pageUrl, season, episode);
    })
    .catch(function (err) {
      console.error("[4KHDHub] Error:", err.message || err);
      return [];
    });
}

module.exports = { getStreams: getStreams };
