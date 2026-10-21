/*
 * Sofía & Rohan — wedding guest assistant widget.
 * Add to any page with:
 *   <script src="https://YOUR-APP.vercel.app/widget.js" defer></script>
 * Optional attributes on the script tag:
 *   data-accent="#8c1c2c"   main colour
 *   data-lang="auto|es|en"  interface language (default: auto from the browser)
 *   data-open="true"        open the chat on load (used by the demo page)
 */
(function () {
  if (window.__srWeddingWidget) return;
  window.__srWeddingWidget = true;

  var script = document.currentScript;
  var base = script ? new URL(script.src, location.href).origin : location.origin;
  var API = (script && script.dataset.api) || base + "/api/chat";
  var ACCENT = (script && script.dataset.accent) || "#8c1c2c";
  var LANG_SETTING = (script && script.dataset.lang) || "auto";
  var START_OPEN = script && script.dataset.open === "true";
  var STORE_KEY = "sr-wedding-chat-v1";

  var browserLang = (navigator.language || "en").toLowerCase();
  var lang = LANG_SETTING === "auto" ? (browserLang.indexOf("es") === 0 ? "es" : "en") : LANG_SETTING;

  var T = {
    es: {
      launcher: "¿Dudas del viaje?",
      title: "Asistente de la boda",
      subtitle: "Sofía & Rohan · Nueva Delhi · 14 nov 2026",
      welcome: "¡Hola! Soy el asistente de Sofía y Rohan. Pregúntame lo que quieras sobre la celebración en Delhi: horarios, qué ponerte, hoteles, visa o el viaje a India. 🇮🇳🇲🇽",
      placeholder: "Escribe tu pregunta…",
      send: "Enviar",
      close: "Cerrar",
      reset: "Nueva conversación",
      thinking: "Escribiendo…",
      searching: "Buscando información…",
      sources: "Fuentes",
      note: "Asistente con IA, puede equivocarse. Dudas importantes: wedding planner, WhatsApp +91 92895 03085. Guardamos las preguntas para mejorar.",
      errBusy: "Hay muchas preguntas en este momento. Intenta de nuevo en un rato.",
      errGeneric: "No pude responder ahora. Intenta de nuevo, o escribe a la wedding planner por WhatsApp: +91 92895 03085.",
      imgWomen: "Ideas de outfits para mujer (de la wedding planner)",
      imgMen: "Outfits Indo-Western para hombre (de la wedding planner)",
      chips: ["¿Cuál es el itinerario?", "¿Qué me pongo?", "¿Qué visa necesito?", "¿Dónde me hospedo?", "¿Dónde compro ropa india?"]
    },
    en: {
      launcher: "Trip questions?",
      title: "Wedding assistant",
      subtitle: "Sofía & Rohan · New Delhi · 14 Nov 2026",
      welcome: "Hi! I'm Sofía and Rohan's assistant. Ask me anything about the celebration in Delhi: the schedule, what to wear, hotels, visas or travelling in India. 🇮🇳🇲🇽",
      placeholder: "Type your question…",
      send: "Send",
      close: "Close",
      reset: "New conversation",
      thinking: "Typing…",
      searching: "Looking that up…",
      sources: "Sources",
      note: "AI assistant, it can make mistakes. Important questions: wedding planner, WhatsApp +91 92895 03085. Questions are saved to improve answers.",
      errBusy: "Lots of questions right now. Please try again in a little while.",
      errGeneric: "I couldn't answer just now. Please try again, or message the wedding planner on WhatsApp: +91 92895 03085.",
      imgWomen: "Outfit ideas for women (from the wedding planner)",
      imgMen: "Indo-Western outfits for men (from the wedding planner)",
      chips: ["What's the schedule?", "What should I wear?", "Which visa do I need?", "Where should I stay?", "Where can I buy Indian outfits?"]
    }
  }[lang] || null;
  if (!T) return;

  var IMAGES = {
    "outfits-women": { src: base + "/images/outfits-women.jpg", alt: T.imgWomen },
    "outfits-men": { src: base + "/images/outfits-men.jpg", alt: T.imgMen }
  };

  // ---------------------------------------------------------------- state
  var history = [];
  try { history = JSON.parse(sessionStorage.getItem(STORE_KEY) || "[]") || []; } catch (e) { history = []; }
  function save() { try { sessionStorage.setItem(STORE_KEY, JSON.stringify(history.slice(-20))); } catch (e) {} }

  // ---------------------------------------------------------------- DOM
  var host = document.createElement("div");
  host.id = "sr-wedding-assistant";
  host.style.cssText = "position:fixed;z-index:2147483000;inset:auto 0 0 auto;";
  var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;

  var css = [
    ":host{all:initial}",
    "*{box-sizing:border-box}",
    ".w{--accent:" + ACCENT + ";--accent-ink:#fff;--marigold:#e8a33d;--bg:#fffdfb;--panel:#ffffff;--ink:#2a1f22;--muted:#6f6266;--line:#ece4e1;--bubble:#f6f0ee;font:15px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:var(--ink)}",
    ".launch{position:fixed;right:max(18px,env(safe-area-inset-right,0px));bottom:calc(18px + env(safe-area-inset-bottom,0px));display:flex;align-items:center;gap:10px;padding:12px 18px 12px 14px;border:0;border-radius:999px;background:var(--accent);color:var(--accent-ink);font-weight:600;font-size:15px;line-height:1;font-family:inherit;cursor:pointer;box-shadow:0 8px 24px rgba(60,10,20,.28)}",
    ".launch:hover{filter:brightness(1.08)}",
    ".launch:focus-visible,.x:focus-visible,.send:focus-visible,.chip:focus-visible,.reset:focus-visible{outline:3px solid var(--marigold);outline-offset:2px}",
    ".dot{width:26px;height:26px;border-radius:50%;background:var(--marigold);display:grid;place-items:center;font-size:14px}",
    ".panel{position:fixed;right:max(18px,env(safe-area-inset-right,0px));bottom:calc(18px + env(safe-area-inset-bottom,0px));width:380px;max-width:calc(100vw - 36px);height:min(640px,calc(100vh - 36px));display:flex;flex-direction:column;background:var(--panel);border-radius:18px;overflow:hidden;box-shadow:0 18px 50px rgba(40,10,15,.25);border:1px solid var(--line)}",
    ".head{position:relative;padding:16px 48px 14px 18px;background:var(--accent);color:var(--accent-ink)}",
    ".head::after{content:'';position:absolute;left:0;right:0;bottom:0;height:4px;background:repeating-linear-gradient(90deg,var(--marigold) 0 10px,transparent 10px 16px)}",
    ".title{font-weight:700;font-size:16px;letter-spacing:.01em}",
    ".sub{font-size:12.5px;opacity:.85;margin-top:2px}",
    ".x{position:absolute;top:10px;right:10px;width:32px;height:32px;border:0;border-radius:50%;background:rgba(255,255,255,.16);color:inherit;font-size:18px;cursor:pointer}",
    ".log{flex:1;overflow-y:auto;padding:16px 14px 8px;display:flex;flex-direction:column;gap:10px;background:var(--bg)}",
    ".msg{max-width:88%;padding:10px 13px;border-radius:14px;word-wrap:break-word;overflow-wrap:anywhere}",
    ".bot{align-self:flex-start;background:var(--bubble);border-bottom-left-radius:4px}",
    ".me{align-self:flex-end;background:var(--accent);color:var(--accent-ink);border-bottom-right-radius:4px}",
    ".msg p{margin:0 0 6px}.msg p:last-child{margin-bottom:0}",
    ".msg ul{margin:4px 0 6px;padding-left:18px}.msg li{margin:2px 0}",
    ".msg a{color:var(--accent);font-weight:600}.me a{color:inherit}",
    ".msg img{display:block;width:100%;border-radius:10px;margin:8px 0 2px;border:1px solid var(--line)}",
    ".cap{font-size:12px;color:var(--muted);margin-bottom:4px}",
    ".src{margin-top:8px;padding-top:6px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}",
    ".src a{display:block;color:var(--muted);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".typing{color:var(--muted);font-style:italic}",
    ".chips{display:flex;flex-wrap:wrap;gap:6px;padding:4px 14px 10px;background:var(--bg)}",
    ".chip{border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:999px;padding:6px 11px;font-size:13px;line-height:1.2;font-family:inherit;cursor:pointer}",
    ".chip:hover{border-color:var(--accent);color:var(--accent)}",
    "form{display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--line);background:var(--panel)}",
    "textarea{flex:1;resize:none;border:1px solid var(--line);border-radius:12px;padding:9px 11px;font-size:15px;line-height:1.4;font-family:inherit;color:var(--ink);background:#fff;max-height:110px;min-height:40px}",
    "textarea:focus{outline:2px solid var(--accent);outline-offset:-1px}",
    ".send{border:0;border-radius:12px;padding:0 14px;background:var(--accent);color:var(--accent-ink);font-weight:600;font-size:14px;line-height:1;font-family:inherit;cursor:pointer}",
    ".send:disabled{opacity:.5;cursor:default}",
    ".foot{display:flex;gap:8px;align-items:flex-start;padding:0 14px 10px;background:var(--panel);font-size:11px;line-height:1.4;color:var(--muted)}",
    ".reset{flex:none;border:0;background:none;padding:0;color:var(--muted);font-weight:600;font-size:11px;line-height:1.4;font-family:inherit;text-decoration:underline;cursor:pointer}",
    "[hidden]{display:none!important}",
    "@media (max-width:480px){.panel{right:0;bottom:0;width:100vw;max-width:100vw;height:100%;border-radius:0;border:0;padding-bottom:env(safe-area-inset-bottom,0px)}.head{padding-top:calc(16px + env(safe-area-inset-top,0px))}.x{top:calc(10px + env(safe-area-inset-top,0px))}}",
    "@media (prefers-reduced-motion:no-preference){.panel{animation:rise .18s ease-out}@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}}"
  ].join("\n");

  root.innerHTML =
    "<style>" + css + "</style>" +
    '<div class="w">' +
      '<button class="launch" type="button" aria-haspopup="dialog"><span class="dot" aria-hidden="true">✦</span><span></span></button>' +
      '<section class="panel" role="dialog" aria-label="" hidden>' +
        '<div class="head"><div class="title"></div><div class="sub"></div><button class="x" type="button">✕</button></div>' +
        '<div class="log" aria-live="polite"></div>' +
        '<div class="chips"></div>' +
        '<form><textarea rows="1" maxlength="800"></textarea><button class="send" type="submit"></button></form>' +
        '<div class="foot"><span class="note"></span><button class="reset" type="button"></button></div>' +
      "</section>" +
    "</div>";

  var $ = function (s) { return root.querySelector(s); };
  var launch = $(".launch"), panel = $(".panel"), log = $(".log"), chips = $(".chips");
  var form = $("form"), input = $("textarea"), sendBtn = $(".send");
  launch.lastChild.textContent = T.launcher;
  panel.setAttribute("aria-label", T.title);
  $(".title").textContent = T.title;
  $(".sub").textContent = T.subtitle;
  $(".x").setAttribute("aria-label", T.close);
  input.placeholder = T.placeholder;
  input.setAttribute("aria-label", T.placeholder);
  sendBtn.textContent = T.send;
  $(".note").textContent = T.note;
  $(".reset").textContent = T.reset;

  // ---------------------------------------------------------------- rendering
  function esc(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function inline(s) {
    s = esc(s);
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    s = s.replace(/(^|[\s(])(https:\/\/[^\s<)]+[^\s<).,;:!?])/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
    return s;
  }
  function renderText(text) {
    var html = "", list = false, shown = {};
    text.split(/\n/).forEach(function (raw) {
      var line = raw.trim();
      if (/\[\[(outfits-women|outfits-men)\]\]/.test(line)) {
        var keys = line.match(/outfits-(women|men)/g) || [];
        if (list) { html += "</ul>"; list = false; }
        keys.forEach(function (k) {
          if (shown[k] || !IMAGES[k]) return;
          shown[k] = true;
          html += '<a href="' + IMAGES[k].src + '" target="_blank" rel="noopener"><img src="' + IMAGES[k].src + '" alt="' + esc(IMAGES[k].alt) + '" loading="lazy"></a><div class="cap">' + esc(IMAGES[k].alt) + "</div>";
        });
        line = line.replace(/\[\[(outfits-women|outfits-men)\]\]/g, "").trim();
        if (!line) return;
      }
      if (/^[-*•]\s+/.test(line)) {
        if (!list) { html += "<ul>"; list = true; }
        html += "<li>" + inline(line.replace(/^[-*•]\s+/, "")) + "</li>";
      } else {
        if (list) { html += "</ul>"; list = false; }
        if (line) html += "<p>" + inline(line.replace(/^#+\s*/, "")) + "</p>";
      }
    });
    if (list) html += "</ul>";
    return html;
  }
  function addMessage(role, text, sources) {
    var div = document.createElement("div");
    div.className = "msg " + (role === "user" ? "me" : "bot");
    if (role === "user") div.textContent = text;
    else {
      div.innerHTML = renderText(text);
      if (sources && sources.length) {
        var s = '<div class="src">' + esc(T.sources) + ":";
        sources.forEach(function (x) {
          if (/^https:\/\//.test(x.url)) s += '<a href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer">' + esc(x.title || x.url) + "</a>";
        });
        div.innerHTML += s + "</div>";
      }
    }
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }
  function renderAll() {
    log.innerHTML = "";
    addMessage("assistant", T.welcome);
    history.forEach(function (m) { addMessage(m.role, m.content, m.sources); });
    chips.hidden = history.length > 0;
  }
  T.chips.forEach(function (c) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.textContent = c;
    b.addEventListener("click", function () { ask(c); });
    chips.appendChild(b);
  });

  // ---------------------------------------------------------------- talking to the server
  var busy = false;
  function ask(text) {
    text = (text || "").trim();
    if (!text || busy) return;
    busy = true; sendBtn.disabled = true; chips.hidden = true;
    history.push({ role: "user", content: text });
    save();
    addMessage("user", text);
    input.value = ""; autosize();
    var wait = addMessage("assistant", "");
    wait.innerHTML = '<span class="typing">' + esc(T.thinking) + "</span>";
    var slow = setTimeout(function () { wait.innerHTML = '<span class="typing">' + esc(T.searching) + "</span>"; }, 5000);

    var payload = history.map(function (m) { return { role: m.role, content: m.content }; });
    fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: payload }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, data: d }; }); })
      .then(function (res) {
        clearTimeout(slow); wait.remove();
        if (res.status === 200 && res.data.reply) {
          history.push({ role: "assistant", content: res.data.reply, sources: res.data.sources || [] });
          save();
          addMessage("assistant", res.data.reply, res.data.sources);
        } else {
          history.pop(); save();
          addMessage("assistant", res.status === 429 || res.status === 503 ? T.errBusy : T.errGeneric);
        }
      })
      .catch(function () {
        clearTimeout(slow); wait.remove();
        history.pop(); save();
        addMessage("assistant", T.errGeneric);
      })
      .then(function () { busy = false; sendBtn.disabled = false; input.focus(); });
  }

  function autosize() { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 110) + "px"; }
  input.addEventListener("input", autosize);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(input.value); }
  });
  form.addEventListener("submit", function (e) { e.preventDefault(); ask(input.value); });

  function open() { panel.hidden = false; launch.hidden = true; renderAll(); setTimeout(function () { input.focus(); }, 50); }
  function close() { panel.hidden = true; launch.hidden = false; launch.focus(); }
  launch.addEventListener("click", open);
  $(".x").addEventListener("click", close);
  root.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) close(); });
  $(".reset").addEventListener("click", function () { history = []; save(); renderAll(); input.focus(); });

  function mount() {
    document.body.appendChild(host);
    if (START_OPEN) open();
  }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
})();
