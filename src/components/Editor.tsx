"use client";

import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { EditorState, StateEffect, StateField, type Range } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, keymap, placeholder } from "@codemirror/view";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { Verdict } from "@/lib/types";

export type Mark = { id: string; from: number; to: number; verdict: Verdict | "none" };
export type MarkClick = { id: string; from: number; to: number; rect: DOMRect };
export type EditorHandle = { replace: (from: number, to: number, insert: string) => void; setActive: (id: string | null) => void };

const setMarks = StateEffect.define<{ marks: Mark[]; active: string | null }>();

const marksField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setMarks)) continue;
      const ranges: Range<Decoration>[] = e.value.marks
        .filter((m) => m.to > m.from && m.to <= tr.state.doc.length)
        .map((m) =>
          Decoration.mark({
            class: `cb-mark cb-${m.verdict}${m.id === e.value.active ? " cb-active" : ""}`,
            attributes: { "data-ref": m.id },
            refId: m.id,
          }).range(m.from, m.to),
        );
      deco = Decoration.set(ranges, true);
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const theme = EditorView.theme({
  "&": { fontSize: "17px", color: "var(--ink)" },
  ".cm-scroller": { fontFamily: "var(--font-sans), system-ui, sans-serif", lineHeight: "1.85" },
  ".cm-content": { padding: "28px 32px", caretColor: "var(--ink)", minHeight: "320px" },
  ".cm-line": { padding: 0 },
  ".cm-cursor": { borderLeftColor: "var(--ink)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": { background: "var(--line) !important" },
  ".cm-placeholder": { color: "var(--muted)" },
});

type Props = {
  /** replaced wholesale whenever `docKey` changes */
  initialDoc: string;
  docKey: string;
  marks: Mark[];
  active: string | null;
  onChange: (text: string) => void;
  onMarkClick: (click: MarkClick) => void;
};

export const Editor = forwardRef<EditorHandle, Props>(function Editor(
  { initialDoc, docKey, marks, active, onChange, onMarkClick },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const cb = useRef({ onChange, onMarkClick });
  cb.current = { onChange, onMarkClick };
  const latest = useRef({ marks, active });
  latest.current = { marks, active };

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initialDoc,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping,
          placeholder("Paste a set, toast, pitch or keynote…"),
          theme,
          marksField,
          EditorView.updateListener.of((u) => {
            if (u.docChanged) cb.current.onChange(u.state.doc.toString());
          }),
          EditorView.domEventHandlers({
            mousedown(e, editor) {
              const el = (e.target as HTMLElement).closest<HTMLElement>("[data-ref]");
              if (!el) return false;
              const id = el.dataset.ref!;
              const pos = editor.posAtDOM(el);
              let range: { from: number; to: number } | null = null;
              editor.state.field(marksField).between(pos, pos + 1, (from, to, deco) => {
                if (deco.spec.refId === id) range = { from, to };
              });
              if (!range) return false;
              cb.current.onMarkClick({ id, ...(range as { from: number; to: number }), rect: el.getBoundingClientRect() });
              return false;
            },
          }),
        ],
      }),
    });
    view.current = v;
    v.dispatch({ effects: setMarks.of(latest.current) });
    return () => v.destroy();
    // the document is deliberately only (re)created when docKey changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey]);

  useEffect(() => {
    view.current?.dispatch({ effects: setMarks.of({ marks, active }) });
  }, [marks, active]);

  useImperativeHandle(ref, () => ({
    replace(from, to, insert) {
      view.current?.dispatch({ changes: { from, to, insert } });
    },
    setActive(id) {
      view.current?.dispatch({ effects: setMarks.of({ marks: latest.current.marks, active: id }) });
    },
  }));

  return <div ref={host} />;
});
