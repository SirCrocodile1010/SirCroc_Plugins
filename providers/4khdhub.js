var BASE_URL = "https://4khdhub.one";
var TMDB_KEY = "0b4f2c237b76c2a76e85f0b34e3d8a5c";

function doFetch(url, ref) {
  return fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "Referer": ref || BASE_URL,
      "Accept": "text/html,*/*"
    }
  }).then(function(r) { return r.text(); });
}

function getTmdb(id, type) {
  var ep = type === "tv" ? "tv" : "movie";
  return fetch("https://api.themoviedb.org/3/" + ep + "/" + id + "?api_key=" + TMDB_KEY)
    .then(function(r) { return r.json(); })
    .then(function(d) {
      return {
        title: d.title || d.name || "",
        year: (d.release_date || d.first_air_date || "").split("-")[0]
      };
    });
}

function searchPage(title, year, type) {
  var q = encodeURIComponent(title + " " + year);
  return doFetch(BASE_URL + "/?s=" + q).then(function(html) {
    var kw = type === "tv" ? "series" : "movie";
    var re = /href="(https:\/\/4khdhub\.one\/[^"#?]+)"/g;
    var m, best = null, bestScore = -1;
    var words = title.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").filter(function(w) { return w.length > 2; });
    while ((m = re.exec(html)) !== null) {
      var u = m[1];
      if (u.indexOf("/category/") !== -1 || u.indexOf("/page/") !== -1 || u === BASE_URL + "/") continue;
      if (u.indexOf(kw) === -1) continue;
      var slug = u.toLowerCase();
      var sc = 0;
      words.forEach(function(w) { if (slug.indexOf(w) !== -1) sc++; });
      if (year && slug.indexOf(year) !== -1) sc += 2;
      if (sc > bestScore) { bestScore = sc; best = u; }
    }
    return best;
  });
}

function getLabel(ctx) {
  var t = ctx.replace(/<[^>]+>/g, " ");
  var q = "HD";
  if (t.indexOf("2160p") !== -1 || t.indexOf("4K") !== -1) {
    q = t.indexOf("REMUX") !== -1 ? "4K REMUX" : "4K";
  } else if (t.indexOf("1080p") !== -1) {
    q = t.indexOf("REMUX") !== -1 ? "1080p REMUX" : "1080p";
  } else if (t.indexOf("720p") !== -1) {
    q = "720p";
  }
  if (t.indexOf("DV HDR") !== -1 || t.indexOf("DoVi") !== -1) q += " DV HDR";
  else if (t.indexOf("HDR") !== -1) q += " HDR";
  var s = t.indexOf("IMAX") !== -1 ? "IMAX " : "";
  if (t.indexOf("BluRay") !== -1) s += "BluRay";
  else if (t.indexOf("WEB-DL") !== -1) s += "WEB-DL";
  else if (t.indexOf("WEB") !== -1) s += "WEB";
  var c = "";
  if (t.indexOf("HEVC") !== -1 || t.indexOf("H265") !== -1 || t.indexOf("x265") !== -1) c = " H265";
  else if (t.indexOf("H264") !== -1 || t.indexOf("x264") !== -1 || t.indexOf("AVC") !== -1) c = " H264";
  return ("4KHDHub · " + q + " " + s + c).trim();
}

function scrape(url, sn, ep) {
  return doFetch(url, url).then(function(html) {
    var section = html;
    if (sn != null && ep != null) {
      var tag = (sn < 10 ? "S0" + sn : "S" + sn) + (ep < 10 ? "E0" + ep : "E" + ep);
      var idx = html.toUpperCase().indexOf(tag.toUpperCase());
      if (idx !== -1) section = html.substring(Math.max(0, idx - 300), Math.min(html.length, idx + 6000));
    }
    var streams = [], seen = {};
    var re1 = /href="(https:\/\/hubcloud\.[^"]+\/drive\/[a-zA-Z0-9_-]+)"/g;
    var re2 = /href="(https:\/\/hubdrive\.[^"]+\/file\/[0-9]+)"/g;
    var m;
    while ((m = re1.exec(section)) !== null) {
      var lnk = m[1];
      if (seen[lnk]) continue;
      seen[lnk] = true;
      var ctx = section.substring(Math.max(0, m.index - 500), m.index);
      streams.push({ title: getLabel(ctx), url: lnk, behaviorHints: { notWebReady: true, bingeGroup: "4khdhub" } });
    }
    while ((m = re2.exec(section)) !== null) {
      var lnk2 = m[1];
      if (seen[lnk2]) continue;
      seen[lnk2] = true;
      var ctx2 = section.substring(Math.max(0, m.index - 500), m.index);
      streams.push({ title: getLabel(ctx2).replace("4KHDHub ·", "4KHDHub HD ·"), url: lnk2, behaviorHints: { notWebReady: true, bingeGroup: "4khdhub" } });
    }
    return streams;
  });
}

function getStreams(tmdbId, mediaType, season, episode) {
  return getTmdb(tmdbId, mediaType)
    .then(function(meta) {
      if (!meta.title) return [];
      return searchPage(meta.title, meta.year, mediaType)
        .then(function(pageUrl) {
          if (!pageUrl) return [];
          return scrape(pageUrl, season, episode);
        });
    })
    .catch(function(err) {
      console.error("[4KHDHub]", err.message || String(err));
      return [];
    });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
