/* The Vedic Personality Index — questions, scoring map and offline analysis.
   Transcribed from the source document. */

window.VPI = (function () {
  // The 36 statements. Answered on a 1-7 agreement scale.
  var QUESTIONS = [
    "I prefer living in the countryside to living in the city.",
    "I get very upset when things don't work out the way I wanted.",
    "I'm willing to bend the rules to reach my goals.",
    "I have little interest in spiritual matters or inner growth.",
    "I get angry easily.",
    "Fruits and vegetables are among my favorite foods.",
    "I tend to lack strong follow-through and determination.",
    "I am self-disciplined.",
    "I take my responsibilities and commitments seriously.",
    "I often feel dissatisfied with my life.",
    "I often feel taken advantage of in my close relationships.",
    "I stay fairly steady through life's ups and downs.",
    "I often criticize or put other people down.",
    "I often feel down or discouraged.",
    "I'm good at using willpower to reach my goals.",
    "I often neglect my responsibilities to my family.",
    "Cleanliness and order are very important to me.",
    "Personal and spiritual growth is very important to me.",
    "My mood is easily swayed by life's highs and lows.",
    "I often complain or grumble.",
    "I often feel low or depressed.",
    "I tend to put off or delay my responsibilities.",
    "No matter what I achieve or acquire, I keep wanting more.",
    "I greatly admire people who are materially successful.",
    "When I speak, I make a real effort not to upset others.",
    "I often feel envious of other people.",
    "My work is a frequent source of stress and anxiety.",
    "I get very excited and elated when things go my way.",
    "I enjoy rich, strongly flavored foods.",
    "I'm often dissatisfied with where I am in life and pushing to change it.",
    "Owning nice things is very important to me.",
    "When things get hard, I tend to give up.",
    "I'm honest and straightforward in my dealings with others.",
    "Things that are truly good for me are often difficult at first but rewarding later.",
    "I often neglect my responsibilities to my friends.",
    "I'm at my best in the morning and like to make the most of it by rising early."
  ];

  // 1-based question numbers belonging to each mode (from the scoring table).
  var SCORING = {
    goodness:  [1, 6, 8, 9, 12, 15, 17, 18, 25, 33, 34, 36],
    passion:   [2, 3, 5, 13, 19, 20, 23, 24, 28, 29, 30, 31],
    ignorance: [4, 7, 10, 11, 14, 16, 21, 22, 26, 27, 32, 35]
  };

  var SCALE = [
    { value: 1, label: "Very strongly disagree" },
    { value: 2, label: "Strongly disagree" },
    { value: 3, label: "Somewhat disagree" },
    { value: 4, label: "Neutral" },
    { value: 5, label: "Somewhat agree" },
    { value: 6, label: "Strongly agree" },
    { value: 7, label: "Very strongly agree" }
  ];

  // Offline analysis content for each mode (guna).
  var ANALYSIS = {
    goodness: {
      name: "Clarity",
      sanskrit: "Sattva",
      traditional: "Goodness",
      color: "#4ade80",
      summary: "The quality of clarity, balance and harmony (traditionally called Goodness, or Sattva). It is associated with calm, knowledge, self-control, healthy living, compassion and a natural pull toward purpose and meaning.",
      traits: [
        "Calm, steady and content regardless of ups and downs",
        "Self-controlled, disciplined and reliable",
        "Values cleanliness, simplicity and healthy living",
        "Drawn to learning, reflection and personal growth",
        "Honest and straightforward with others"
      ],
      strengths: "You bring stability, clarity and trustworthiness. You can stay centered under pressure and tend to make thoughtful, principled decisions.",
      growth: "Guard against detachment that tips into passivity or complacency. Channel your steadiness into compassionate action, and keep sharing your calm with others rather than withdrawing.",
      lifestyle: "Early rising, fresh and light foods, regular study or meditation, and a clean, orderly environment all reinforce this quality."
    },
    passion: {
      name: "Drive",
      sanskrit: "Rajas",
      traditional: "Passion",
      color: "#f0975a",
      summary: "The quality of energy, ambition and activity (traditionally called Passion, or Rajas). It fuels desire, achievement and constant motion, but can also bring restlessness, attachment to results and anxiety.",
      traits: [
        "Driven, ambitious and hard-working",
        "Strong desire to acquire, achieve and improve your position",
        "Emotionally reactive — elated by wins, thrown by setbacks",
        "Admires success and values possessions",
        "Enjoys intensity, strong flavors and stimulation"
      ],
      strengths: "You have energy, initiative and the determination to get things done. You set goals, take action and push through obstacles.",
      growth: "Watch for burnout, anxiety and never feeling like it's 'enough.' Practice acting without over-attaching to outcomes, take rest seriously, and aim your drive at meaningful, lasting goals.",
      lifestyle: "Balance intense activity with stillness — breathing, walks in nature, lighter food and scheduled downtime help temper restlessness."
    },
    ignorance: {
      name: "Inertia",
      sanskrit: "Tamas",
      traditional: "Ignorance",
      color: "#9b8fc0",
      summary: "The quality of inertia, heaviness and low momentum (traditionally called Ignorance, or Tamas). It can show up as procrastination, discouragement, neglected duties and difficulty finding motivation.",
      traits: [
        "Tendency to delay or avoid responsibilities",
        "Periods of discontent, low mood or discouragement",
        "Weaker follow-through; may give up when things get hard",
        "Can feel disconnected from goals or from other people",
        "Drawn to comfort, rest and the familiar"
      ],
      strengths: "In balance, this quality brings the ability to rest, let go and recover. You can be easy-going and unhurried when it's time to slow down.",
      growth: "Build small, consistent routines to overcome inertia. Tackle one responsibility at a time, seek supportive company, get sunlight and movement, and celebrate small wins to rebuild momentum.",
      lifestyle: "Regular sleep and wake times, gentle exercise, fresh food, decluttering, and avoiding oversleep or heavy, stale food all help lift this quality."
    }
  };

  var MODES = ["goodness", "passion", "ignorance"];

  // Two qualities whose percentages are within this many points are treated as
  // "close" so the result is presented as a balance rather than a single winner.
  var CLOSE_THRESHOLD = 6;

  // Typical baseline pull toward each quality. The Clarity/Goodness statements are
  // socially desirable and easy to agree with, so on a plain sum almost everyone
  // scores highest there. The optional "balanced view" subtracts these baselines
  // and compares how far ABOVE or BELOW its own baseline each quality scored, which
  // lets Drive and Inertia surface when they are genuinely elevated. This does NOT
  // change the faithful raw scoring of the original instrument; it is a display aid.
  var CALIBRATION = { goodness: 60, passion: 48, ignorance: 40 };

  function pctOf(raw) {
    var total = raw.goodness + raw.passion + raw.ignorance || 1;
    var p = {};
    MODES.forEach(function (m) { p[m] = Math.round((raw[m] / total) * 1000) / 10; });
    return p;
  }

  function orderBy(pct) {
    return MODES.slice().sort(function (a, b) { return pct[b] - pct[a]; });
  }

  // A short narrative line for a result view (handles ties and near-ties).
  function summaryLine(viewObj) {
    var order = viewObj.order;
    var t = ANALYSIS[order[0]].name, s = ANALYSIS[order[1]].name;
    if (viewObj.tie) {
      return "Your three qualities are evenly balanced — no single one stands out. " +
        "Notice which one tends to take over when you're under stress.";
    }
    if (viewObj.close) {
      return "Your profile is fairly balanced between " + t + " and " + s +
        ". Both strongly shape how you think and act — notice which one tends to take over under stress.";
    }
    return t + " is your leading quality, with " + s +
      " as a strong secondary influence. The blend shapes your temperament day to day.";
  }

  // Backward-compatible helper: narrative from a percentage map alone.
  function dominantNote(pct) {
    var order = orderBy(pct);
    var gap = pct[order[0]] - pct[order[1]];
    return summaryLine({ order: order, tie: false, close: gap < CLOSE_THRESHOLD });
  }

  // Turn a raw score() result into a ready-to-render view. When `balanced` is true
  // the calibrated (baseline-adjusted) numbers and dominant are used instead.
  function resultView(result, balanced) {
    var pct = balanced ? result.calibrated.pct : result.pct;
    var dominant = balanced ? result.calibrated.dominant : result.dominant;
    var tie = balanced ? result.calibrated.tie : result.tie;
    var order = orderBy(pct);
    var gap = Math.round((pct[order[0]] - pct[order[1]]) * 10) / 10;
    return {
      balanced: !!balanced,
      pct: pct,
      order: order,
      dominant: dominant,
      tie: tie,
      close: !tie && gap < CLOSE_THRESHOLD,
      gap: gap
    };
  }

  return {
    QUESTIONS: QUESTIONS,
    SCORING: SCORING,
    SCALE: SCALE,
    ANALYSIS: ANALYSIS,
    MODES: MODES,
    CALIBRATION: CALIBRATION,
    CLOSE_THRESHOLD: CLOSE_THRESHOLD,
    dominantNote: dominantNote,
    summaryLine: summaryLine,
    resultView: resultView,

    // answers: array length 36, values 1-7 (index 0 == question 1)
    score: function (answers) {
      var raw = { goodness: 0, passion: 0, ignorance: 0 };
      MODES.forEach(function (mode) {
        SCORING[mode].forEach(function (qNum) {
          raw[mode] += Number(answers[qNum - 1]) || 0;
        });
      });
      var pct = pctOf(raw);

      // Faithful dominant (highest raw) + exact-tie detection.
      var maxRaw = Math.max(raw.goodness, raw.passion, raw.ignorance);
      var leaders = MODES.filter(function (m) { return raw[m] === maxRaw; });

      // Balanced view: each quality relative to its typical baseline.
      var calRaw = {};
      MODES.forEach(function (m) { calRaw[m] = raw[m] - CALIBRATION[m]; });
      var calMin = Math.min(calRaw.goodness, calRaw.passion, calRaw.ignorance);
      var shift = {}, shiftTotal = 0;
      MODES.forEach(function (m) { shift[m] = (calRaw[m] - calMin) + 1; shiftTotal += shift[m]; });
      var calPct = {};
      MODES.forEach(function (m) { calPct[m] = Math.round((shift[m] / shiftTotal) * 1000) / 10; });
      var calMax = Math.max(calRaw.goodness, calRaw.passion, calRaw.ignorance);
      var calLeaders = MODES.filter(function (m) { return calRaw[m] === calMax; });

      return {
        raw: raw,
        pct: pct,
        dominant: leaders[0],
        tie: leaders.length > 1,
        leaders: leaders,
        calibrated: {
          raw: calRaw,
          pct: calPct,
          dominant: calLeaders[0],
          tie: calLeaders.length > 1,
          leaders: calLeaders
        },
        maxPerMode: 84,
        minPerMode: 12
      };
    }
  };
})();
