# Modal Mounting & Animation Playbook

The modals in this project share a common set of UX expectations:

1. Fade / scale transitions when opening or closing.
2. Automatic scroll locking and high‐z overlay.
3. No “ghost” interaction once a modal is hidden (pointer events must stop immediately).
4. Deterministic unmounting so that React doesn’t keep large DOM subtrees alive longer than needed.

This document captures the approach that has worked well across browsers, including when the app is embedded inside an `<iframe>` with a restrictive sandbox (e.g., Google AI Studio previews).

---

## 1. Separate “should render” from “is visible”

Keep two pieces of state inside the parent that orchestrates a modal:

| flag | meaning |
| --- | --- |
| `shouldRenderModal` | Controls whether the modal subtree is mounted at all. Once this flips to `false`, React unmounts immediately. |
| `modalVisibleForAnimation` | Drives the `open` CSS class and all interactive behaviour. |

Pattern:

```ts
const [shouldRenderModal, setShouldRenderModal] = useState(isModalOpen);
const [visibleForAnimation, setVisibleForAnimation] = useState(isModalOpen);
const teardownTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
```

When the consumer requests `isModalOpen === true`, do the following inside `useEffect`:

1. `setShouldRenderModal(true)` right away.
2. Reset `visibleForAnimation` to `false`.
3. Schedule a _double_ `requestAnimationFrame` before flipping `visibleForAnimation` back to `true`. This ensures the browser has rendered the modal once in the hidden state, so CSS transitions can run:

```ts
let raf1: number | null = null;
let raf2: number | null = null;
raf1 = requestAnimationFrame(() => {
  raf2 = requestAnimationFrame(() => setVisibleForAnimation(true));
});
return () => {
  if (raf1) cancelAnimationFrame(raf1);
  if (raf2) cancelAnimationFrame(raf2);
};
```

When `isModalOpen === false`:

1. Set `visibleForAnimation` to `false`. CSS transitions will run the fade‐out.
2. Schedule a `setTimeout` (duration ≥ CSS transition length) that calls `setShouldRenderModal(false)` and clears any stored refs.
3. Provide a `transitionend` handler from the parent that cancels the timeout and unmounts immediately when the animation really finishes. This keeps things deterministic even when timers are throttled inside sandboxes.

Always clear timers in the cleanup phase so we never attempt to unmount twice.

---

## 2. Make the modal component pointer‐safe

The modal view itself receives both flags:

* If the parent sets `isVisible={visibleForAnimation}`, apply the corresponding `open` class.
* If `isVisible === false`, set `aria-hidden="true"` and override `style={{ pointerEvents: 'none' }}` on the root container. This prevents any clicks while the fade‐out is running.

Nested interactive elements (like the map SVG) should also accept an `isInteractive` prop derived from the same flag. Guard every event handler:

```tsx
onClick={isInteractive ? handleSelect : undefined}
pointerEvents={isInteractive ? 'stroke' : 'none'}
```

That way, even if the DOM is still present during transition, nothing responds to user input.

---

## 3. Clean up on unmount

If a modal component sets timers internally (e.g., to debounce layout updates), cancel them in `useEffect`’s cleanup so that unmounting during an animation never triggers warnings about state updates on unmounted components.

For example, the map modal stores a timeout that recalculates layout after slider changes. Each timeout is cleared inside the component’s own cleanup.

---

## 4. CSS expectations

All animated frames share these classes (defined in `index.css`):

```css
.animated-frame {
  opacity: 0;
  transform: scale(0.5);
  pointer-events: none;
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.animated-frame.open {
  opacity: 1;
  transform: scale(1);
  pointer-events: auto;
}
```

By toggling `.open` in sync with `visibleForAnimation`, we get consistent fade / scale behaviour without forcing LayoutThrashing™.

---

## 5. Quick checklist for new modals

1. **Parent hook**  
   - [ ] Track both `shouldRender` and `visibleForAnimation`.  
   - [ ] Handle open → double `requestAnimationFrame` → set visible.  
   - [ ] Handle close → set visible false → schedule fallback timeout → set render false.  
   - [ ] Wire an `onTransitionEnd` handler to cancel the timeout.

2. **Modal component**  
   - [ ] Accept `isVisible` and optional `onTransitionEnd`.  
   - [ ] Apply `pointerEvents: none` and `aria-hidden` when hidden.  
   - [ ] Guard child handlers with `isInteractive`.

3. **CSS**  
   - [ ] Ensure `.animated-frame` transitions match the timeout duration.  
   - [ ] Avoid inline animations that conflict with the shared frame class.

4. **Cleanup**  
   - [ ] Cancel any local timers or animation frames inside `useEffect` cleanup.  
   - [ ] Reset refs (`setTimeout` handles, etc.) to `null`.

Following this recipe prevents “ghost” interactions, keeps animations smooth, and works reliably even in constrained environments like sandboxed iframes.
