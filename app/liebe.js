/* „Ich liebe dich sooooo…“ (18.11.2026): Pop-up für Ida beim nächsten App-Start (einmal pro Gerät, bis sie auf ✕ drückt).
   Die o's laufen endlos durch; nach 2 s erscheint darunter der zweite Satz. Wartet, falls gerade die Blumen-Überraschung (#bl-ov) läuft. */
(function () {
  const ID = 'liebe-1';
  const me = () => (window.WIR_PB && (WIR_PB.authStore.record || WIR_PB.authStore.model)) || null;
  const isDaniel = () => { const u = me(); return !!u && (/daniel/i.test(u.name || '') || /^daniel/i.test(u.email || '')); };
  const isIda = () => !!me() && !isDaniel();
  const key = () => 'wir-' + ID + '-' + (me() ? me().id : '');
  const seen = () => { try { return !!localStorage.getItem(key()); } catch (e) { return false; } };
  const mark = () => { try { localStorage.setItem(key(), '1'); } catch (e) {} };

  const CSS = `
#lv-ov{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;padding:max(16px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));
  background:rgba(0,0,0,.38);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:lvIn .35s ease both}
#lv-ov .lv-card{position:relative;width:min(440px,100%);padding:44px 22px 30px;border-radius:30px;text-align:center;
  background:var(--card,var(--glass-strong));border:1px solid var(--card-line,var(--glass-border));box-shadow:0 18px 50px rgba(0,0,0,.25);
  backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);animation:lvPop .5s cubic-bezier(.3,1.4,.5,1) both}
#lv-ov .lv-x{position:absolute;top:12px;right:12px;width:40px;height:40px;border-radius:50%;border:0;background:var(--chip,rgba(127,127,127,.18));color:var(--ink);font-size:20px;line-height:40px;cursor:pointer}
#lv-ov .lv-l1{font-family:'Caveat',cursive;font-size:46px;line-height:1.05;color:var(--ink)}
#lv-ov .lv-l2{display:flex;align-items:baseline;font-family:'Caveat',cursive;font-size:46px;line-height:1.2;color:var(--accent,var(--ink));margin-top:2px}
#lv-ov .lv-o{flex:1;overflow:hidden;white-space:nowrap;text-align:left;max-width:0;animation:lvGrow 2.2s ease-out forwards;
  -webkit-mask-image:linear-gradient(90deg,#000 85%,transparent);mask-image:linear-gradient(90deg,#000 85%,transparent)}
#lv-ov .lv-o span{display:inline-block;animation:lvRun 1.6s linear infinite}
#lv-ov .lv-msg{margin-top:20px;font-size:17px;font-weight:600;line-height:1.45;color:var(--ink-soft,var(--ink));opacity:0;transform:translateY(8px);transition:opacity .6s,transform .6s}
#lv-ov .lv-msg.on{opacity:1;transform:none}
@keyframes lvIn{from{opacity:0}}
@keyframes lvPop{from{opacity:0;transform:scale(.85)}}
@keyframes lvGrow{to{max-width:100%}}
@keyframes lvRun{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@media (prefers-reduced-motion:reduce){#lv-ov .lv-o span{animation-duration:4s}}`;

  function open() {
    if (document.getElementById('lv-ov') || !isIda() || seen()) return;
    if (!document.getElementById('lv-css')) { const st = document.createElement('style'); st.id = 'lv-css'; st.textContent = CSS; document.head.append(st); }
    const o = 'o'.repeat(60);
    const ov = document.createElement('div');
    ov.id = 'lv-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Ich liebe dich');
    ov.innerHTML = `<div class="lv-card"><button class="lv-x" type="button" aria-label="Schließen">✕</button>
      <div class="lv-l1">Ich liebe dich</div>
      <div class="lv-l2"><span>s</span><span class="lv-o"><span>${o}${o}</span></span><span>…</span></div>
      <div class="lv-msg">Meine Liebe für dich endet nicht, also kannst du lange warten 👀</div></div>`;
    document.body.append(ov);
    const t = setTimeout(() => ov.querySelector('.lv-msg').classList.add('on'), 2000);
    ov.querySelector('.lv-x').onclick = () => { clearTimeout(t); mark(); ov.remove(); };
  }
  // erst wenn die Blumen-Überraschung nicht (mehr) offen ist
  function whenFree() { if (document.getElementById('bl-ov')) setTimeout(whenFree, 1000); else open(); }
  document.addEventListener('wir:started', () => { if (isIda() && !seen()) setTimeout(whenFree, 1200); });
})();
