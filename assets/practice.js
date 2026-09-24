/* CodePath admissions practice: builds each question card and checks answers in the browser.
   Answers never leave the page. Pages with Python questions download the Pyodide runtime once. */
(function () {
  "use strict";

  var CONFIG = window.PRACTICE || {};
  var ITEMS = CONFIG.items || {};
  var PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/";
  var STORE_KEY = "cp-practice:" + (CONFIG.page || location.pathname);
  var RUN_TIMEOUT_MS = 6000;
  var LOAD_TIMEOUT_MS = 90000;

  var state = {};
  var gradedIds = [];

  /* ---------- small helpers ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function make(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {}; } catch (e) { return {}; }
  }
  var store = loadStore();
  function saveStore() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* storage blocked: drafts just won't persist */ }
  }
  function remember(key, value) { store[key] = value; saveStore(); }

  function looseNorm(v) {
    return String(v).toLowerCase().replace(/\s+/g, "").replace(/^["']+|["']+$/g, "").replace(/\.$/, "");
  }
  function countWords(v) {
    var m = String(v).trim().match(/\S+/g);
    return m ? m.length : 0;
  }

  /* ---------- card shell shared by every type ---------- */
  function buildShell(id, item) {
    var card = make("section", "item");
    card.id = "item-" + id;
    var titleId = "item-" + id + "-title";
    card.setAttribute("aria-labelledby", titleId);
    var num = item.num != null ? '<span class="n">' + esc(item.num) + ".</span> " : "";
    var head = make("div", "item-head",
      '<h3 id="' + titleId + '">' + num + esc(item.title || "") + "</h3>" +
      (item.meta ? '<span class="meta">' + esc(item.meta) + "</span>" : ""));
    card.appendChild(head);
    if (item.body) card.appendChild(make("div", "item-body", item.body));
    return card;
  }
  function addTail(card, id) {
    var fb = make("div", "feedback");
    fb.setAttribute("aria-live", "polite");
    fb.id = "fb-" + id;
    var hints = make("ol", "hints");
    hints.id = "hints-" + id;
    var actions = make("div", "actions");
    actions.id = "actions-" + id;
    var slot = make("div", "answer-slot");
    slot.id = "slot-" + id;
    card.appendChild(fb);
    card.appendChild(hints);
    card.appendChild(actions);
    card.appendChild(slot);
  }
  function setFeedback(id, kind, html) {
    var fb = document.getElementById("fb-" + id);
    fb.className = "feedback " + kind;
    fb.innerHTML = html;
  }

  /* ---------- hints and reveal ---------- */
  function renderActions(id) {
    var s = state[id], item = ITEMS[id], box = document.getElementById("actions-" + id);
    if (!box) return;
    box.innerHTML = "";
    var hints = item.hints || [];
    if (s.solved || s.shown) return;
    if (s.hints < hints.length) {
      var more = make("button", "link-btn", s.hints === 0 ? "Get a hint" : "Show another hint");
      more.type = "button";
      more.addEventListener("click", function () { addHint(id); });
      box.appendChild(more);
    }
    if (s.hints > 0 || hints.length === 0 && s.tries > 0) {
      var ans = make("button", "link-btn", "Show the answer");
      ans.type = "button";
      ans.addEventListener("click", function () { reveal(id); });
      box.appendChild(ans);
    }
  }
  function addHint(id) {
    var s = state[id], hints = ITEMS[id].hints || [];
    if (s.hints >= hints.length) { renderActions(id); return; }
    var li = make("li", null, '<span class="hl">Hint ' + (s.hints + 1) + ":</span> " + hints[s.hints]);
    document.getElementById("hints-" + id).appendChild(li);
    s.hints += 1;
    renderActions(id);
  }
  function afterMiss(id) {
    var s = state[id];
    s.tries += 1;
    if (s.hints === 0 && (ITEMS[id].hints || []).length) addHint(id);
    else renderActions(id);
  }
  function reveal(id) {
    var s = state[id], item = ITEMS[id];
    s.shown = true;
    var slot = document.getElementById("slot-" + id);
    var html = "";
    if (item.type === "text") {
      html = "The " + (item.noun || "answer") + ' is <span class="ans">' + esc(item.accept[0]) + "</span>. " + (item.why || "");
    } else if (item.type === "choice") {
      var right = item.options.filter(function (o) { return o.correct; })[0];
      html = "The answer is: <strong>" + right.html + "</strong>. " + (item.why || "");
      var opts = document.querySelectorAll("#item-" + id + " .option");
      item.options.forEach(function (o, i) { if (o.correct && opts[i]) opts[i].classList.add("right"); });
    } else if (item.type === "python" || item.type === "javascript") {
      html = "Here is one working answer:<pre>" + esc(item.solution) + "</pre>" + (item.why || "");
    }
    slot.innerHTML = '<div class="reveal">' + html + "</div>";
    if (item.type === "python" || item.type === "javascript") {
      var use = make("button", "link-btn", "Put this answer in the editor");
      use.type = "button";
      use.addEventListener("click", function () {
        var ta = document.getElementById("code-" + id);
        ta.value = item.solution;
        remember("code-" + id, item.solution);
        ta.focus();
      });
      slot.querySelector(".reveal").appendChild(use);
    }
    renderActions(id);
    updateProgress();
  }
  function markSolved(id, html) {
    var s = state[id];
    s.solved = true;
    setFeedback(id, "ok", html);
    document.getElementById("slot-" + id).innerHTML = "";
    renderActions(id);
    updateProgress();
  }

  /* ---------- type: text answer ---------- */
  function buildText(id, item) {
    var card = buildShell(id, item);
    var row = make("div", "answer-row");
    var label = make("label", "sr", esc(item.title || "Answer"));
    label.setAttribute("for", "ans-" + id);
    var input = make("input", "answer");
    input.id = "ans-" + id;
    input.type = "text";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("autocapitalize", "off");
    input.placeholder = item.placeholder || "Type your answer";
    var btn = make("button", "btn", "Check");
    btn.type = "button";
    row.appendChild(label);
    row.appendChild(input);
    row.appendChild(btn);
    card.appendChild(row);
    addTail(card, id);

    function check() {
      var s = state[id];
      if (s.solved) return;
      var raw = input.value;
      if (!raw.trim()) { setFeedback(id, "warn", "Type an answer first, then press Check."); return; }
      if (typeof item.validate === "function") {
        var r = item.validate(raw) || {};
        if (r.ok) {
          input.disabled = true;
          btn.disabled = true;
          markSolved(id, "<strong>Correct!</strong> " + (r.msg || item.why || ""));
        } else {
          setFeedback(id, r.state || "bad", "<strong>Not yet.</strong> " + (r.msg || "That is not the answer. Try again."));
          afterMiss(id);
        }
        return;
      }
      var v = looseNorm(raw);
      var ok = item.accept.some(function (a) { return looseNorm(a) === v; });
      if (ok) {
        input.disabled = true;
        btn.disabled = true;
        markSolved(id, "<strong>Correct!</strong> " + (item.why || ""));
        return;
      }
      var target = looseNorm(item.accept[0]);
      var noun = item.noun || "answer";
      if (item.oneWord && /\s/.test(raw.trim())) {
        setFeedback(id, "warn", "<strong>Not yet.</strong> The " + noun + " is one word with no spaces.");
      } else if (item.lengthHint && v.length !== target.length) {
        setFeedback(id, "bad", "<strong>Not yet.</strong> Your answer has " + v.length + " letters. The " + noun + " has " + target.length + ".");
      } else if (item.lengthHint) {
        setFeedback(id, "bad", "<strong>Not yet.</strong> The length is right, but that is not the " + noun + ".");
      } else {
        var miss = (item.misses || []).filter(function (m) { return looseNorm(m.answer) === v; })[0];
        setFeedback(id, "bad", "<strong>Not yet.</strong> " + (miss ? miss.feedback : "That is not the answer. Try again."));
      }
      afterMiss(id);
    }
    btn.addEventListener("click", check);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") check(); });
    return card;
  }

  /* ---------- type: multiple choice ---------- */
  function buildChoice(id, item) {
    var card = buildShell(id, item);
    var fs = make("fieldset", "options");
    var legend = make("legend", "sr", esc(item.title || "Choose one answer"));
    fs.appendChild(legend);
    item.options.forEach(function (o, i) {
      var lab = make("label", "option");
      var r = make("input");
      r.type = "radio";
      r.name = "opt-" + id;
      r.value = String(i);
      r.id = "opt-" + id + "-" + i;
      lab.appendChild(r);
      lab.appendChild(make("span", null, o.html));
      r.addEventListener("change", function () {
        fs.querySelectorAll(".option").forEach(function (x) { x.classList.remove("picked"); });
        lab.classList.add("picked");
      });
      fs.appendChild(lab);
    });
    card.appendChild(fs);
    var row = make("div", "row");
    var btn = make("button", "btn", "Check");
    btn.type = "button";
    row.appendChild(btn);
    card.appendChild(row);
    addTail(card, id);

    btn.addEventListener("click", function () {
      var s = state[id];
      if (s.solved) return;
      var picked = fs.querySelector("input:checked");
      if (!picked) { setFeedback(id, "warn", "Choose an answer first, then press Check."); return; }
      var o = item.options[+picked.value];
      if (o.correct) {
        fs.disabled = true;
        btn.disabled = true;
        picked.closest(".option").classList.add("right");
        markSolved(id, "<strong>Correct!</strong> " + (item.why || ""));
      } else {
        setFeedback(id, "bad", "<strong>Not yet.</strong> " + (o.feedback || "That is not the best answer. Try again."));
        afterMiss(id);
      }
    });
    return card;
  }

  /* ---------- type: Python coding question ---------- */
  var PY_RUNNER = [
    "import json, io, sys",
    "_tests = json.loads(TESTS_JSON)",
    "_res = {'error': None, 'results': []}",
    "_ns = {'__name__': '__main__'}",
    "_old = sys.stdout",
    "sys.stdout = io.StringIO()",
    "try:",
    "    exec(USER_CODE, _ns)",
    "except BaseException as _e:",
    "    _res['error'] = type(_e).__name__ + ': ' + str(_e)",
    "finally:",
    "    sys.stdout = _old",
    "if _res['error'] is None:",
    "    for _t in _tests:",
    "        _r = {'label': _t.get('label') or _t.get('expr') or _t.get('run', ''), 'ok': False}",
    "        _out = io.StringIO()",
    "        sys.stdout = _out",
    "        try:",
    "            if 'expr' in _t:",
    "                _want = eval(_t['expect'], {})",
    "                _r['want'] = repr(_want)",
    "                _got = eval(_t['expr'], _ns)",
    "                _r['ok'] = (_got == _want) and (type(_got) is bool) == (type(_want) is bool)",
    "                _r['got'] = repr(_got)",
    "            else:",
    "                _w = _t['stdout'].strip()",
    "                _r['want'] = _w",
    "                exec(_t['run'], _ns)",
    "                _g = _out.getvalue().strip()",
    "                _r['ok'] = _g == _w",
    "                _r['got'] = _g if _g else '(nothing printed)'",
    "        except BaseException as _e:",
    "            _r['got'] = type(_e).__name__ + ': ' + str(_e)",
    "        finally:",
    "            sys.stdout = _old",
    "        _res['results'].append(_r)",
    "json.dumps(_res)"
  ].join("\n");

  var WORKER_SRC =
    'self.importScripts("' + PYODIDE_URL + 'pyodide.js");\n' +
    'var ready = loadPyodide({ indexURL: "' + PYODIDE_URL + '" });\n' +
    "var RUNNER = " + JSON.stringify(PY_RUNNER) + ";\n" +
    "self.onmessage = function (e) {\n" +
    "  ready.then(function (py) {\n" +
    '    if (e.data.type === "warm") { self.postMessage({ type: "ready" }); return; }\n' +
    "    try {\n" +
    '      py.globals.set("USER_CODE", e.data.code);\n' +
    '      py.globals.set("TESTS_JSON", e.data.tests);\n' +
    "      var out = py.runPython(RUNNER);\n" +
    '      self.postMessage({ type: "result", result: out });\n' +
    "    } catch (err) {\n" +
    '      self.postMessage({ type: "result", error: String(err) });\n' +
    "    }\n" +
    "  }, function (err) {\n" +
    '    self.postMessage({ type: "load-error", message: String(err) });\n' +
    "  });\n" +
    "};\n";

  var py = { worker: null, ready: null, busy: false };
  function getWorker() {
    if (py.ready) return py.ready;
    py.ready = new Promise(function (resolve, reject) {
      var w;
      try {
        w = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" })));
      } catch (err) { reject(err); return; }
      var t = setTimeout(function () { w.terminate(); reject(new Error("load timeout")); }, LOAD_TIMEOUT_MS);
      w.onmessage = function (e) {
        if (e.data.type === "ready") { clearTimeout(t); py.worker = w; resolve(w); }
        else if (e.data.type === "load-error") { clearTimeout(t); w.terminate(); reject(new Error(e.data.message)); }
      };
      w.onerror = function () { clearTimeout(t); w.terminate(); reject(new Error("worker error")); };
      w.postMessage({ type: "warm" });
    });
    py.ready.catch(function () { py.ready = null; py.worker = null; });
    return py.ready;
  }
  function runPython(code, tests) {
    return getWorker().then(function (w) {
      return new Promise(function (resolve) {
        var t = setTimeout(function () {
          w.terminate();
          py.worker = null;
          py.ready = null;
          resolve({ timeout: true });
        }, RUN_TIMEOUT_MS);
        w.onmessage = function (e) {
          if (e.data.type !== "result") return;
          clearTimeout(t);
          if (e.data.error) { resolve({ fatal: e.data.error }); return; }
          try { resolve(JSON.parse(e.data.result)); } catch (err) { resolve({ fatal: String(err) }); }
        };
        w.postMessage({ type: "run", code: code, tests: JSON.stringify(tests) });
      });
    });
  }

  var JS_WORKER_SRC = [
    "function same(a, b) {",
    "  if (a === b) return true;",
    "  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;",
    "  if (Array.isArray(a) !== Array.isArray(b)) return false;",
    "  var ka = Object.keys(a), kb = Object.keys(b);",
    "  if (ka.length !== kb.length) return false;",
    "  return ka.every(function (k) { return Object.prototype.hasOwnProperty.call(b, k) && same(a[k], b[k]); });",
    "}",
    "function show(v) {",
    "  if (v === undefined) return 'undefined';",
    "  if (typeof v === 'function') return 'a function';",
    "  try { return JSON.stringify(v); } catch (e) { return String(v); }",
    "}",
    "self.onmessage = function (e) {",
    "  var d = e.data, res = { error: null, results: [] }, thunks;",
    "  var quiet = { log: function () {}, info: function () {}, warn: function () {}, error: function () {} };",
    "  try {",
    "    var NL = String.fromCharCode(10);",
    "    var body = d.setup + NL + d.code + NL + ';return [' + d.tests.map(function (t) { return 'function () { return (' + t.expr + '); }'; }).join(',') + '];';",
    "    thunks = new Function('console', body)(quiet);",
    "  } catch (err) {",
    "    res.error = (err && err.name ? err.name + ': ' : '') + (err && err.message ? err.message : String(err));",
    "    self.postMessage(res);",
    "    return;",
    "  }",
    "  d.tests.forEach(function (t, i) {",
    "    var r = { label: t.label || t.expr, ok: false, want: show(t.expect) };",
    "    try {",
    "      var got = thunks[i]();",
    "      r.ok = same(got, t.expect);",
    "      r.got = show(got);",
    "    } catch (err) {",
    "      r.got = (err && err.name ? err.name + ': ' : '') + (err && err.message ? err.message : String(err));",
    "    }",
    "    res.results.push(r);",
    "  });",
    "  self.postMessage(res);",
    "};"
  ].join("\n");

  function runJs(code, item) {
    return new Promise(function (resolve) {
      var w;
      try {
        w = new Worker(URL.createObjectURL(new Blob([JS_WORKER_SRC], { type: "text/javascript" })));
      } catch (err) { resolve({ fatal: String(err) }); return; }
      var t = setTimeout(function () { w.terminate(); resolve({ timeout: true }); }, RUN_TIMEOUT_MS);
      w.onmessage = function (e) { clearTimeout(t); w.terminate(); resolve(e.data); };
      w.onerror = function (e) { clearTimeout(t); w.terminate(); e.preventDefault(); resolve({ error: e.message || "Error" }); };
      w.postMessage({ setup: item.setup || "", code: code, tests: item.tests });
    });
  }

  function buildPython(id, item) {
    var card = buildShell(id, item);
    var label = make("label", "sr", "Your code for " + esc(item.title || "this question"));
    label.setAttribute("for", "code-" + id);
    var ta = make("textarea", "code");
    ta.id = "code-" + id;
    ta.spellcheck = false;
    ta.setAttribute("autocapitalize", "off");
    ta.setAttribute("autocomplete", "off");
    var starter = item.starter || "";
    ta.value = store["code-" + id] != null ? store["code-" + id] : starter;
    ta.rows = Math.max(6, starter.split("\n").length + 3);
    var escPressed = false;
    ta.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { escPressed = true; return; }
      if (e.key === "Tab" && !e.shiftKey && !escPressed) {
        e.preventDefault();
        var s = ta.selectionStart, en = ta.selectionEnd;
        ta.value = ta.value.slice(0, s) + "    " + ta.value.slice(en);
        ta.selectionStart = ta.selectionEnd = s + 4;
      }
      escPressed = false;
    });
    ta.addEventListener("input", function () { remember("code-" + id, ta.value); });
    if (item.type === "python") ta.addEventListener("focus", function () { getWorker().catch(function () {}); }, { once: true });
    card.appendChild(label);
    card.appendChild(ta);

    var row = make("div", "row");
    var btn = make("button", "btn", "Run and check");
    btn.type = "button";
    var reset = make("button", "link-btn", "Start over");
    reset.type = "button";
    var note = make("span", "count", "Press Esc, then Tab, to leave the code box.");
    row.appendChild(btn);
    row.appendChild(reset);
    row.appendChild(note);
    card.appendChild(row);
    addTail(card, id);

    reset.addEventListener("click", function () {
      ta.value = starter;
      remember("code-" + id, starter);
      ta.focus();
    });

    btn.addEventListener("click", function () {
      var s = state[id];
      if (s.solved || py.busy) return;
      py.busy = true;
      btn.disabled = true;
      var isJs = item.type === "javascript";
      var loadingNote = isJs || py.worker ? "Checking your code…" : "Loading the Python checker. The first time can take a few seconds…";
      setFeedback(id, "warn", loadingNote);
      (isJs ? runJs(ta.value, item) : runPython(ta.value, item.tests)).then(function (res) {
        if (res.timeout) {
          setFeedback(id, "bad", "<strong>Your code ran for too long.</strong> Check for a loop that never ends.");
          afterMiss(id);
          return;
        }
        if (res.fatal) {
          setFeedback(id, "bad", "<strong>The checker had a problem.</strong> Try again. If it keeps happening, refresh the page.");
          return;
        }
        if (res.error) {
          setFeedback(id, "bad", "<strong>Your code has an error, so the tests could not run.</strong><pre>" + esc(res.error) + "</pre>");
          afterMiss(id);
          return;
        }
        var total = res.results.length;
        var passed = res.results.filter(function (r) { return r.ok; }).length;
        if (passed === total) {
          ta.disabled = true;
          btn.disabled = true;
          reset.disabled = true;
          markSolved(id, "<strong>All " + total + " tests passed!</strong> " + (item.why || ""));
          return;
        }
        var fails = res.results.filter(function (r) { return !r.ok; }).slice(0, 3).map(function (r) {
          return "<li><code>" + esc(r.label) + "</code> should give <code>" + esc(r.want) + "</code>, but your code gave <code>" + esc(r.got) + "</code></li>";
        }).join("");
        setFeedback(id, "bad", "<strong>" + passed + " of " + total + " tests passed.</strong><ul>" + fails + "</ul>");
        afterMiss(id);
      }, function () {
        setFeedback(id, "bad", "<strong>The Python checker could not load.</strong> Check your internet connection, then refresh the page.");
      }).then(function () {
        py.busy = false;
        if (!state[id].solved) btn.disabled = false;
      });
    });
    return card;
  }

  /* ---------- type: short writing (checks length only) ---------- */
  function buildWriting(id, item) {
    var card = buildShell(id, item);
    var min = item.minWords || 30;
    var label = make("label", "sr", esc(item.title || "Your answer"));
    label.setAttribute("for", "write-" + id);
    var ta = make("textarea");
    ta.id = "write-" + id;
    ta.rows = item.rows || 5;
    ta.placeholder = item.placeholder || "Write your answer here.";
    ta.value = store["write-" + id] || "";
    card.appendChild(label);
    card.appendChild(ta);
    var row = make("div", "row");
    var btn = make("button", "btn", "Check");
    btn.type = "button";
    var count = make("span", "count");
    count.setAttribute("aria-live", "polite");
    row.appendChild(btn);
    row.appendChild(count);
    card.appendChild(row);
    addTail(card, id);

    function unsolve() {
      if (state[id].solved) { state[id].solved = false; updateProgress(); }
    }
    function showCount() {
      var n = countWords(ta.value);
      count.textContent = n + " / " + min + " words";
    }
    showCount();
    ta.addEventListener("input", function () { showCount(); remember("write-" + id, ta.value); });
    btn.addEventListener("click", function () {
      var n = countWords(ta.value);
      if (n >= min) {
        markSolved(id, "<strong>Done.</strong> " + (item.why || "There is no single right answer here. The goal is to think about your plan and write it in your own words."));
      } else if (n === 0) {
        unsolve();
        setFeedback(id, "warn", "Write your answer first, then press Check.");
      } else {
        unsolve();
        setFeedback(id, "warn", "<strong>Keep going.</strong> Add " + (min - n) + " more word" + (min - n === 1 ? "" : "s") + ". You need at least " + min + ".");
      }
    });
    if (countWords(ta.value) >= min) {
      state[id].solved = true;
      var fb0 = card.querySelector(".feedback");
      fb0.className = "feedback ok";
      fb0.innerHTML = "<strong>Done.</strong> Your saved answer is here. You can keep editing it.";
    }
    return card;
  }

  /* ---------- type: checklist (not graded) ---------- */
  function buildChecklist(id, item) {
    var card = buildShell(id, item);
    var ul = make("ul", "checklist");
    (item.steps || []).forEach(function (step, i) {
      var li = make("li");
      var lab = make("label");
      var cb = make("input");
      cb.type = "checkbox";
      cb.id = "chk-" + id + "-" + i;
      cb.checked = !!store["chk-" + id + "-" + i];
      cb.addEventListener("change", function () { remember("chk-" + id + "-" + i, cb.checked); });
      lab.appendChild(cb);
      lab.appendChild(make("span", null, step));
      li.appendChild(lab);
      ul.appendChild(li);
    });
    card.appendChild(ul);
    if (item.after) card.appendChild(make("div", "item-body", item.after));
    return card;
  }

  /* ---------- progress ---------- */
  function updateProgress() {
    var solved = 0, shown = 0;
    gradedIds.forEach(function (id) {
      if (state[id].solved) solved += 1;
      else if (state[id].shown) shown += 1;
    });
    var total = gradedIds.length;
    document.querySelectorAll("[data-progress]").forEach(function (p) {
      var ok = p.querySelector(".fill-ok"), sh = p.querySelector(".fill-shown"), txt = p.querySelector(".ptext");
      if (!ok) return;
      ok.style.width = total ? (100 * solved / total) + "%" : "0";
      sh.style.width = total ? (100 * shown / total) + "%" : "0";
      txt.textContent = solved + " of " + total + " " + (CONFIG.progressWord || "solved");
    });
    var done = document.querySelector("[data-done]");
    if (done) done.hidden = total === 0 || solved + shown < total;
  }

  /* ---------- boot ---------- */
  var BUILDERS = { text: buildText, choice: buildChoice, python: buildPython, javascript: buildPython, writing: buildWriting, checklist: buildChecklist };

  document.querySelectorAll("[data-item]").forEach(function (mount) {
    var id = mount.getAttribute("data-item");
    var item = ITEMS[id];
    var build = item && BUILDERS[item.type];
    if (!build) { mount.textContent = "Missing question: " + id; return; }
    state[id] = { hints: 0, tries: 0, solved: false, shown: false };
    if (item.type !== "checklist") gradedIds.push(id);
    mount.replaceWith(build(id, item));
    renderActions(id);
  });

  document.querySelectorAll("[data-progress]").forEach(function (p) {
    p.className = "progress";
    p.setAttribute("aria-live", "polite");
    p.innerHTML = '<div class="bar" aria-hidden="true"><span class="fill-ok"></span><span class="fill-shown"></span></div><span class="ptext"></span>';
  });
  updateProgress();
})();
