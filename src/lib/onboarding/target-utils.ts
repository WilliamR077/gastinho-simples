export function isOnboardingTargetReady(el: HTMLElement | null): el is HTMLElement {
  if (!el || !el.isConnected) return false;

  // Only reject if inside a closed Accordion/Collapsible (not Radix Tooltip which also uses data-state)
  const closedAncestor = el.closest('[data-state="closed"]');
  if (closedAncestor) {
    const isAccordion = closedAncestor.hasAttribute("data-radix-collapsible") ||
      closedAncestor.getAttribute("role") === "region" ||
      closedAncestor.tagName === "DIV" && closedAncestor.hasAttribute("data-orientation");
    if (isAccordion) return false;
  }

  const rect = el.getBoundingClientRect();
  return el.getClientRects().length > 0 && rect.width > 0 && rect.height > 0;
}

export function findReadyOnboardingTarget(targetSelector?: string): HTMLElement | null {
  if (!targetSelector) return null;

  const matches = Array.from(
    document.querySelectorAll(`[data-onboarding="${targetSelector}"]`)
  ) as HTMLElement[];

  for (let index = matches.length - 1; index >= 0; index--) {
    if (isOnboardingTargetReady(matches[index])) {
      return matches[index];
    }
  }

  return null;
}
