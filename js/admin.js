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
  var accessCodes = [];          // [{ code, usedAt }] loaded from the server
  var showAllCodes = false;

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
        '<p class="lead">This area is for the person conducting the reading.</p>' +
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
          return Promise.all([
            api("/api/settings").then(function (sr) { return sr.json(); }),
            api("/api/access-codes").then(function (cr) { return cr.json(); })
          ]).then(function (res) {
            var s = res[0], c = res[1];
            if (s && typeof s.showResultsToTakers === "boolean") settings.showResultsToTakers = s.showResultsToTakers;
            if (s && typeof s.balancedScoring === "boolean") settings.balancedScoring = s.balancedScoring;
            accessCodes = (c && c.codes) || [];
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
      api("/api/settings").then(function (r) { return r.json(); }),
      api("/api/access-codes").then(function (r) { return r.json(); })
    ]).then(function (res) {
      records = (res[0] && res[0].records) || [];
      if (res[1] && typeof res[1].showResultsToTakers === "boolean") settings.showResultsToTakers = res[1].showResultsToTakers;
      if (res[1] && typeof res[1].balancedScoring === "boolean") settings.balancedScoring = res[1].balancedScoring;
      accessCodes = (res[2] && res[2].codes) || [];
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
        '<span class="muted">' + records.length + ' total readings in central storage</span></div>' +
        '<div style="display:flex;gap:8px"><button class="btn ghost small" id="refresh">Refresh</button>' +
        '<button class="btn ghost small" id="lock">Lock &amp; exit</button></div>' +
      '</div>'
    ));

    /* share / QR */
    card.appendChild(el('<div class="section-title">Share the reading</div>'));
    var origin = location.origin + location.pathname.replace(/\/[^/]*$/, "/");
    var shareRow = el(
      '<div class="toolbar">' +
        '<span class="muted">Reading link:</span>' +
        '<input id="shareUrl" type="text" readonly value="' + esc(origin) + '" style="min-width:240px;flex:1" />' +
        '<button class="btn ghost small" id="copyUrl">Copy</button>' +
        '<button class="btn ghost small" id="qrBtn">Show QR code</button>' +
      '</div>'
    );
    card.appendChild(shareRow);
    var qrWrap = el('<div id="qrWrap" class="center hidden" style="margin:6px 0 4px"></div>');
    card.appendChild(qrWrap);

    /* access codes */
    var singleUseCodes = accessCodes.filter(function (c) { return !c.unlimited; });
    var unlimitedCodes = accessCodes.filter(function (c) { return c.unlimited; });
    var unusedCount = singleUseCodes.filter(function (c) { return !c.usedAt; }).length;
    card.appendChild(el('<div class="section-title">Access codes</div>'));
    card.appendChild(el(
      '<div class="toolbar">' +
        '<span class="muted">' + unusedCount + ' unused &middot; ' + (singleUseCodes.length - unusedCount) +
          ' used &middot; ' + unlimitedCodes.length + ' universal &middot; ' + accessCodes.length + ' total</span>' +
        '<input id="genCount" type="number" min="1" max="500" value="20" style="width:80px" />' +
        '<button class="btn small" id="genCodes">Generate codes</button>' +
        '<button class="btn ghost small" id="toggleCodes">' + (showAllCodes ? "Hide all codes" : "Show all codes") + '</button>' +
        '<button class="btn ghost small" id="resetCodes">Reset all to unused</button>' +
      '</div>'
    ));
    card.appendChild(el(
      '<div class="toolbar">' +
        '<span class="muted">Universal code (never expires, unlimited uses):</span>' +
        '<input id="universalCode" type="text" maxlength="4" inputmode="numeric" pattern="[0-9]*" placeholder="e.g. 0000" ' +
          'value="' + esc((unlimitedCodes[0] && unlimitedCodes[0].code) || "") + '" style="width:100px;letter-spacing:2px" />' +
        '<button class="btn ghost small" id="setUniversal">Set universal code</button>' +
      '</div>'
    ));
    var genResult = el('<div id="genResult" class="hidden" style="margin:6px 0 4px"></div>');
    card.appendChild(genResult);
    if (showAllCodes) card.appendChild(el(codesTable(accessCodes)));

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
      '<span><strong>Use balanced scoring on the result screen</strong> &mdash; adjusts for the fact that the Sattva statements are easier to agree with, so Rajas and Tamas surface when genuinely elevated. Raw scores are always shown too.</span></label>'
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
        stat(recs.length, "Readings in range") +
        stat(avg(recs, "goodness") + "%", "Avg " + modeName("goodness"), color("goodness")) +
        stat(avg(recs, "passion") + "%", "Avg " + modeName("passion"), color("passion")) +
        stat(avg(recs, "ignorance") + "%", "Avg " + modeName("ignorance"), color("ignorance")) +
        stat(avgDuration(recs), "Avg time to complete") +
      '</div>'
    ));

    card.appendChild(el('<div class="section-title">Dominant quality distribution</div>'));
    card.appendChild(el(distBars(dist, recs.length)));

    card.appendChild(el('<div class="section-title">Records &amp; comparison vs group average</div>'));
    card.appendChild(el(recs.length ? recordsTable(recs) : '<p class="muted">No readings in this range yet.</p>'));

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
      return '<tr class="row-clickable" data-profile="' + esc(r.id) + '">' +
        '<td><strong>' + esc(r.name) + '</strong><br><small class="muted">' + esc(r.email || "") +
          (r.zip ? " &middot; " + esc(r.zip) : "") + (r.phone ? " &middot; " + esc(r.phone) : "") + '</small></td>' +
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
      '<p class="muted" style="font-size:12px">Numbers in (parentheses) show how each person compares to the group average for this date range. Click a row to see their full reading.</p></div>';
  }

  /* ---------- full profile modal (click a row in Records) ---------- */
  function profileModeBar(mode, pct) {
    var a = VPI.ANALYSIS[mode];
    return (
      '<div class="modebar">' +
        '<div class="top"><span class="name">' + a.name + ' <small>(' + esc(a.quality) + ' &middot; ' + a.traditional + ')</small></span>' +
        '<span class="val" style="color:' + a.color + '">' + pct + '%</span></div>' +
        '<div class="track"><span style="width:' + pct + '%;background:' + a.color + '"></span></div>' +
      '</div>'
    );
  }
  function profileAnalysisBlock(mode) {
    var a = VPI.ANALYSIS[mode];
    return (
      '<div class="analysis-block">' +
        '<span class="pill" style="background:' + a.color + '">' + a.name + ' &middot; ' + a.traditional + '</span>' +
        '<p>' + esc(a.summary) + '</p>' +
        '<div class="sub">Typical traits</div>' +
        '<ul>' + a.traits.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join("") + '</ul>' +
        '<div class="sub">Strengths</div><p>' + esc(a.strengths) + '</p>' +
        '<div class="sub">Where to grow</div><p>' + esc(a.growth) + '</p>' +
        '<div class="sub">Supportive lifestyle</div><p>' + esc(a.lifestyle) + '</p>' +
      '</div>'
    );
  }
  function profileHtml(r) {
    var raw = r.raw || {};
    var maxRaw = Math.max(raw.goodness || 0, raw.passion || 0, raw.ignorance || 0);
    var leaders = VPI.MODES.filter(function (m) { return raw[m] === maxRaw; });
    var result = { raw: raw, pct: r.pct || {}, dominant: r.dominant, tie: leaders.length > 1 };
    var v = VPI.resultView(result, false);
    var dom = VPI.ANALYSIS[v.dominant];
    var headline = v.tie
      ? "Their qualities are evenly balanced &mdash; no single one stands out."
      : "Their " + (v.close ? "leading" : "dominant") + " quality is <strong style=\"color:" + dom.color + "\">" + dom.name + " (" + dom.traditional + ")</strong>.";
    return (
      '<div class="profile-meta">' +
        '<div><span class="muted">Email</span><br>' + esc(r.email || "—") + '</div>' +
        '<div><span class="muted">Age</span><br>' + esc(r.age != null && r.age !== "" ? r.age : "—") + '</div>' +
        '<div><span class="muted">Zip</span><br>' + esc(r.zip || "—") + '</div>' +
        '<div><span class="muted">Phone</span><br>' + esc(r.phone || "—") + '</div>' +
        '<div><span class="muted">Access code</span><br>' + esc(r.accessCode || "—") + '</div>' +
        '<div><span class="muted">Time to complete</span><br>' + fmtDuration(r.durationMs) + '</div>' +
        '<div><span class="muted">Taken</span><br>' + fmtDate(r.takenAt) + '</div>' +
      '</div>' +
      '<p class="lead" style="margin-top:18px">' + headline + '</p>' +
      v.order.map(function (m) { return profileModeBar(m, v.pct[m]); }).join("") +
      '<p class="muted" style="font-size:13px;margin-top:10px">Raw scores (each area 12&ndash;84): ' +
        VPI.ANALYSIS.goodness.name + ' ' + (raw.goodness != null ? raw.goodness : "—") + ' &middot; ' +
        VPI.ANALYSIS.passion.name + ' ' + (raw.passion != null ? raw.passion : "—") + ' &middot; ' +
        VPI.ANALYSIS.ignorance.name + ' ' + (raw.ignorance != null ? raw.ignorance : "—") + '</p>' +
      v.order.map(profileAnalysisBlock).join("")
    );
  }
  function openProfile(id) {
    var r = records.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    closeProfile();
    var overlay = el(
      '<div class="modal-backdrop" id="profileModal">' +
        '<div class="card modal-card">' +
          '<div class="no-print" style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">' +
            '<h2 style="margin:0">' + esc(r.name) + '&rsquo;s Reading</h2>' +
            '<button class="link-btn" id="closeProfile" aria-label="Close">&#10005;</button>' +
          '</div>' +
          '<h2 class="print-only">' + esc(r.name) + '&rsquo;s Reading</h2>' +
          profileHtml(r) +
          '<div class="btn-row no-print" style="justify-content:center;margin-top:24px">' +
            '<button class="btn ghost" id="exportProfilePdf">&#11015; Download / Print as PDF</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
    document.body.appendChild(overlay);
    document.getElementById("closeProfile").addEventListener("click", closeProfile);
    document.getElementById("exportProfilePdf").addEventListener("click", function () { window.print(); });
    overlay.addEventListener("click", function (e) { if (e.target === overlay) closeProfile(); });
  }
  function closeProfile() {
    var existing = document.getElementById("profileModal");
    if (existing) existing.remove();
  }

  function codesTable(codes) {
    if (!codes.length) return '<p class="muted">No access codes yet — generate some above.</p>';
    var rows = codes.slice().sort(function (a, b) {
      return (a.usedAt ? 1 : 0) - (b.usedAt ? 1 : 0);
    }).map(function (c) {
      var status = c.unlimited
        ? '<strong style="color:#8a5cf6">Unlimited</strong>'
        : (c.usedAt ? '<small class="muted">Used ' + fmtDate(c.usedAt) + '</small>' : '<strong style="color:#1a7f37">Unused</strong>');
      return '<tr><td><code>' + esc(c.code) + '</code></td><td>' + status + '</td></tr>';
    }).join("");
    return '<div style="overflow-x:auto;max-height:280px;overflow-y:auto"><table class="cmp-table">' +
      '<thead><tr><th>Code</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
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

    document.getElementById("genCodes").addEventListener("click", function () {
      var n = Math.max(1, Math.min(500, Math.trunc(Number(document.getElementById("genCount").value)) || 0));
      api("/api/access-codes", { method: "POST", body: { count: n } })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data || !data.created) { flash("Could not generate codes."); return; }
          accessCodes = accessCodes.concat(data.created.map(function (c) { return { code: c, usedAt: null }; }));
          var wrap = document.getElementById("genResult");
          wrap.classList.remove("hidden");
          wrap.innerHTML = "";
          wrap.appendChild(el(
            '<div style="background:#f6f8fa;padding:12px;border-radius:8px">' +
              '<strong>' + data.created.length + ' new code' + (data.created.length === 1 ? "" : "s") + ' — copy and print these:</strong>' +
              '<textarea id="newCodesArea" readonly style="width:100%;height:120px;margin-top:6px;font-family:monospace">' +
                esc(data.created.join("\n")) +
              '</textarea>' +
              '<button class="btn ghost small" id="copyCodes" style="margin-top:6px">Copy all</button>' +
            '</div>'
          ));
          document.getElementById("copyCodes").addEventListener("click", function () {
            var ta = document.getElementById("newCodesArea");
            ta.select();
            try { document.execCommand("copy"); } catch (e) {}
            if (navigator.clipboard) navigator.clipboard.writeText(ta.value).catch(function () {});
            flash("Codes copied.");
          });
          flash("Generated " + data.created.length + " codes.");
        })
        .catch(function () { flash("Could not generate codes."); });
    });
    document.getElementById("toggleCodes").addEventListener("click", function () {
      showAllCodes = !showAllCodes;
      renderDashboard();
    });
    document.getElementById("resetCodes").addEventListener("click", function () {
      if (!confirm("Reset ALL access codes to unused? Anyone who already used a code could use it again.")) return;
      api("/api/access-codes", { method: "POST", body: { action: "reset" } })
        .then(function (r) { return r.json(); })
        .then(function () {
          accessCodes.forEach(function (c) { c.usedAt = null; });
          flash("All codes reset to unused.");
          renderDashboard();
        })
        .catch(function () { flash("Could not reset codes."); });
    });
    document.getElementById("setUniversal").addEventListener("click", function () {
      var code = document.getElementById("universalCode").value.trim();
      if (!code) { flash("Enter a code first."); return; }
      api("/api/access-codes", { method: "POST", body: { universalCode: code } })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data || !data.ok) { flash((data && data.error) || "Could not set universal code."); return; }
          accessCodes = accessCodes.filter(function (c) { return c.code !== data.universal; });
          accessCodes.push({ code: data.universal, usedAt: null, unlimited: true });
          flash("Universal code set to " + data.universal + ".");
          renderDashboard();
        })
        .catch(function () { flash("Could not set universal code."); });
    });

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
      if (!confirm("Delete ALL reading records from central storage? This cannot be undone.")) return;
      api("/api/records?all=1", { method: "DELETE" }).then(function () { loadAndRender(); });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-del]"), function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        if (!confirm("Delete this record?")) return;
        api("/api/records?id=" + encodeURIComponent(b.getAttribute("data-del")), { method: "DELETE" })
          .then(function () { loadAndRender(); });
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-profile]"), function (tr) {
      tr.addEventListener("click", function () { openProfile(tr.getAttribute("data-profile")); });
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
      wrap.appendChild(el('<p class="muted" style="font-size:12px;margin-top:6px">Have takers scan this with their phone camera to open the reading.</p>'));
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
        Name: r.name || "", Email: r.email || "", Age: r.age != null ? r.age : "", Zip: r.zip || "", Phone: r.phone || "",
        AccessCode: r.accessCode || "",
        Dominant: modeName(r.dominant),
        SattvaPct: r.pct ? r.pct.goodness : "", RajasPct: r.pct ? r.pct.passion : "", TamasPct: r.pct ? r.pct.ignorance : "",
        SattvaRaw: r.raw ? r.raw.goodness : "", RajasRaw: r.raw ? r.raw.passion : "", TamasRaw: r.raw ? r.raw.ignorance : "",
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
