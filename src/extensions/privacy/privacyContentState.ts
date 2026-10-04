import type { ContentStateContribution } from "../contentState";

/** Engaged Privacy hides the element's content until it is switched off again. */
export const privacyContentState: ContentStateContribution = {
  extension: "privacy",
  state: "hidden",
  applies: (extensions) => extensions.privacy?.enabled === true,
};
