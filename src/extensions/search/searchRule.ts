/** Anything that may carry the Search extension's projected state. */
export interface Searchable {
  readonly extensions?: { readonly search?: { readonly query: string } };
}

/** The search row Search adds below a container's header; matches `.taskmap-container__search-row`. */
export const SEARCH_ROW_HEIGHT = 42;

/** The height Search adds to a container's header: its search row, while installed. */
export const searchRowHeight = (container: Searchable): number =>
  container.extensions?.search ? SEARCH_ROW_HEIGHT : 0;

/**
 * The cards a container shows: those whose text contains the search query, ignoring case and
 * surrounding whitespace, or every card while the query is empty or Search is not installed. Order
 * is kept, so a card's index here is the slot it occupies.
 */
export function cardsMatchingSearch<Card extends { readonly text: string }>(
  container: Searchable,
  cards: readonly Card[],
): readonly Card[] {
  const query = container.extensions?.search?.query.trim().toLowerCase() ?? "";
  return query ? cards.filter((card) => card.text.toLowerCase().includes(query)) : cards;
}
