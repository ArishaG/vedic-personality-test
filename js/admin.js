/* Facilitator dashboard for the HOSTED version. Authenticates with the shared
   admin password against the API, then loads ALL results from the central
   database for analytics, date filtering, Excel export, and live show/hide. */
(function () {
  var view = document.getElementById("view");
  var pw = null;                 // admin password held in memory for this session
  var records = [];              // all records loaded from the server
  var settings = { showResultsToTakers: true, balancedScoring: false };
  var filterRange = "all";
  var customFrom = null, customTo = null;

  function el(html) { var d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstChild; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function color(mode) { return VPI.ANALYSIS[mode].color; }
  function modeName(mode) { return VPI.ANALYSIS[mode].name; }

  function api(path, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    if (pw) opts.headers["x-admin-password"] = pw;
    if (opts.body && typeof opts.body !== "string") {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(opts.body);
    }
    return fetch(path, opts);
  }

  function open() {
    if (!pw) { renderLogin(); return; }
    loadAndRender();
  }

  /* ---------- login ---------- */
  function renderLogin(errMsg) {
    view.innerHTML = "";
    view.appendChild(el(
      '<div class="card center" style="max-width:440px;margin:0 auto">' +
        '<span class="hero-badge">Facilitator Area</span>' +
        '<h2>Enter password</h2>' +
        '<p class="lead">This area is for the person conducting the test.</p>' +
        '<form id="login" style="max-width:300px;margin:0 auto">' +
          '<div class="field" id="f_pw"><input id="pw" type="password" placeholder="Password" autofocus />' +
          '<div class="err">' + (errMsg ? esc(errMsg) : 'Incorrect password.') + '</div></div>' +
          '<button class="btn" type="submit" style="width:100%">Unlock</button>' +
        '</form>' +
      '</div>'
    ));
    document.getElementById("login").addEventListener("submit", function (e) {
      e.preventDefault();
      var candidate = document.getElementById("pw").value;
      pw = candidate;
      // Validate by attempting to load records.
      api("/api/records").then(function (r) {
        if (r.status === 401) { pw = null; document.getElementById("f_pw").classList.add("invalid"); return; }
        return r.json().then(function (data) {
          records = (data && data.records) || [];
          return api("/api/settings").then(function (sr) { return sr.json(); }).then(function (s) {
            if (s && typeof s.showResultsToTakers === "boolean") settings.showResultsToTakers = s.showResultsToTakers;
            if (s && typeof s.balancedScoring === "boolean") settings.balancedScoring = s.balancedScoring;
            renderDashboard();
          });
        });
      }).catch(function () { pw = null; renderLogin("Could not reach the server."); });
    });
  }

  function loadAndRender() {
    view.innerHTML = "";
    view.appendChild(el('<div class="card center"><h2>Loading results…</h2></div>'));
    Promise.all([
      api("/api/records").then(function (r) { return r.json(); }),
      api("/api/settings").then(function (r) { return r.json(); })
    ]).then(function (res) {
      records = (res[0] && res[0].records) || [];
      if (res[1] && typeof res[1].showResultsToTakers === "boolean") settings.showResultsToTakers = res[1].showResultsToTakers;
      if (res[1] && typeof res[1].balancedScoring === "boolean") settings.balancedScoring = res[1].balancedScoring;
      renderDashboard();
    }).catch(function () {
      view.innerHTML = "";
      view.appendChild(el('<div class="card center"><h2 class="danger">Could not load results.</h2><p class="lead">Check your connection and try again.</p></div>'));
    });
  }

  /* ---------- date filtering ---------- */
  function inRange(rec) {
    var t = new Date(rec.takenAt), now = new Date();
    if (filterRange === "all") return true;
    if (filterRange === "today") return t.toDateString() === now.toDateString();
    if (filterRange === "7d") return t >= new Date(now.getTime() - 7 * 864e5);
    if (filterRange === "30d") return t >= new Date(now.getTime() - 30 * 864e5);
    if (filterRange === "lastmonth") {
      var first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      var last = new Date(now.getFullYear(), now.getMonth(), 1);
      return t >= first && t < last;
    }
    if (filterRange === "thismonth") return t >= new Date(now.getFullYear(), now.getMonth(), 1);
    if (filterRange === "custom") {
      var ok = true;
      if (customFrom) ok = ok && t >= new Date(customFrom + "T00:00:00");
      if (customTo) ok = ok && t <= new Date(customTo + "T23:59:59");
      return ok;
    }
    return true;
  }
  function fmtDate(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) +
      " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  function fmtDuration(ms) {
    if (ms == null || isNaN(ms)) return "\u2014";
    var sec = Math.round(ms / 1000), m = Math.floor(sec / 60), s = sec % 60;
    return m + "m " + (s < 10 ? "0" : "") + s + "s";
  }
  function avg(recs, mode) {
    var v = recs.filter(function (r) { return r.pct && r.pct[mode] != null; });
    if (!v.length) return 0;
    return Math.round((v.reduce(function (a, r) { return a + r.pct[mode]; }, 0) / v.length) * 10) / 10;
  }
  function avgDuration(recs) {
    var v = recs.filter(function (r) { return typeof r.durationMs === "number"; });
    if (!v.length) return "\u2014";
    return fmtDuration(v.reduce(function (a, r) { return a + r.durationMs; }, 0) / v.length);
  }

  /* ---------- dashboard ---------- */
  function renderDashboard() {
    var recs = records.filter(inRange);
    var dist = { goodness: 0, passion: 0, ignorance: 0 };
    recs.forEach(function (r) { if (dist[r.dominant] != null) dist[r.dominant]++; });

    view.innerHTML = "";
    var card = el('<div class="card"></div>');

    card.appendChild(el(
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">' +
        '<div><h2 style="margin:0">Facilitator Dashboard</h2>' +
        '<span class="muted">' + records.length + ' total tests in central storage</span></div>' +
        '<div style="display:flex;gap:8px"><button class="btn ghost small" id="refresh">Refresh</button>' +
        '<button class="btn ghost small" id="lock">Lock &amp; exit</button></div>' +
      '</div>'
    ));

    /* share / QR */
    card.appendChild(el('<div class="section-title">Share the test</div>'));
    var origin = location.origin + location.pathname.replace(/\/[^/]*$/, "/");
    var shareRow = el(
      '<div class="toolbar">' +
        '<span class="muted">Test link:</span>' +
        '<input id="shareUrl" type="text" readonly value="' + esc(origin) + '" style="min-width:240px;flex:1" />' +
        '<button class="btn ghost small" id="copyUrl">Copy</button>' +
        '<button class="btn ghost small" id="qrBtn">Show QR code</button>' +
      '</div>'
    );
    card.appendChild(shareRow);
    var qrWrap = el('<div id="qrWrap" class="center hidden" style="margin:6px 0 4px"></div>');
    card.appendChild(qrWrap);

    /* live setting */
    card.appendChild(el('<div class="section-title">Display setting (applies to everyone, live)</div>'));
    var setRow = el('<div class="toolbar"></div>');
    setRow.appendChild(el(
      '<label class="switch"><input type="checkbox" id="showToggle" ' +
      (settings.showResultsToTakers ? "checked" : "") + ' />' +
      '<span><strong>Show full result to takers on their phone</strong> &mdash; when off, takers see only a thank-you screen and you review results here.</span></label>'
    ));
    card.appendChild(setRow);
    var balRow = el('<div class="toolbar"></div>');
    balRow.appendChild(el(
      '<label class="switch"><input type="checkbox" id="balToggle" ' +
      (settings.balancedScoring ? "checked" : "") + ' />' +
      '<span><strong>Use balanced scoring on the result screen</strong> &mdash; adjusts for the fact that the Clarity statements are easier to agree with, so Drive and Inertia surface when genuinely elevated. Raw scores are always shown too.</span></label>'
    ));
    card.appendChild(balRow);

    /* analytics toolbar */
    card.appendChild(el('<div class="section-title">Analytics</div>'));
    card.appendChild(el(
      '<div class="toolbar">' +
        '<span class="muted">Date range:</span>' +
        '<select id="range">' +
          opt("all", "All time") + opt("today", "Today") + opt("7d", "Last 7 days") +
          opt("30d", "Last 30 days") + opt("thismonth", "This month") + opt("lastmonth", "Last month") +
          opt("custom", "Custom\u2026") +
        '</select>' +
        '<span id="customWrap" class="' + (filterRange === "custom" ? "" : "hidden") + '">' +
          'From <input type="date" id="from" value="' + (customFrom || "") + '" /> ' +
          'To <input type="date" id="to" value="' + (customTo || "") + '" />' +
        '</span>' +
        '<button class="btn small" id="xlsx">&#11015; Export to Excel</button>' +
      '</div>'
    ));

    /* stats */
    card.appendChild(el(
      '<div class="stat-grid">' +
        stat(recs.length, "Tests in range") +
        stat(avg(recs, "goodness") + "%", "Avg " + modeName("goodness"), color("goodness")) +
        stat(avg(recs, "passion") + "%", "Avg " + modeName("passion"), color("passion")) +
        stat(avg(recs, "ignorance") + "%", "Avg " + modeName("ignorance"), color("ignorance")) +
        stat(avgDuration(recs), "Avg time to complete") +
      '</div>'
    ));

    card.appendChild(el('<div class="section-title">Dominant quality distribution</div>'));
    card.appendChild(el(distBars(dist, recs.length)));

    card.appendChild(el('<div class="section-title">Records &amp; comparison vs group average</div>'));
    card.appendChild(el(recs.length ? recordsTable(recs) : '<p class="muted">No tests in this range yet.</p>'));

    card.appendChild(el('<div class="section-title danger">Danger zone</div>'));
    card.appendChild(el('<button class="btn danger-btn small" id="clear">Delete ALL records</button>'));

    view.appendChild(card);
    window.scrollTo(0, 0);
    wire();
  }

  function opt(v, label) { return '<option value="' + v + '"' + (filterRange === v ? " selected" : "") + '>' + label + '</option>'; }
  function stat(num, lbl, c) {
    return '<div class="stat"><div class="num"' + (c ? ' style="color:' + c + '"' : '') + '>' + num + '</div><div class="lbl">' + lbl + '</div></div>';
  }
  function distBars(dist, total) {
    if (!total) return '<p class="muted">No data in range.</p>';
    return '<div>' + ["goodness", "passion", "ignorance"].map(function (m) {
      var n = dist[m], p = Math.round((n / total) * 100);
      return '<div class="modebar"><div class="top"><span class="name">' + modeName(m) +
        '</span><span class="val">' + n + ' (' + p + '%)</span></div>' +
        '<div class="track"><span style="width:' + p + '%;background:' + color(m) + '"></span></div></div>';
    }).join("") + '</div>';
  }
  function recordsTable(recs) {
    var gAvg = avg(recs, "goodness"), pAvg = avg(recs, "passion"), iAvg = avg(recs, "ignorance");
    var rows = recs.slice().sort(function (a, b) { return new Date(b.takenAt) - new Date(a.takenAt); }).map(function (r) {
      function cell(mode, a) {
        var v = r.pct ? r.pct[mode] : 0;
        var diff = Math.round((v - a) * 10) / 10, sign = diff > 0 ? "+" : "", cls = diff >= 0 ? "good" : "bad";
        return '<td><span style="color:' + color(mode) + '">' + v + '%</span> <small class="' + cls + '">(' + sign + diff + ')</small></td>';
      }
      return '<tr>' +
        '<td><strong>' + esc(r.name) + '</strong><br><small class="muted">' + esc(r.email || "") +
          (r.phone ? " &middot; " + esc(r.phone) : "") + '</small></td>' +
        '<td>' + esc(r.age != null ? r.age : "") + '</td>' +
        '<td><span class="tag" style="background:' + color(r.dominant) + '">' + modeName(r.dominant) + '</span></td>' +
        cell("goodness", gAvg) + cell("passion", pAvg) + cell("ignorance", iAvg) +
        '<td><small class="muted">' + fmtDuration(r.durationMs) + '</small></td>' +
        '<td><small class="muted">' + fmtDate(r.takenAt) + '</small></td>' +
        '<td><button class="link-btn danger" data-del="' + esc(r.id) + '">Delete</button></td>' +
      '</tr>';
    }).join("");
    return '<div style="overflow-x:auto"><table class="cmp-table"><thead><tr>' +
      '<th>Name</th><th>Age</th><th>Dominant</th><th>' + modeName("goodness") + '</th><th>' +
      modeName("passion") + '</th><th>' + modeName("ignorance") + '</th><th>Time</th><th>Date taken</th><th></th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p class="muted" style="font-size:12px">Numbers in (parentheses) show how each person compares to the group average for this date range.</p></div>';
  }

  /* ---------- wiring ---------- */
  function wire() {
    document.getElementById("refresh").addEventListener("click", loadAndRender);
    document.getElementById("lock").addEventListener("click", function () { pw = null; records = []; window.Router.go("test"); });

    document.getElementById("copyUrl").addEventListener("click", function () {
      var inp = document.getElementById("shareUrl");
      inp.select();
      try { document.execCommand("copy"); } catch (e) {}
      if (navigator.clipboard) navigator.clipboard.writeText(inp.value).catch(function () {});
      flash("Link copied.");
    });
    document.getElementById("qrBtn").addEventListener("click", toggleQr);

    document.getElementById("showToggle").addEventListener("change", function (e) {
      var val = e.target.checked;
      api("/api/settings", { method: "POST", body: { showResultsToTakers: val } })
        .then(function (r) { return r.json(); })
        .then(function (s) {
          settings.showResultsToTakers = !!(s && s.showResultsToTakers);
          flash(settings.showResultsToTakers ? "Takers will now see their results." : "Results are now hidden from takers.");
        })
        .catch(function () { flash("Could not update setting."); e.target.checked = settings.showResultsToTakers; });
    });

    document.getElementById("balToggle").addEventListener("change", function (e) {
      var val = e.target.checked;
      api("/api/settings", { method: "POST", body: { balancedScoring: val } })
        .then(function (r) { return r.json(); })
        .then(function (s) {
          settings.balancedScoring = !!(s && s.balancedScoring);
          flash(settings.balancedScoring ? "Balanced scoring on for new results." : "Balanced scoring off (faithful raw scoring).");
        })
        .catch(function () { flash("Could not update setting."); e.target.checked = settings.balancedScoring; });
    });

    document.getElementById("range").addEventListener("change", function (e) { filterRange = e.target.value; renderDashboard(); });
    var from = document.getElementById("from"), to = document.getElementById("to");
    if (from) from.addEventListener("change", function (e) { customFrom = e.target.value; renderDashboard(); });
    if (to) to.addEventListener("change", function (e) { customTo = e.target.value; renderDashboard(); });

    document.getElementById("xlsx").addEventListener("click", exportExcel);

    document.getElementById("clear").addEventListener("click", function () {
      if (!confirm("Delete ALL test records from central storage? This cannot be undone.")) return;
      api("/api/records?all=1", { method: "DELETE" }).then(function () { loadAndRender(); });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-del]"), function (b) {
      b.addEventListener("click", function () {
        if (!confirm("Delete this record?")) return;
        api("/api/records?id=" + encodeURIComponent(b.getAttribute("data-del")), { method: "DELETE" })
          .then(function () { loadAndRender(); });
      });
    });
  }

  function toggleQr() {
    var wrap = document.getElementById("qrWrap");
    if (!wrap.classList.contains("hidden")) { wrap.classList.add("hidden"); wrap.innerHTML = ""; return; }
    var url = document.getElementById("shareUrl").value;
    try {
      var qr = qrcode(0, "M");
      qr.addData(url);
      qr.make();
      wrap.innerHTML = qr.createImgTag(6, 12);
      wrap.appendChild(el('<p class="muted" style="font-size:12px;margin-top:6px">Have takers scan this with their phone camera to open the test.</p>'));
    } catch (e) {
      wrap.innerHTML = '<p class="muted">Could not generate QR code.</p>';
    }
    wrap.classList.remove("hidden");
  }

  function flash(msg) {
    var n = el('<div style="position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#21303a;color:#fff;padding:10px 18px;border-radius:24px;z-index:99">' + esc(msg) + '</div>');
    document.body.appendChild(n);
    setTimeout(function () { n.remove(); }, 1800);
  }

  /* ---------- Excel export ---------- */
  function exportExcel() {
    var recs = records.filter(inRange).slice().sort(function (a, b) { return new Date(a.takenAt) - new Date(b.takenAt); });
    if (!recs.length) { flash("No records in this date range to export."); return; }
    var rows = recs.map(function (r) {
      return {
        Name: r.name || "", Email: r.email || "", Age: r.age != null ? r.age : "", Phone: r.phone || "",
        Dominant: modeName(r.dominant),
        ClarityPct: r.pct ? r.pct.goodness : "", DrivePct: r.pct ? r.pct.passion : "", InertiaPct: r.pct ? r.pct.ignorance : "",
        ClarityRaw: r.raw ? r.raw.goodness : "", DriveRaw: r.raw ? r.raw.passion : "", InertiaRaw: r.raw ? r.raw.ignorance : "",
        TimeToComplete: fmtDuration(r.durationMs), TakenAt: r.takenAt || ""
      };
    });
    var ws = XLSX.utils.json_to_sheet(rows);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Results");
    XLSX.writeFile(wb, "vedic-results-" + new Date().toISOString().slice(0, 10) + ".xlsx");
    flash("Exported " + recs.length + " records.");
  }

  window.Admin = { open: open };
})();
