import { useMemo, useRef, useState, type WheelEvent } from "react";
import { clamp } from "../canvasMath";
import type { ContainerElement, TextCardElement } from "../types";
import { createContainerCardLayout, groupContainerCards } from "./containerCardLayout";

type Offsets = Readonly<Record<string, number>>;

/**
 * How far each container's card list is scrolled, and the card layout that follows from it.
 * Scroll offsets are view state: they never enter the document or its history.
 */
export function useContainerCardScroll(
  textCards: readonly TextCardElement[],
  containerOf: (id: string) => ContainerElement | undefined,
) {
  const [offsets, setOffsets] = useState<Offsets>({});
  const offsetsRef = useRef(offsets);
  offsetsRef.current = offsets;
  const grouped = useMemo(() => groupContainerCards(textCards), [textCards]);
  const layout = createContainerCardLayout(textCards, grouped, offsets);
  const latest = useRef({ layout, containerOf });
  latest.current = { layout, containerOf };

  const actions = useMemo(
    () => ({
      /** Scrolls the container under the wheel, when its cards overflow it. */
      wheel(event: WheelEvent<HTMLElement>, container: ContainerElement) {
        const maxScroll = latest.current.layout.maxScroll(container);
        if (maxScroll <= 0) return;
        event.preventDefault();
        event.stopPropagation();
        setOffsets((current) => ({
          ...current,
          [container.id]: clamp((current[container.id] ?? 0) + event.deltaY, 0, maxScroll),
        }));
      },
      scrollTo(containerId: string, offset: number) {
        setOffsets((current) => ({ ...current, [containerId]: offset }));
      },
      /** Scrolls the containers back to their first card. */
      reset(ids: readonly string[]) {
        setOffsets((current) => ({ ...current, ...Object.fromEntries(ids.map((id) => [id, 0])) }));
      },
      /** The latest offsets, for event handlers that outlive a render. */
      currentOffsets: () => offsetsRef.current,
      /** Where a card sits at rest: its row in its container, or its own position when loose. */
      restingPosition(card: TextCardElement, cards?: readonly TextCardElement[]) {
        const { layout: current, containerOf: find } = latest.current;
        const container = card.containerId ? find(card.containerId) : undefined;
        return container ? current.cardPosition(container, card, cards) : { x: card.x, y: card.y };
      },
    }),
    [],
  );

  return { ...actions, offsets, grouped, layout };
}
