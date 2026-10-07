"use client";

// Onglet « Contenu » de l'éditeur : clique sur n'importe quel élément du site
// pour changer son texte, son lien, son image ou son style, le cacher, le
// déplacer à la souris, ou ajouter un texte / titre / bouton / image à côté.

import { useCallback, useEffect, useRef, useState } from "react";
import { editIsEmpty, newEditId, routeKey, type AddedKind, type EditStyle, type SiteEdit, type SiteTheme } from "@subtitles-party/shared";
import { applyNow, findTarget, fingerprint, isTooling, originalText, pathOf, setPreview, textNodesOf } from "@/lib/edits";

type Change = (fn: (d: SiteTheme) => SiteTheme, key?: string) => void;

const LABELS: Record<string, string> = {
  h1: "Titre", h2: "Titre", h3: "Sous-titre", h4: "Sous-titre", p: "Paragraphe", span: "Texte", b: "Texte en gras", strong: "Texte en gras",
  em: "Texte", a: "Lien", button: "Bouton", img: "Image", input: "Champ", label: "Étiquette", li: "Élément de liste", ul: "Liste",
  section: "Section", header: "En-tête", footer: "Pied de page", main: "Page", nav: "Menu", div: "Bloc", svg: "Icône", form: "Formulaire",
};
const ADDED_LABELS: Record<AddedKind, string> = { text: "Texte ajouté", title: "Titre ajouté", button: "Bouton ajouté", image: "Image ajoutée" };

function isUi(el: Element | null): boolean {
  return !el || !!el.closest(".lbd, .lbd-fab, .lbe-ui");
}

/** L'élément à sélectionner sous le pointeur (on remonte hors des icônes SVG). */
function pickable(t: EventTarget | null): Element | null {
  let el = t instanceof Element ? t : null;
  if (!el || isUi(el)) return null;
  const svg = el.closest("svg");
  if (svg) el = svg;
  if (el === document.body || el === document.documentElement) return null;
  return el;
}

function idsOf(el: Element): string[] {
  return (el.getAttribute("data-lbe") ?? "").split(" ").filter(Boolean);
}

export function ContentEditor({ draft, change }: { draft: SiteTheme; change: Change }) {
  const [picking, setPicking] = useState(true);
  const [moving, setMoving] = useState(false);
  const [selected, setSelected] = useState<Element | null>(null);
  const [, setTick] = useState(0);
  const hoverRef = useRef<Element | null>(null);
  const hoverBox = useRef<HTMLDivElement>(null);
  const selBox = useRef<HTMLDivElement>(null);
  const selLabel = useRef<HTMLSpanElement>(null);
  const pending = useRef(new WeakMap<Element, string>());
  const keys = useRef(new WeakMap<Element, number>());
  const movingRef = useRef(false);
  movingRef.current = moving;
  const selectedRef = useRef<Element | null>(null);
  selectedRef.current = selected;
  /** Un glisser vient de se terminer : on avale le clic qui suit. */
  const swallowClick = useRef(false);
  const keyOf = (el: Element) => {
    let k = keys.current.get(el);
    if (!k) { k = Math.random(); keys.current.set(el, k); }
    return k;
  };
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [route, setRoute] = useState(() => routeKey(window.location.pathname));

  // Page courante (navigation Next.js sans rechargement).
  useEffect(() => {
    const id = window.setInterval(() => {
      const r = routeKey(window.location.pathname);
      setRoute((old) => (old === r ? old : r));
    }, 400);
    return () => window.clearInterval(id);
  }, []);

  // ---- Retrouver / créer la modification d'un élément ----------------------
  const editOf = useCallback((el: Element): SiteEdit | null => {
    const d = draftRef.current;
    const ids = [...idsOf(el), pending.current.get(el)].filter(Boolean) as string[];
    const mine = d.edits.filter((e) => ids.includes(e.id));
    return mine.find((e) => e.route === routeKey(window.location.pathname)) ?? mine[0] ?? null;
  }, []);

  const update = useCallback((el: Element, fn: (e: SiteEdit) => SiteEdit, key?: string) => {
    change((d) => {
      let cur = editOf(el);
      if (!cur) {
        const path = pathOf(el);
        if (!path) return d;
        const id = newEditId();
        pending.current.set(el, id);
        cur = { id, route: routeKey(window.location.pathname), path, tag: el.tagName.toLowerCase(), fp: fingerprint(el) };
      }
      const next = fn(cur);
      const others = d.edits.filter((e) => e.id !== cur!.id);
      const keep = next.add || !editIsEmpty(next);
      const exists = d.edits.some((e) => e.id === cur!.id);
      const edits = keep ? (exists ? d.edits.map((e) => (e.id === cur!.id ? next : e)) : [...d.edits, next]) : others;
      return { ...d, edits };
    }, key ? `${key}:${editOf(el)?.id ?? "new"}` : undefined);
  }, [change, editOf]);

  const setStyle = useCallback((el: Element, patch: Partial<EditStyle>, key?: string) => {
    update(el, (e) => {
      const style: EditStyle = { ...(e.style ?? {}), ...patch };
      for (const k of Object.keys(style) as (keyof EditStyle)[]) if (style[k] === undefined || style[k] === false) delete style[k];
      return { ...e, style: Object.keys(style).length ? style : undefined };
    }, key);
  }, [update]);

  function addNear(el: Element, kind: AddedKind) {
    const base = el.classList.contains("lbe-added") ? editOf(el) : null;
    const path = base ? base.path : pathOf(el);
    if (!path) return;
    const anchorTag = base ? base.tag : el.tagName.toLowerCase();
    const fp = base ? base.fp : fingerprint(el);
    const id = newEditId();
    const e: SiteEdit = {
      id, route: base ? base.route : routeKey(window.location.pathname), path, tag: anchorTag, fp,
      add: { kind, where: base?.add?.where ?? "after" },
      ...(kind === "image" ? { src: "/games/bombe.webp", style: { radius: 16 } } : {}),
      ...(kind === "button" ? { href: "/" } : {}),
    };
    change((d) => ({ ...d, edits: [...d.edits, e] }));
    // Sélectionne le nouvel élément dès qu'il apparaît.
    requestAnimationFrame(() => {
      applyNow();
      const added = document.querySelector(`.lbe-added[data-lbe="${id}"]`);
      if (added) setSelected(added);
    });
  }

  function removeEdit(id: string) {
    change((d) => ({ ...d, edits: d.edits.filter((e) => e.id !== id) }));
  }

  // ---- Sélection à la souris -----------------------------------------------
  useEffect(() => {
    if (!picking) return;
    document.documentElement.setAttribute("data-lbe-picking", "");
    const over = (ev: PointerEvent) => { hoverRef.current = pickable(ev.target); };
    const block = (ev: Event) => {
      if (isUi(ev.target as Element)) return;
      ev.preventDefault();
      ev.stopPropagation();
    };
    const click = (ev: MouseEvent) => {
      if (isUi(ev.target as Element)) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (swallowClick.current) { swallowClick.current = false; return; }
      if (movingRef.current) return;
      const el = pickable(ev.target);
      if (el) { setSelected(el); setMoving(false); }
    };
    // Glisser directement l'élément sélectionné (au-delà de 4 px = déplacement ;
    // sinon c'est un simple clic qui sélectionne).
    const down = (ev: PointerEvent) => {
      block(ev);
      const sel = selectedRef.current;
      if (movingRef.current || ev.button !== 0 || !sel || isUi(ev.target as Element)) return;
      const t = ev.target as Element;
      if (t !== sel && !sel.contains(t)) return;
      beginMove(sel, ev, 4);
    };
    // Double-clic sur l'élément sélectionné : mode « déplacer » (et retour).
    const dbl = (ev: MouseEvent) => {
      block(ev);
      const sel = selectedRef.current;
      const t = ev.target as Element;
      if (sel && (t === sel || sel.contains(t))) setMoving((m) => !m);
    };
    document.addEventListener("pointerover", over, true);
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("mousedown", block, true);
    document.addEventListener("click", click, true);
    document.addEventListener("dblclick", dbl, true);
    document.addEventListener("submit", block, true);
    return () => {
      document.documentElement.removeAttribute("data-lbe-picking");
      document.removeEventListener("pointerover", over, true);
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("mousedown", block, true);
      document.removeEventListener("click", click, true);
      document.removeEventListener("dblclick", dbl, true);
      document.removeEventListener("submit", block, true);
      hoverRef.current = null;
    };
  }, [picking]);

  // ---- Déplacement à la souris ---------------------------------------------
  // Aperçu par une règle CSS temporaire (setPreview) : le style propre de
  // l'élément n'est jamais modifié, donc rien ne peut « casser » la page.
  function beginMove(el: Element, ev: PointerEvent, threshold: number) {
    const s0 = editOf(el)?.style;
    const inline = !!s0?.inline || getComputedStyle(el).display === "inline";
    const sx = ev.clientX, sy = ev.clientY, ox = s0?.x ?? 0, oy = s0?.y ?? 0;
    let active = threshold === 0;
    const pos = (e: PointerEvent) => ({ x: Math.round(ox + e.clientX - sx), y: Math.round(oy + e.clientY - sy) });
    const show = (e: PointerEvent) => {
      const { x, y } = pos(e);
      setPreview(el, `translate:${x}px ${y}px !important;${inline ? "display:inline-block !important;" : ""}`);
    };
    const move = (e: PointerEvent) => {
      if (!active) {
        if (Math.hypot(e.clientX - sx, e.clientY - sy) < threshold) return;
        active = true;
        document.documentElement.style.cursor = "move";
      }
      e.preventDefault();
      show(e);
    };
    const up = (e: PointerEvent) => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      document.documentElement.style.cursor = movingRef.current ? "move" : "";
      setPreview(null, null);
      if (!active) return;
      swallowClick.current = true;
      window.setTimeout(() => { swallowClick.current = false; }, 300);
      const { x, y } = pos(e);
      setStyle(el, { x: x || undefined, y: y || undefined, inline: inline && !!(x || y) ? true : undefined });
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    if (active) show(ev);
  }

  // Mode « Déplacer » (bouton ou double-clic) : glisser n'importe où déplace l'élément.
  useEffect(() => {
    if (!moving || !selected) return;
    const el = selected;
    const down = (ev: PointerEvent) => {
      if (isUi(ev.target as Element) || ev.button !== 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      beginMove(el, ev, 0);
    };
    document.addEventListener("pointerdown", down, true);
    document.documentElement.style.cursor = "move";
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.documentElement.style.cursor = "";
      setPreview(null, null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moving, selected]);

  // ---- Redimensionner avec les poignées du cadre ---------------------------
  function beginResize(ev: React.PointerEvent, dir: "e" | "s" | "se") {
    const el = selectedRef.current;
    if (!el) return;
    ev.preventDefault();
    ev.stopPropagation();
    const r = el.getBoundingClientRect();
    const sx = ev.clientX, sy = ev.clientY;
    const w0 = r.width, h0 = r.height;
    const inline = getComputedStyle(el).display === "inline";
    const size = (e: PointerEvent) => {
      let w = dir === "s" ? null : Math.max(8, Math.round(w0 + e.clientX - sx));
      let h = dir === "e" ? null : Math.max(8, Math.round(h0 + e.clientY - sy));
      // Maj (ou une image) : on garde les proportions.
      if (dir === "se" && (e.shiftKey || el.tagName === "IMG") && w0 > 0 && h0 > 0) h = Math.round((w ?? w0) * (h0 / w0));
      return { w, h };
    };
    const css = ({ w, h }: { w: number | null; h: number | null }) =>
      (w != null ? `width:${w}px !important;max-width:none !important;min-width:0 !important;box-sizing:border-box !important;` : "") +
      (h != null ? `height:${h}px !important;max-height:none !important;min-height:0 !important;box-sizing:border-box !important;` : "") +
      (inline ? "display:inline-block !important;" : "");
    const move = (e: PointerEvent) => { e.preventDefault(); setPreview(el, css(size(e))); };
    const up = (e: PointerEvent) => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      setPreview(null, null);
      swallowClick.current = true;
      window.setTimeout(() => { swallowClick.current = false; }, 300);
      const { w, h } = size(e);
      const patch: Partial<EditStyle> = {};
      if (w != null) patch.width = w;
      if (h != null) patch.height = h;
      if (inline) patch.inline = true;
      setStyle(el, patch);
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
  }

  // ---- Clavier : flèches = déplacer, Suppr = cacher, Échap = désélectionner --
  useEffect(() => {
    if (!selected) return;
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (ev.key === "Escape") { setSelected(null); setMoving(false); return; }
      const step = ev.shiftKey ? 10 : 1;
      const s = editOf(selected)?.style;
      const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (d[ev.key]) {
        ev.preventDefault();
        const x = (s?.x ?? 0) + d[ev.key][0];
        const y = (s?.y ?? 0) + d[ev.key][1];
        const inline = s?.inline || getComputedStyle(selected).display === "inline";
        setStyle(selected, { x: x || undefined, y: y || undefined, inline: inline || undefined }, "nudge");
      } else if (ev.key === "Delete" || ev.key === "Backspace") {
        ev.preventDefault();
        if (selected.classList.contains("lbe-added")) { const e = editOf(selected); if (e) removeEdit(e.id); setSelected(null); }
        else { setStyle(selected, { hidden: true }); setSelected(null); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---- Cadres de survol / sélection (suivent la page) -----------------------
  useEffect(() => {
    let raf = 0;
    const place = (box: HTMLDivElement | null, el: Element | null) => {
      if (!box) return;
      if (!el || !el.isConnected) { box.style.display = "none"; return; }
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) { box.style.display = "none"; return; }
      box.style.display = "block";
      box.style.transform = `translate(${r.left - 2}px, ${r.top - 2}px)`;
      box.style.width = `${r.width + 4}px`;
      box.style.height = `${r.height + 4}px`;
    };
    const loop = () => {
      if (selected && !selected.isConnected) {
        // React a redessiné l'élément : on le retrouve via sa modification.
        const e = editOf(selected);
        const again = e ? (e.add ? document.querySelector(`.lbe-added[data-lbe="${e.id}"]`) : findTarget(e)) : null;
        setSelected(again);
      }
      place(hoverBox.current, picking && hoverRef.current !== selected ? hoverRef.current : null);
      place(selBox.current, selected);
      if (selLabel.current && selected) selLabel.current.textContent = labelOf(selected);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });

  // Réaffiche le panneau à jour quand la page change sous l'élément choisi.
  useEffect(() => { setTick((n) => n + 1); }, [draft]);

  function labelOf(el: Element): string {
    if (el.classList.contains("lbe-added")) return ADDED_LABELS[(el.getAttribute("data-kind") as AddedKind) ?? "text"] ?? "Ajout";
    return LABELS[el.tagName.toLowerCase()] ?? `<${el.tagName.toLowerCase()}>`;
  }

  const pageEdits = draft.edits.filter((e) => e.route === route || e.route === "*");

  return (
    <div className="lbe">
      <style>{CSS}</style>
      <div className="lbe-ui lbe-hover" ref={hoverBox} />
      <div className="lbe-ui lbe-sel" ref={selBox}>
        <span ref={selLabel} />
        <i className="lbe-ui lbe-h lbe-h-e" title="Largeur" onPointerDown={(e) => beginResize(e, "e")} />
        <i className="lbe-ui lbe-h lbe-h-s" title="Hauteur" onPointerDown={(e) => beginResize(e, "s")} />
        <i className="lbe-ui lbe-h lbe-h-se" title="Taille (Maj = garder les proportions)" onPointerDown={(e) => beginResize(e, "se")} />
      </div>

      <button type="button" className={picking ? "lbd-btn lbe-pick on" : "lbd-btn lbe-pick"} onClick={() => { setPicking((p) => !p); setMoving(false); }}>
        {picking ? "Sélection active : clique sur un élément du site" : "Navigation libre : clique ici pour sélectionner"}
      </button>
      <p className="lbd-hint">
        {picking
          ? "Clique pour choisir un élément, puis glisse-le pour le déplacer (ou double-clic). Tire les poignées du cadre pour le redimensionner. Désactive la sélection pour utiliser le site normalement."
          : "Le site fonctionne normalement : va sur la page à modifier, puis réactive la sélection."}
      </p>

      {selected && selected.isConnected ? (
        <Inspector
          key={keyOf(selected)}
          el={selected}
          edit={editOf(selected)}
          label={labelOf(selected)}
          moving={moving}
          setMoving={setMoving}
          update={update}
          setStyle={setStyle}
          addNear={addNear}
          remove={(id) => { removeEdit(id); setSelected(null); }}
          selectParent={() => {
            let p = selected.parentElement;
            while (p && isTooling(p)) p = p.parentElement;
            if (p && p !== document.body) setSelected(p);
          }}
          close={() => { setSelected(null); setMoving(false); }}
        />
      ) : (
        <section className="lbe-list">
          <h3>Modifications sur cette page</h3>
          {pageEdits.length === 0 && <p className="lbd-hint">Aucune pour l&apos;instant. Clique sur un texte, un bouton, une image… pour commencer.</p>}
          {pageEdits.map((e) => {
            const target = e.add ? document.querySelector(`.lbe-added[data-lbe="${e.id}"]`) : findTarget(e);
            const what = e.add ? ADDED_LABELS[e.add.kind] : LABELS[e.tag] ?? `<${e.tag}>`;
            const text = (e.texts?.find((t) => t !== null) ?? e.fp ?? "").slice(0, 40);
            return (
              <div key={e.id} className="lbe-row">
                <button type="button" className="lbe-rowmain" disabled={!target} onClick={() => target && setSelected(target)} title={target ? "Sélectionner" : "Pas visible sur cet écran"}>
                  <b>{what}</b>
                  {e.style?.hidden && <span className="lbe-tag">caché</span>}
                  {e.route === "*" && <span className="lbe-tag">toutes les pages</span>}
                  <small>{text || "—"}</small>
                </button>
                {e.style?.hidden && !e.add && (
                  <button type="button" className="lbd-icon" title="Réafficher" aria-label="Réafficher" onClick={() => change((d) => ({ ...d, edits: d.edits.map((x) => (x.id === e.id ? { ...x, style: { ...x.style, hidden: undefined } } : x)).filter((x) => x.add || !editIsEmpty(sanitizeLocal(x))) }))}>
                    <EyeIcon />
                  </button>
                )}
                <button type="button" className="lbd-icon" title="Annuler cette modification" aria-label="Annuler cette modification" onClick={() => removeEdit(e.id)}>
                  <CloseIcon />
                </button>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

function sanitizeLocal(e: SiteEdit): SiteEdit {
  const style = { ...(e.style ?? {}) };
  for (const k of Object.keys(style) as (keyof EditStyle)[]) if (style[k] === undefined) delete style[k];
  return { ...e, style: Object.keys(style).length ? style : undefined };
}

// ---------------------------------------------------------------------------

interface InspectorProps {
  el: Element;
  edit: SiteEdit | null;
  label: string;
  moving: boolean;
  setMoving: (v: boolean) => void;
  update: (el: Element, fn: (e: SiteEdit) => SiteEdit, key?: string) => void;
  setStyle: (el: Element, patch: Partial<EditStyle>, key?: string) => void;
  addNear: (el: Element, kind: AddedKind) => void;
  remove: (id: string) => void;
  selectParent: () => void;
  close: () => void;
}

function Inspector({ el, edit, label, moving, setMoving, update, setStyle, addNear, remove, selectParent, close }: InspectorProps) {
  const added = el.classList.contains("lbe-added");
  const kind = added ? (el.getAttribute("data-kind") as AddedKind) : null;
  const tagName = el.tagName;
  const nodes = added ? [] : textNodesOf(el);
  const s = edit?.style ?? {};
  const cs = getComputedStyle(el);
  const isLink = tagName === "A" || kind === "button";
  const isImg = tagName === "IMG";

  const setText = (i: number, v: string, orig: string) =>
    update(el, (e) => {
      const texts = [...(e.texts ?? [])];
      while (texts.length <= i) texts.push(null);
      // Les espaces autour du texte d'origine sont gardés (mise en page intacte).
      const lead = /^\s*/.exec(orig)![0];
      const trail = orig.trim() ? /\s*$/.exec(orig)![0] : "";
      const full = added ? v : lead + v + trail;
      texts[i] = added ? v : full === orig ? null : full;
      return { ...e, texts: texts.some((t) => t !== null) ? texts : undefined };
    }, `text${i}`);

  return (
    <section className="lbe-insp">
      <div className="lbe-insp-head">
        <strong>{label}</strong>
        <div>
          {!added && <button type="button" className="lbd-btn lbe-mini" onClick={selectParent} title="Sélectionner le bloc qui contient cet élément">Bloc parent</button>}
          <button type="button" className="lbd-icon" onClick={close} aria-label="Désélectionner" title="Désélectionner (Échap)"><CloseIcon /></button>
        </div>
      </div>

      {/* Texte */}
      {added && kind !== "image" && (
        <label className="lbd-field"><span>Texte</span>
          <textarea className="lbe-text" value={edit?.texts?.[0] ?? el.textContent ?? ""} onChange={(e) => setText(0, e.target.value, "")} />
        </label>
      )}
      {!added && nodes.map((n, i) => {
        const orig = originalText(n);
        return (
          <label key={i} className="lbd-field"><span>{nodes.length > 1 ? `Texte ${i + 1}` : "Texte"}</span>
            <textarea className="lbe-text" value={stripEdges(edit?.texts?.[i] ?? orig, orig)} onChange={(e) => setText(i, e.target.value, orig)} />
          </label>
        );
      })}
      {!added && nodes.length === 0 && !isImg && (
        <p className="lbd-hint">Pas de texte direct ici : clique sur le texte lui-même pour le modifier.</p>
      )}

      {/* Lien / image */}
      {isLink && (
        <label className="lbd-field"><span>Lien (adresse)</span>
          <input className="lbe-input" defaultValue={edit?.href ?? el.getAttribute("href") ?? ""} placeholder="/ ou https://…" onChange={(e) => {
            const v = e.target.value.trim();
            if (/^(https?:\/\/|\/|#|mailto:)/.test(v)) update(el, (x) => ({ ...x, href: v }), "href");
          }} />
        </label>
      )}
      {(isImg || kind === "image") && (
        <>
          <label className="lbd-field"><span>Image (adresse)</span>
            <input className="lbe-input" defaultValue={edit?.src ?? el.getAttribute("src") ?? ""} placeholder="/mon-image.png ou https://…" onChange={(e) => {
              const v = e.target.value.trim();
              if (/^(https?:\/\/|\/)/.test(v)) update(el, (x) => ({ ...x, src: v }), "src");
            }} />
          </label>
          <p className="lbd-hint">Mets ton image dans <code>apps/web/public/</code> (ex. <code>/mon-image.png</code>) ou colle une adresse https.</p>
          {kind === "image" && (
            <label className="lbd-field"><span>Description (pour l&apos;accessibilité)</span>
              <input className="lbe-input" value={edit?.texts?.[0] ?? ""} onChange={(e) => setText(0, e.target.value, "")} />
            </label>
          )}
        </>
      )}

      {/* Style */}
      <h3>Style</h3>
      <div className="lbe-grid">
        <ColorField label="Texte" value={s.color} fallback={cs.color} onChange={(v) => setStyle(el, { color: v }, "color")} />
        <ColorField label="Fond" value={s.background} fallback={cs.backgroundColor} onChange={(v) => setStyle(el, { background: v }, "bg")} />
        <NumField label="Taille du texte" unit="px" value={s.fontSize} placeholder={Math.round(parseFloat(cs.fontSize))} min={6} max={200} onChange={(v) => setStyle(el, { fontSize: v }, "fs")} />
        <label className="lbe-f"><span>Épaisseur</span>
          <select value={s.fontWeight ?? ""} onChange={(e) => setStyle(el, { fontWeight: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">Origine</option><option value="400">Normal</option><option value="600">Demi-gras</option><option value="800">Gras</option>
          </select>
        </label>
        <NumField label="Espace intérieur" unit="px" value={s.padding} placeholder={Math.round(parseFloat(cs.paddingTop)) || 0} min={0} max={200} onChange={(v) => setStyle(el, { padding: v }, "pad")} />
        <NumField label="Espace autour" unit="px" value={s.margin} placeholder={Math.round(parseFloat(cs.marginTop)) || 0} min={-200} max={200} onChange={(v) => setStyle(el, { margin: v }, "mar")} />
        <NumField label="Arrondi" unit="px" value={s.radius} placeholder={Math.round(parseFloat(cs.borderTopLeftRadius)) || 0} min={0} max={999} onChange={(v) => setStyle(el, { radius: v }, "rad")} />
        <NumField label="Opacité" unit="%" value={s.opacity} placeholder={100} min={0} max={100} onChange={(v) => setStyle(el, { opacity: v }, "op")} />
      </div>
      <div className="lbe-seg" role="group" aria-label="Alignement du texte">
        {([["left", "Gauche"], ["center", "Centre"], ["right", "Droite"]] as const).map(([v, l]) => (
          <button key={v} type="button" className={s.textAlign === v ? "on" : ""} onClick={() => setStyle(el, { textAlign: s.textAlign === v ? undefined : v })}>{l}</button>
        ))}
      </div>

      {/* Position */}
      <h3>Position</h3>
      <div className="lbd-row">
        <button type="button" className={moving ? "lbd-btn lbd-primary" : "lbd-btn"} onClick={() => setMoving(!moving)}>
          {moving ? "Terminer le déplacement" : "Mode déplacer"}
        </button>
        <button type="button" className="lbd-btn" disabled={!s.x && !s.y} onClick={() => setStyle(el, { x: undefined, y: undefined, inline: undefined })}>Position d&apos;origine</button>
      </div>
      <p className="lbd-hint">Ou glisse l&apos;élément directement, ou flèches du clavier (Maj = 10 px). Décalage : {s.x ?? 0}, {s.y ?? 0} px.</p>

      <h3>Taille</h3>
      <div className="lbe-grid">
        <NumField label="Largeur" unit="px" value={s.width} placeholder={Math.round(el.getBoundingClientRect().width)} min={1} max={4000} onChange={(v) => setStyle(el, { width: v }, "w")} />
        <NumField label="Hauteur" unit="px" value={s.height} placeholder={Math.round(el.getBoundingClientRect().height)} min={1} max={4000} onChange={(v) => setStyle(el, { height: v }, "h")} />
      </div>
      <div className="lbd-row">
        <button type="button" className="lbd-btn" disabled={s.width == null && s.height == null} onClick={() => setStyle(el, { width: undefined, height: undefined })}>Taille d&apos;origine</button>
      </div>
      <p className="lbd-hint">Ou tire les poignées du cadre bleu (coin : Maj pour garder les proportions).</p>

      {/* Ajouter */}
      <h3>Ajouter juste après</h3>
      <div className="lbe-adds">
        {([["text", "Texte"], ["title", "Titre"], ["button", "Bouton"], ["image", "Image"]] as const).map(([k, l]) => (
          <button key={k} type="button" className="lbd-btn" onClick={() => addNear(el, k)}>+ {l}</button>
        ))}
      </div>

      {/* Portée + suppression */}
      {edit && (
        <label className="lbe-check">
          <input type="checkbox" checked={edit.route === "*"} onChange={(e) => update(el, (x) => ({ ...x, route: e.target.checked ? "*" : routeKey(window.location.pathname) }))} />
          Appliquer sur toutes les pages (en-tête, pied de page…)
        </label>
      )}
      <div className="lbd-row">
        {added ? (
          <button type="button" className="lbd-btn lbd-danger" onClick={() => edit && remove(edit.id)}>Supprimer cet ajout</button>
        ) : (
          <>
            <button type="button" className="lbd-btn lbd-danger" onClick={() => { setStyle(el, { hidden: true }); close(); }}>Supprimer (cacher)</button>
            <button type="button" className="lbd-btn" disabled={!edit} onClick={() => edit && remove(edit.id)}>Tout remettre d&apos;origine</button>
          </>
        )}
      </div>
    </section>
  );
}

/** Texte affiché dans l'éditeur : sans les espaces de bord du texte d'origine. */
function stripEdges(text: string, orig: string): string {
  const lead = /^\s*/.exec(orig)![0];
  const trail = orig.trim() ? /\s*$/.exec(orig)![0] : "";
  let t = text;
  if (lead && t.startsWith(lead)) t = t.slice(lead.length);
  if (trail && t.endsWith(trail)) t = t.slice(0, t.length - trail.length);
  return t;
}

function toHex(css: string): string {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(css);
  if (!m) return "#000000";
  return "#" + [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, "0")).join("");
}

function ColorField({ label, value, fallback, onChange }: { label: string; value?: string; fallback: string; onChange: (v: string | undefined) => void }) {
  return (
    <label className="lbe-f"><span>{label}</span>
      <span className="lbe-color">
        <input type="color" value={(value ?? toHex(fallback)).toLowerCase()} onChange={(e) => onChange(e.target.value.toUpperCase())} />
        {value ? <button type="button" className="lbd-icon" onClick={() => onChange(undefined)} title="Couleur d'origine" aria-label={`${label} : couleur d'origine`}><CloseIcon /></button> : <em>origine</em>}
      </span>
    </label>
  );
}

function NumField({ label, unit, value, placeholder, min, max, onChange }: { label: string; unit: string; value?: number; placeholder: number; min: number; max: number; onChange: (v: number | undefined) => void }) {
  return (
    <label className="lbe-f"><span>{label}</span>
      <span className="lbe-num">
        <input type="number" min={min} max={max} value={value ?? ""} placeholder={String(placeholder)} onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? undefined : Math.max(min, Math.min(max, Math.round(Number(v)))));
        }} />
        <i>{unit}</i>
      </span>
    </label>
  );
}

function CloseIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>;
}
function EyeIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>;
}

const CSS = `
.lbe-hover,.lbe-sel{position:fixed;left:0;top:0;z-index:2147482999;pointer-events:none;display:none;border-radius:6px}
.lbe-hover{outline:2px dashed #8FA8FF;background:rgba(143,168,255,.08)}
.lbe-sel{outline:2px solid #8FA8FF;box-shadow:0 0 0 4px rgba(143,168,255,.25)}
.lbe-h{position:absolute;pointer-events:auto;background:#8FA8FF;border:2px solid #0B0D18;border-radius:3px;z-index:1}
.lbe-h-e{right:-6px;top:50%;width:9px;height:22px;margin-top:-11px;cursor:ew-resize}
.lbe-h-s{bottom:-6px;left:50%;width:22px;height:9px;margin-left:-11px;cursor:ns-resize}
.lbe-h-se{right:-7px;bottom:-7px;width:13px;height:13px;cursor:nwse-resize}
html[data-lbe-picking] .lbe-h-e{cursor:ew-resize !important}
html[data-lbe-picking] .lbe-h-s{cursor:ns-resize !important}
html[data-lbe-picking] .lbe-h-se{cursor:nwse-resize !important}
.lbe-sel span{position:absolute;left:-2px;top:-24px;padding:3px 8px;border-radius:6px 6px 6px 0;background:#8FA8FF;color:#0B0D18;font:700 11px/1.3 system-ui,sans-serif;white-space:nowrap}
html[data-lbe-picking] body *:not(.lbd):not(.lbd *):not(.lbe-ui){cursor:pointer !important}
.lbe-pick{width:100%;white-space:normal;text-align:left}
.lbe-pick.on{border-color:#8FA8FF;background:rgba(143,168,255,.14);color:#EEECF4}
.lbe h3,.lbe-insp h3{margin:16px 0 6px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#A19EB0}
.lbe-list{margin-top:8px}
.lbe-row{display:flex;align-items:center;gap:4px;border-bottom:1px solid #2E2C3A}
.lbe-rowmain{flex:1;min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;padding:9px 2px;border:0;background:none;color:#EEECF4;font:inherit;text-align:left;cursor:pointer}
.lbe-rowmain:disabled{opacity:.45;cursor:default}
.lbe-rowmain small{flex-basis:100%;color:#A19EB0;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lbe-tag{padding:1px 6px;border-radius:999px;background:#1B1A24;color:#F5C26B;font-size:10px;font-weight:600}
.lbe-insp{margin-top:12px}
.lbe-insp-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}
.lbe-insp-head strong{font-size:14px}
.lbe-insp-head div{display:flex;align-items:center;gap:4px}
.lbe-mini{flex:none;padding:6px 10px;font-size:12px}
.lbe-text{min-height:64px !important;font:13px/1.45 system-ui,sans-serif !important}
.lbe-input{width:100%;padding:8px 10px;border:1px solid #2E2C3A;border-radius:9px;background:#1B1A24;color:#EEECF4;font:inherit}
.lbe-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.lbe-f{display:flex;flex-direction:column;gap:4px;min-width:0}
.lbe-f>span:first-child{font-size:11px;color:#A19EB0;font-weight:600}
.lbe-f select{width:100%;padding:7px 8px;border:1px solid #2E2C3A;border-radius:8px;background:#1B1A24;color:#EEECF4;font:inherit}
.lbe-color{display:flex;align-items:center;gap:6px}
.lbe-color input{width:34px;height:30px;padding:0;border:1px solid #2E2C3A;border-radius:8px;background:none;cursor:pointer}
.lbe-color em{font-style:normal;font-size:11px;color:#A19EB0}
.lbe-num{display:flex;align-items:center;border:1px solid #2E2C3A;border-radius:8px;background:#1B1A24;overflow:hidden}
.lbe-num input{width:100%;min-width:0;padding:7px 8px;border:0;background:transparent;color:#EEECF4;font:inherit}
.lbe-num i{padding:0 8px;font-style:normal;color:#A19EB0;font-size:11px}
.lbe-seg{display:flex;margin-top:10px;border:1px solid #2E2C3A;border-radius:9px;overflow:hidden}
.lbe-seg button{flex:1;padding:7px;border:0;background:#1B1A24;color:#A19EB0;font:inherit;font-size:12px;cursor:pointer}
.lbe-seg button+button{border-left:1px solid #2E2C3A}
.lbe-seg button.on{background:rgba(143,168,255,.18);color:#EEECF4}
.lbe-adds{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.lbe-check{display:flex;align-items:flex-start;gap:8px;margin:14px 0 4px;font-size:12px;color:#EEECF4;cursor:pointer}
.lbe-check input{margin-top:2px}
`;
