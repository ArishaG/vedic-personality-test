/* Test flow for the HOSTED version: welcome -> questions -> submit to API -> result.
   Scoring/analysis run in the browser; the record is saved to the central database. */
(function () {
  var view = document.getElementById("view");
  var state = { person: null, answers: [], index: 0, startTime: null };

  function el(html) { var d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstChild; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- Landing (wide/landscape screens only) ---------- */
  function isWideLandscape() {
    return window.matchMedia && window.matchMedia("(min-width: 880px) and (orientation: landscape)").matches;
  }

  function renderLanding() {
    state = { person: null, answers: [], index: 0, startTime: null };
    view.innerHTML = "";
    var section = el(
      '<div class="landing">' +
        '<div class="landing-hero">' +
          '<div class="landing-left">' +
            '<h1 class="landing-title">The Vedic<br>Personality Reading</h1>' +
            '<p class="landing-sub">Discover your dominant quality of nature — a living blend of Sattva, Rajas and Tamas.</p>' +
            '<button class="btn btn-lg" id="goToForm">Take the Reading &rarr;</button>' +
          '</div>' +
          '<div class="landing-right">' +
            '<div class="stats-label">Live Reading Stats</div>' +
            '<div id="statsArea"><p class="muted">Loading live stats&hellip;</p></div>' +
            '<p class="landing-question">How does your inner balance compare?</p>' +
          '</div>' +
        '</div>' +
        '<div class="scroll-hint">Scroll to explore the three gunas &#8595;</div>' +
        '<div class="guna-section" id="gunaSection"></div>' +
      '</div>'
    );
    view.appendChild(section);
    document.getElementById("goToForm").addEventListener("click", renderWelcome);
    loadLandingStats();
    renderGunaSection();
  }

  function legendItem(color, name, pct) {
    return (
      '<div class="legend-item"><span class="legend-dot" style="background:' + color + '"></span>' +
      name + ' <strong>' + (pct != null ? pct : "—") + '%</strong></div>'
    );
  }
  // Builds a 100-dot "crowd" pictogram, proportioned and color-coded by average guna split.
  // Dots are grouped by guna (not shuffled) so each color forms its own cluster.
  function buildCrowdDots(g, p, ig) {
    var total = g + p + ig;
    var nG = total ? Math.round((g / total) * 100) : 0;
    var nP = total ? Math.round((p / total) * 100) : 0;
    var nI = total ? 100 - nG - nP : 0;
    var arr = [];
    var i;
    for (i = 0; i < nG; i++) arr.push(VPI.ANALYSIS.goodness.color);
    for (i = 0; i < nP; i++) arr.push(VPI.ANALYSIS.passion.color);
    for (i = 0; i < nI; i++) arr.push(VPI.ANALYSIS.ignorance.color);
    return arr;
  }
  function statsHtml(data) {
    var avg = (data && data.avgPct) || {};
    var g = avg.goodness, p = avg.passion, ig = avg.ignorance;
    if (g == null && p == null && ig == null) {
      return '<p class="muted">Be the first to take the reading and set the baseline!</p>';
    }
    var dots = buildCrowdDots(g || 0, p || 0, ig || 0);
    var topMode = (g || 0) >= (p || 0) && (g || 0) >= (ig || 0) ? "goodness" : ((p || 0) >= (ig || 0) ? "passion" : "ignorance");
    var topInfo = VPI.ANALYSIS[topMode];
    return (
      '<div class="crowd-viz">' +
        '<div class="crowd-blob">' +
          dots.map(function (c) { return '<span class="crowd-dot" style="--c:' + c + '"></span>'; }).join("") +
        '</div>' +
        '<div class="crowd-legend">' +
          legendItem(VPI.ANALYSIS.goodness.color, "Sattva", g) +
          legendItem(VPI.ANALYSIS.passion.color, "Rajas", p) +
          legendItem(VPI.ANALYSIS.ignorance.color, "Tamas", ig) +
        '</div>' +
      '</div>' +
      '<p class="landing-stats-note muted">From Veg Fest today, most people were in ' +
        '<strong style="color:' + topInfo.color + '">' + topInfo.name + '</strong>.</p>'
    );
  }
  function loadLandingStats() {
    var area = document.getElementById("statsArea");
    fetch("/api/stats").then(function (r) { return r.json(); })
      .then(function (data) { if (area) area.innerHTML = statsHtml(data); })
      .catch(function () { if (area) area.innerHTML = '<p class="muted">Stats unavailable right now.</p>'; });
  }

  function renderGunaSection() {
    var wrap = document.getElementById("gunaSection");
    if (!wrap) return;
    wrap.innerHTML =
      '<div class="section-heading">The Three Gunas</div>' +
      '<p class="section-sub muted">Every personality is a living blend of these three universal qualities.</p>' +
      '<div class="guna-grid">' +
        VPI.MODES.map(function (m) {
          var a = VPI.ANALYSIS[m];
          return (
            '<div class="guna-card" data-mode="' + m + '" style="--c:' + a.color + '">' +
              '<div class="guna-orb"></div>' +
              '<div class="guna-name">' + a.name + '</div>' +
              '<div class="guna-quality">' + esc(a.quality) + ' &middot; ' + esc(a.traditional) + '</div>' +
              '<p class="guna-blurb">' + esc(a.summary) + '</p>' +
              '<ul class="guna-traits">' + a.traits.slice(0, 3).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join("") + '</ul>' +
              '<span class="guna-toggle">Show traits &darr;</span>' +
            '</div>'
          );
        }).join("") +
      '</div>';
    Array.prototype.forEach.call(wrap.querySelectorAll(".guna-card"), function (card) {
      card.addEventListener("click", function () {
        var open = card.classList.toggle("expanded");
        card.querySelector(".guna-toggle").innerHTML = open ? "Hide traits &uarr;" : "Show traits &darr;";
      });
    });
  }

  /* ---------- Welcome ---------- */
  function renderWelcome() {
    state = { person: null, answers: [], index: 0, startTime: null };
    view.innerHTML = "";
    var card = el(
      '<div class="card mystical welcome-card">' +
        '<div class="welcome-grid">' +
          '<div class="welcome-hero">' +
            '<span class="hero-badge">The Vedic Personality Reading</span>' +
            '<h2>Discover your dominant quality of nature</h2>' +
            '<p class="lead">Answer 36 quick statements. Takes about 5 minutes. Your reading reveals your balance of ' +
            'three inner qualities — Sattva, Rajas and Tamas.</p>' +
          '</div>' +
          '<div class="welcome-form-panel">' +
            '<form id="who">' +
              field("code", "Access code", "tel", true, 'maxlength="4" inputmode="numeric" pattern="[0-9]*" style="letter-spacing:4px"') +
              field("name", "Full name", "text", true) +
              field("email", "Email", "email", true) +
              selectField("age", "Age", ageOptions(), true) +
              field("zip", "Zip code", "text", true, 'maxlength="10" inputmode="numeric"') +
              field("phone", "Phone", "tel", false) +
              '<button class="btn" type="submit" style="width:100%;margin-top:10px;">Begin the Reading &rarr;</button>' +
            '</form>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
    view.appendChild(card);
    document.getElementById("who").addEventListener("submit", onWelcomeSubmit);
  }

  var AGE_RANGES = ["Under 18", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
  function ageOptions() {
    var opts = '<option value="" disabled selected>Select age range</option>';
    AGE_RANGES.forEach(function (r) { opts += '<option value="' + r + '">' + r + '</option>'; });
    return opts;
  }

  function field(id, label, type, required, extra) {
    return (
      '<div class="field" id="f_' + id + '">' +
        '<label for="' + id + '">' + esc(label) + (required ? ' <span class="req">*</span>' : '') + '</label>' +
        '<input id="' + id + '" name="' + id + '" type="' + type + '" ' +
          (type === "number" ? 'min="1" max="120" inputmode="numeric" ' : '') +
          'autocomplete="off" ' + (required ? 'required' : '') + ' ' + (extra || '') + ' />' +
        '<div class="err">Please enter a valid ' + esc(label.replace(" (optional)", "").toLowerCase()) + '.</div>' +
      '</div>'
    );
  }

  function selectField(id, label, optionsHtml, required) {
    return (
      '<div class="field" id="f_' + id + '">' +
        '<label for="' + id + '">' + esc(label) + (required ? ' <span class="req">*</span>' : '') + '</label>' +
        '<select id="' + id + '" name="' + id + '" ' + (required ? 'required' : '') + '>' + optionsHtml + '</select>' +
        '<div class="err">Please select an option.</div>' +
      '</div>'
    );
  }

  function onWelcomeSubmit(e) {
    e.preventDefault();
    var code = val("code"), name = val("name"), email = val("email"), age = val("age"), zip = val("zip"), phone = val("phone");
    var ok = true;
    ok = setValid("code", code.length >= 1) && ok;
    ok = setValid("name", name.length >= 1) && ok;
    ok = setValid("email", /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) && ok;
    ok = setValid("age", age !== "") && ok;
    ok = setValid("zip", zip.length >= 3) && ok;
    if (!ok) return;

    var btn = document.querySelector("#who button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Checking code…";

    fetch("/api/check-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code })
    }).then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (data) {
        if (!data || !data.ok) {
          setValid("code", false);
          document.querySelector("#f_code .err").textContent = (data && data.error) || "Invalid or already-used access code.";
          btn.disabled = false;
          btn.textContent = "Begin the Reading →";
          return;
        }
        state.person = { name: name, email: email, age: age, zip: zip, phone: phone, accessCode: code.toUpperCase() };
        state.answers = new Array(VPI.QUESTIONS.length).fill(null);
        state.index = 0;
        state.startTime = Date.now();
        renderQuestion();
      })
      .catch(function () {
        setValid("code", false);
        document.querySelector("#f_code .err").textContent = "Could not verify code — check your connection and try again.";
        btn.disabled = false;
        btn.textContent = "Begin the Reading →";
      });
  }
  function val(id) { return document.getElementById(id).value.trim(); }
  function setValid(id, good) {
    document.getElementById("f_" + id).classList.toggle("invalid", !good);
    return good;
  }

  /* ---------- Questions ---------- */
  function renderQuestion() {
    var i = state.index, total = VPI.QUESTIONS.length, current = state.answers[i];
    view.innerHTML = "";
    var pct = Math.round((i / total) * 100);
    var card = el(
      '<div class="card">' +
        '<div class="progress-top">' +
          '<div class="progress-meta"><span>Question ' + (i + 1) + ' of ' + total + '</span><span>' + pct + '% complete</span></div>' +
          '<div class="bar"><span style="width:' + pct + '%"></span></div>' +
        '</div>' +
        '<div class="q-number">STATEMENT ' + (i + 1) + '</div>' +
        '<div class="q-text">' + esc(VPI.QUESTIONS[i]) + '</div>' +
        '<div class="scale" id="scale"></div>' +
        '<div class="scale-legend"><span>Very strongly disagree</span><span>Very strongly agree</span></div>' +
        '<div class="btn-row">' +
          '<button class="btn ghost" id="back">&larr; Back</button>' +
          '<button class="btn" id="next" disabled>Next &rarr;</button>' +
        '</div>' +
      '</div>'
    );
    view.appendChild(card);

    var scale = document.getElementById("scale");
    VPI.SCALE.forEach(function (opt) {
      var b = el('<button data-v="' + opt.value + '"><span>' + opt.value + '</span><span class="tiny">' + esc(opt.label) + '</span></button>');
      if (current === opt.value) b.classList.add("selected");
      b.addEventListener("click", function () { choose(opt.value); });
      scale.appendChild(b);
    });

    document.getElementById("next").disabled = current == null;
    document.getElementById("back").addEventListener("click", goBack);
    document.getElementById("next").addEventListener("click", goNext);
    if (i === total - 1) document.getElementById("next").textContent = "See my result \u2192";
  }

  function choose(v) {
    state.answers[state.index] = v;
    document.querySelectorAll("#scale button").forEach(function (b) {
      b.classList.toggle("selected", Number(b.getAttribute("data-v")) === v);
    });
    document.getElementById("next").disabled = false;
    setTimeout(goNext, 180);
  }
  function goBack() {
    if (state.index === 0) { renderWelcome(); return; }
    state.index--; renderQuestion();
  }
  function goNext() {
    if (state.answers[state.index] == null) return;
    if (state.index < VPI.QUESTIONS.length - 1) { state.index++; renderQuestion(); }
    else finish();
  }
  document.addEventListener("keydown", function (e) {
    if (!document.getElementById("scale")) return;
    if (e.key >= "1" && e.key <= "7") choose(Number(e.key));
    else if (e.key === "ArrowLeft") goBack();
    else if (e.key === "ArrowRight" || e.key === "Enter") goNext();
  });

  /* ---------- Finish: submit to central DB ---------- */
  function finish() {
    var result = VPI.score(state.answers);
    var payload = {
      name: state.person.name, email: state.person.email,
      age: state.person.age, zip: state.person.zip, phone: state.person.phone, accessCode: state.person.accessCode,
      answers: state.answers, raw: result.raw, pct: result.pct, dominant: result.dominant,
      durationMs: state.startTime ? (Date.now() - state.startTime) : null
    };
    renderSubmitting();
    fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) throw new Error((data && data.error) || "Save failed");
        return data;
      });
    }).then(function (data) {
        var show = data && data.showResults;
        if (show === undefined) show = true; // fail open
        var balanced = !!(data && data.balancedScoring);
        if (show) renderResult(result, state.person, false, balanced);
        else renderThankYou(state.person);
      })
      .catch(function () {
        // Network failure or server error — still show the result so the taker
        // isn't stuck, but flag that it may not have been saved centrally.
        renderResult(result, state.person, true, false);
      });
  }

  function renderSubmitting() {
    view.innerHTML = "";
    view.appendChild(el(
      '<div class="card center"><h2>Scoring your answers…</h2>' +
      '<p class="lead">One moment.</p></div>'
    ));
  }

  function renderThankYou(person) {
    view.innerHTML = "";
    view.appendChild(el(
      '<div class="card center">' +
        '<span class="hero-badge">Thank you, ' + esc(person.name.split(" ")[0]) + '!</span>' +
        '<h2>Your responses have been recorded</h2>' +
        '<p class="lead">Your facilitator will review your results with you shortly.</p>' +
      '</div>'
    ));
  }

  function modeBar(mode, pct) {
    var a = VPI.ANALYSIS[mode];
    return (
      '<div class="modebar">' +
        '<div class="top"><span class="name">' + a.name + ' <small>(' + esc(a.quality) + ' &middot; ' + a.traditional + ')</small></span>' +
        '<span class="val" style="color:' + a.color + '">' + pct + '%</span></div>' +
        '<div class="track"><span style="width:' + pct + '%;background:' + a.color + '"></span></div>' +
      '</div>'
    );
  }
  function analysisBlock(mode) {
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

  function renderResult(result, person, offline, balanced) {
    var v = VPI.resultView(result, !!balanced);
    var a = VPI.ANALYSIS[v.dominant];
    view.innerHTML = "";
    var headline = v.tie
      ? '<p class="lead">Your qualities are <strong>evenly balanced</strong> &mdash; no single one stands out.</p>'
      : '<p class="lead">Your ' + (v.close ? "leading" : "dominant") + ' quality is <strong style="color:' + a.color + '">' +
        a.name + ' (' + a.traditional + ')</strong></p>';
    var card = el(
      '<div class="card">' +
        '<div class="center"><span class="hero-badge">Your Reading</span>' +
        '<h2>' + esc(person.name) + '</h2>' + headline + '</div>' +
        v.order.map(function (m) { return modeBar(m, v.pct[m]); }).join("") +
        '<div class="dominant-callout">' + esc(VPI.summaryLine(v)) + '</div>' +
        (balanced ? '<p class="muted" style="font-size:12px">Showing the <strong>balanced view</strong>, which adjusts for the fact that the Sattva statements are easier to agree with. The raw (unadjusted) scores are listed below.</p>' : '') +
        '<p class="muted" style="font-size:13px">Raw scores (each area 12&ndash;84): ' +
          esc(VPI.ANALYSIS.goodness.name) + ' ' + result.raw.goodness + ' (' + result.pct.goodness + '%) &middot; ' +
          esc(VPI.ANALYSIS.passion.name) + ' ' + result.raw.passion + ' (' + result.pct.passion + '%) &middot; ' +
          esc(VPI.ANALYSIS.ignorance.name) + ' ' + result.raw.ignorance + ' (' + result.pct.ignorance + '%)</p>' +
        (offline ? '<p class="muted" style="font-size:13px">(You appear to be offline — your result is shown here but may not have been saved centrally.)</p>' : '') +
        v.order.map(analysisBlock).join("") +
      '</div>'
    );
    view.appendChild(card);
    window.scrollTo(0, 0);
  }

  window.App = {
    start: function () {
      if (isWideLandscape()) renderLanding();
      else renderWelcome();
    }
  };
})();
