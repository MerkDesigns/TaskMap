import { describe, expect, it } from "vitest";
import { cardsMatchingSearch, SEARCH_ROW_HEIGHT, searchRowHeight } from "./searchRule";

const cards = [{ text: "Buy milk" }, { text: "Call Anna" }, { text: "buy stamps" }];

describe("cardsMatchingSearch", () => {
  it("keeps cards containing the query, ignoring case and surrounding spaces, in order", () => {
    const container = { extensions: { search: { query: "  BUY " } } };

    expect(cardsMatchingSearch(container, cards)).toEqual([
      { text: "Buy milk" },
      { text: "buy stamps" },
    ]);
  });

  it("shows every card while the query is empty or Search is not installed", () => {
    expect(cardsMatchingSearch({ extensions: { search: { query: "   " } } }, cards)).toEqual(cards);
    expect(cardsMatchingSearch({}, cards)).toEqual(cards);
  });
});

describe("searchRowHeight", () => {
  it("adds the search row only while Search is installed", () => {
    expect(searchRowHeight({ extensions: { search: { query: "" } } })).toBe(SEARCH_ROW_HEIGHT);
    expect(searchRowHeight({ extensions: {} })).toBe(0);
  });
});
