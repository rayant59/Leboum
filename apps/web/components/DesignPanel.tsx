"use client";

// Éditeur de design en direct : un panneau flottant par-dessus le vrai site.
// Chaque réglage s'applique immédiatement (brouillon, visible par toi seul) ;
// « Publier » l'envoie au serveur de jeu et tous les visiteurs le reçoivent.
//
// Le panneau a ses propres couleurs fixes (préfixe lbd-) pour rester lisible
// quel que soit le thème choisi.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  EMPTY_THEME,
  THEME_COLORS,
  THEME_CSS_MAX,
  THEME_FONT_ROLES,
  THEME_FONTS,
  THEME_PRESETS,
  contrastRatio,
  darken,
  sanitizeTheme,
  themeColor,
  type SiteTheme,
  type ThemeColorGroup,
  type ThemeFontRole,
} from "@subtitles-party/shared";
import { applyTheme, cachedPublished, designLogout, fetchPublished, loadDraft, publishTheme, saveDraft } from "@/lib/theme";

type Tab = "colors" | "fonts" | "css";
type Status = { kind: "ok" | "err" | "info"; text: string } | null;

const GROUPS: ThemeColorGroup[] = ["Fonds", "Textes", "Accents", "Reliefs des boutons"];
const OPEN_KEY = "lb:designOpen";

const CHECKS: { fg: string; bg: string; min: number; label: string }[] = [
  { fg: "text", bg: "ink-surface", min: 4.5, label: "Texte sur les cartes" },
  { fg: "text-muted", bg: "ink-surface", min: 4.5, label: "Texte secondaire sur les cartes" },
  { fg: "text", bg: "ink", min: 4.5, label: "Texte sur le fond" },
  { fg: "ink-deep", bg: "gold", min: 4.5, label: "Texte des boutons dorés" },
  { fg: "gold", bg: "ink", min: 3, label: "Doré sur le fond" },
];

const same = (a: SiteTheme, b: SiteTheme) => JSON.stringify(a) === JSON.stringify(b);
const defaultHex = (name: string) => THEME_COLORS.find((t) => t.name === name)?.hex ?? "#000000";

export function DesignPanel({ token }: { token: string }) {
  const [published, setPublished] = useState<SiteTheme>(() => cachedPublished());
  const [draft, setDraft] = useState<SiteTheme>(() => loadDraft() ?? cachedPublished());
  const [tab, setTab] = useState<Tab>("colors");
  const [open, setOpen] = useState(true);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Thème publié à jour ; sans brouillon en cours, on part de lui.
  useEffect(() => {
    try { setOpen(localStorage.getItem(OPEN_KEY) !== "0"); } catch { /* ignore */ }
    let alive = true;
    void fetchPublished().then((r) => {
      if (!alive) return;
      if (!r) { setStatus({ kind: "err", text: "Serveur de jeu injoignable : tu peux modifier, mais pas publier pour l'instant." }); return; }
      setPublished(r.theme);
      setUpdatedAt(r.updatedAt);
      if (!loadDraft()) setDraft(r.theme);
      else setStatus({ kind: "info", text: "Brouillon repris là où tu l'avais laissé." });
    });
    return () => { alive = false; };
  }, []);

  // Chaque changement s'applique tout de suite à la page.
  useEffect(() => {
    applyTheme(draft);
    saveDraft(same(draft, published) ? null : draft);
  }, [draft, published]);

  useEffect(() => {
    try { localStorage.setItem(OPEN_KEY, open ? "1" : "0"); } catch { /* ignore */ }
  }, [open]);

  const dirty = !same(draft, published);
  const failing = useMemo(
    () => CHECKS.map((c) => ({ ...c, ratio: contrastRatio(themeColor(draft, c.fg), themeColor(draft, c.bg)) })).filter((c) => c.ratio < c.min),
    [draft],
  );

  function setColor(name: string, hex: string) {
    setDraft((d) => {
      const colors = { ...d.colors };
      const put = (n: string, v: string) => {
        if (v.toUpperCase() === defaultHex(n).toUpperCase()) delete colors[n];
        else colors[n] = v.toUpperCase();
      };
      put(name, hex);
      // Le relief des boutons suit sa couleur (modifiable ensuite).
      for (const shade of THEME_COLORS.filter((t) => t.shadeOf === name)) {
        if (name in colors) put(shade.name, darken(hex, 0.3));
        else delete colors[shade.name];
      }
      return { ...d, colors };
    });
  }
  function resetColor(name: string) {
    setColor(name, defaultHex(name));
  }
  function setFont(role: ThemeFontRole, family: string) {
    setDraft((d) => {
      const fonts = { ...d.fonts };
      if (family) fonts[role] = family;
      else delete fonts[role];
      return { ...d, fonts };
    });
  }

  async function publish() {
    setBusy(true);
    setStatus(null);
    const r = await publishTheme(token, draft);
    setBusy(false);
    if (r.ok) {
      setPublished(draft);
      setUpdatedAt(Date.now());
      setStatus({ kind: "ok", text: "Publié ! Tout le monde voit le nouveau design (au plus tard dans une minute)." });
    } else {
      setStatus({ kind: "err", text: r.status === 403 ? `${r.error} Quitte l'éditeur et reconnecte-toi sur /design.` : r.error });
    }
  }

  function quit() {
    designLogout();
    applyTheme(published);
    window.dispatchEvent(new Event("lb:design-change"));
  }

  function exportTheme() {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "leboum-theme.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  async function importTheme(file: File) {
    try {
      const t = sanitizeTheme(JSON.parse(await file.text()));
      if (!t) throw new Error();
      setDraft(t);
      setStatus({ kind: "info", text: "Thème importé (pas encore publié)." });
    } catch {
      setStatus({ kind: "err", text: "Ce fichier n'est pas un thème LeBoum." });
    }
  }

  if (!open) {
    return (
      <>
        <style>{CSS}</style>
        <button type="button" className="lbd-fab" onClick={() => setOpen(true)} aria-label="Ouvrir l'éditeur de design">
          <PaletteIcon /> Design {dirty && <span className="lbd-dot" aria-label="modifications non publiées" />}
        </button>
      </>
    );
  }

  return (
    <aside className="lbd" aria-label="Éditeur de design">
      <style>{CSS}</style>
      <header className="lbd-head">
        <div>
          <strong>Éditeur de design</strong>
          <span className={dirty ? "lbd-chip lbd-chip-warn" : "lbd-chip"}>{dirty ? "Brouillon non publié" : "À jour"}</span>
        </div>
        <button type="button" className="lbd-icon" onClick={() => setOpen(false)} aria-label="Réduire" title="Réduire pour voir la page">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 12h12" /></svg>
        </button>
      </header>
      <p className="lbd-sub">Tout s'applique en direct sur cette page. Navigue sur le site pour voir chaque écran ; publie quand ça te plaît.</p>

      <nav className="lbd-tabs" role="tablist">
        {([["colors", "Couleurs"], ["fonts", "Polices"], ["css", "Avancé"]] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>

      <div className="lbd-body">
        {tab === "colors" && (
          <>
            <div className="lbd-presets">
              {THEME_PRESETS.map((p) => {
                const pt: SiteTheme = { ...EMPTY_THEME, colors: p.colors };
                return (
                  <button key={p.name} type="button" className="lbd-preset" onClick={() => setDraft((d) => ({ ...d, colors: { ...p.colors } }))} title={`Appliquer « ${p.name} »`}>
                    <span className="lbd-sw3">
                      {["ink", "gold", "magenta", "mint"].map((n) => <i key={n} style={{ background: themeColor(pt, n) }} />)}
                    </span>
                    {p.name}
                  </button>
                );
              })}
            </div>
            {failing.length > 0 && (
              <div className="lbd-warn" role="status">
                <b>Lisibilité à vérifier</b>
                {failing.map((f) => <span key={f.label}>{f.label} : contraste {f.ratio.toFixed(1)} (conseillé ≥ {f.min})</span>)}
              </div>
            )}
            {GROUPS.map((g) => (
              <section key={g} className="lbd-group">
                <h3>{g}</h3>
                {g === "Reliefs des boutons" && <p className="lbd-hint">Calculés tout seuls quand tu changes la couleur du bouton.</p>}
                {THEME_COLORS.filter((t) => t.group === g).map((t) => (
                  <ColorRow key={t.name} label={t.label} hint={t.hint} value={themeColor(draft, t.name)} changed={t.name in draft.colors} onChange={(v) => setColor(t.name, v)} onReset={() => resetColor(t.name)} />
                ))}
              </section>
            ))}
          </>
        )}

        {tab === "fonts" && (
          <>
            {THEME_FONT_ROLES.map((r) => (
              <label key={r.role} className="lbd-field">
                <span>{r.label}</span>
                <select value={draft.fonts[r.role] ?? ""} onChange={(e) => setFont(r.role, e.target.value)}>
                  <option value="">Origine</option>
                  {THEME_FONTS.map((f) => <option key={f.family} value={f.family}>{f.family}</option>)}
                </select>
                <em className="lbd-sample" style={{ fontFamily: `var(--font-${r.role}), ${r.fallback}` }}>
                  {r.role === "mono" ? "SALLE ABCD · 3-8 JOUEURS" : "Boum, la soirée commence !"}
                </em>
              </label>
            ))}
            <p className="lbd-hint">Les polices viennent de Google Fonts et se chargent automatiquement.</p>
          </>
        )}

        {tab === "css" && (
          <>
            <label className="lbd-field">
              <span>CSS libre</span>
              <textarea
                spellCheck={false}
                value={draft.css}
                maxLength={THEME_CSS_MAX}
                onChange={(e) => { const css = e.target.value; setDraft((d) => ({ ...d, css })); }}
                placeholder={".panel { border-radius: 8px; }\n.arc { border-radius: 999px; }\nh1 { letter-spacing: -0.04em; }"}
              />
            </label>
            <p className="lbd-hint">
              Pour tout le reste (arrondis, tailles, ombres, masquer un élément…). Appliqué en direct, après le style du site.
              Couleurs du thème utilisables : <code>rgb(var(--c-gold))</code>, <code>rgb(var(--c-ink-surface) / .5)</code>…
            </p>
            <div className="lbd-row">
              <button type="button" className="lbd-btn" onClick={exportTheme}>Exporter le thème</button>
              <button type="button" className="lbd-btn" onClick={() => fileRef.current?.click()}>Importer…</button>
              <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importTheme(f); e.target.value = ""; }} />
            </div>
            <div className="lbd-row">
              <button type="button" className={confirmReset ? "lbd-btn lbd-danger" : "lbd-btn"} onClick={() => {
                if (!confirmReset) { setConfirmReset(true); setTimeout(() => setConfirmReset(false), 4000); return; }
                setConfirmReset(false);
                setDraft(EMPTY_THEME);
                setStatus({ kind: "info", text: "Design d'origine remis en brouillon. Publie pour l'appliquer à tous." });
              }}>{confirmReset ? "Clique encore pour confirmer" : "Revenir au design d'origine"}</button>
            </div>
          </>
        )}
      </div>

      <footer className="lbd-foot">
        {status && <p className={`lbd-status lbd-${status.kind}`} role="status">{status.text}</p>}
        {!status && updatedAt && !dirty && <p className="lbd-status">Dernière publication : {new Date(updatedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</p>}
        <div className="lbd-row">
          <button type="button" className="lbd-btn" disabled={!dirty || busy} onClick={() => { setDraft(published); setStatus(null); }}>Annuler</button>
          <button type="button" className="lbd-btn lbd-primary" disabled={!dirty || busy} onClick={() => void publish()}>{busy ? "Publication…" : "Publier"}</button>
        </div>
        <button type="button" className="lbd-link" onClick={quit}>Quitter l'éditeur</button>
      </footer>
    </aside>
  );
}

function ColorRow({ label, hint, value, changed, onChange, onReset }: { label: string; hint?: string; value: string; changed: boolean; onChange: (v: string) => void; onReset: () => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div className="lbd-color" title={hint}>
      <input type="color" value={value.toLowerCase()} onChange={(e) => onChange(e.target.value)} aria-label={label} />
      <span className="lbd-clabel">{label}{hint && <small>{hint}</small>}</span>
      <input
        className="lbd-hex"
        value={text}
        spellCheck={false}
        maxLength={7}
        aria-label={`${label} (code hexadécimal)`}
        onChange={(e) => {
          const v = e.target.value.trim();
          setText(v);
          const hex = v.startsWith("#") ? v : `#${v}`;
          if (/^#[0-9a-fA-F]{6}$/.test(hex)) onChange(hex);
        }}
        onBlur={() => setText(value)}
      />
      <button type="button" className="lbd-icon" disabled={!changed} onClick={onReset} aria-label={`Remettre ${label} d'origine`} title="Couleur d'origine">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>
      </button>
    </div>
  );
}

function PaletteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4.1-4-7.4-9-7.4Z" />
      <circle cx="7.5" cy="11" r="1" /><circle cx="10" cy="7" r="1" /><circle cx="14.5" cy="7" r="1" />
    </svg>
  );
}

// Couleurs fixes, indépendantes du thème édité.
const CSS = `
.lbd,.lbd-fab{--bg:#121119;--bg2:#1B1A24;--line:#2E2C3A;--tx:#EEECF4;--mu:#A19EB0;--ac:#8FA8FF;--ok:#5BD69A;--er:#FF7A7A;--wa:#F5C26B;
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:13px;line-height:1.4;color:var(--tx);letter-spacing:0;text-transform:none}
.lbd{position:fixed;z-index:2147483000;top:12px;right:12px;bottom:12px;width:360px;display:flex;flex-direction:column;background:var(--bg);border:1px solid var(--line);border-radius:16px;box-shadow:0 24px 60px -20px rgba(0,0,0,.8);overflow:hidden}
.lbd *{box-sizing:border-box}
.lbd-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 12px 4px 16px}
.lbd-head strong{font-size:15px;margin-right:8px}
.lbd-chip{display:inline-block;padding:2px 8px;border-radius:999px;background:var(--bg2);color:var(--mu);font-size:11px;font-weight:600;vertical-align:1px}
.lbd-chip-warn{background:rgba(245,194,107,.15);color:var(--wa)}
.lbd-sub{margin:0;padding:0 16px 10px;color:var(--mu);font-size:12px}
.lbd-tabs{display:flex;gap:4px;padding:0 12px 8px;border-bottom:1px solid var(--line)}
.lbd-tabs button{flex:1;padding:8px;border:0;border-radius:9px;background:transparent;color:var(--mu);font:inherit;font-weight:600;cursor:pointer}
.lbd-tabs button.on{background:var(--bg2);color:var(--tx)}
.lbd-body{flex:1;overflow-y:auto;padding:12px 16px 16px;overscroll-behavior:contain}
.lbd-group h3{margin:16px 0 6px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--mu)}
.lbd-color{display:grid;grid-template-columns:34px 1fr 78px 28px;align-items:center;gap:8px;padding:5px 0}
.lbd-color input[type=color]{width:34px;height:34px;padding:0;border:1px solid var(--line);border-radius:9px;background:none;cursor:pointer}
.lbd-color input[type=color]::-webkit-color-swatch-wrapper{padding:3px}
.lbd-color input[type=color]::-webkit-color-swatch{border:0;border-radius:6px}
.lbd-color input[type=color]::-moz-color-swatch{border:0;border-radius:6px}
.lbd-clabel{min-width:0;font-weight:600}
.lbd-clabel small{display:block;font-weight:400;color:var(--mu);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lbd-hex{width:100%;padding:7px 8px;border:1px solid var(--line);border-radius:8px;background:var(--bg2);color:var(--tx);font:12px ui-monospace,Menlo,Consolas,monospace;text-transform:uppercase}
.lbd-icon{display:grid;place-items:center;width:28px;height:28px;border:0;border-radius:8px;background:transparent;color:var(--mu);cursor:pointer}
.lbd-icon:hover:not(:disabled){background:var(--bg2);color:var(--tx)}
.lbd-icon:disabled{opacity:.25;cursor:default}
.lbd-presets{display:flex;flex-wrap:wrap;gap:6px}
.lbd-preset{display:inline-flex;align-items:center;gap:7px;padding:6px 10px 6px 6px;border:1px solid var(--line);border-radius:999px;background:var(--bg2);color:var(--tx);font:inherit;font-size:12px;cursor:pointer}
.lbd-preset:hover{border-color:var(--ac)}
.lbd-sw3{display:inline-flex}
.lbd-sw3 i{width:12px;height:12px;border-radius:50%;margin-left:-3px;box-shadow:0 0 0 1.5px var(--bg2)}
.lbd-sw3 i:first-child{margin-left:0}
.lbd-warn{margin-top:12px;padding:10px 12px;border-radius:10px;background:rgba(245,194,107,.1);border:1px solid rgba(245,194,107,.3);color:var(--wa);display:flex;flex-direction:column;gap:3px;font-size:12px}
.lbd-hint{margin:6px 0 0;color:var(--mu);font-size:12px}
.lbd-hint code{font:11px ui-monospace,Menlo,Consolas,monospace;color:var(--tx)}
.lbd-field{display:flex;flex-direction:column;gap:6px;margin-bottom:16px}
.lbd-field>span{font-weight:600}
.lbd-field select,.lbd-field textarea{width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:9px;background:var(--bg2);color:var(--tx);font:inherit}
.lbd-field textarea{min-height:220px;resize:vertical;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;tab-size:2}
.lbd-sample{font-style:normal;font-size:18px;font-weight:700;color:var(--tx);padding:2px 2px 0}
.lbd-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.lbd-btn{flex:1;min-width:0;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg2);color:var(--tx);font:inherit;font-weight:600;cursor:pointer;white-space:nowrap}
.lbd-btn:hover:not(:disabled){border-color:var(--mu)}
.lbd-btn:disabled{opacity:.4;cursor:default}
.lbd-primary{background:var(--ac);border-color:var(--ac);color:#0B0D18}
.lbd-primary:hover:not(:disabled){filter:brightness(1.08);border-color:var(--ac)}
.lbd-danger{border-color:var(--er);color:var(--er)}
.lbd-foot{padding:10px 16px 12px;border-top:1px solid var(--line);background:var(--bg)}
.lbd-status{margin:0 0 4px;color:var(--mu);font-size:12px}
.lbd-ok{color:var(--ok)}.lbd-err{color:var(--er)}.lbd-info{color:var(--ac)}
.lbd-link{display:block;margin:10px auto 0;border:0;background:none;color:var(--mu);font:inherit;font-size:12px;text-decoration:underline;cursor:pointer}
.lbd-link:hover{color:var(--tx)}
.lbd :focus-visible,.lbd-fab:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
.lbd-fab{position:fixed;z-index:2147483000;right:16px;bottom:16px;display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border:1px solid var(--line);border-radius:999px;background:var(--bg);font-weight:700;cursor:pointer;box-shadow:0 12px 30px -10px rgba(0,0,0,.8)}
.lbd-dot{width:8px;height:8px;border-radius:50%;background:var(--wa)}
@media (max-width:640px){
  .lbd{top:auto;left:8px;right:8px;bottom:8px;width:auto;height:64dvh}
  .lbd-sub{display:none}
}
`;
