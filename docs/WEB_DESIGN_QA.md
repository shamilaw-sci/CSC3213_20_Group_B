# Web design QA

## Evidence

- Source visual truth: `C:\Users\sivot\.codex\generated_images\01a1654b-aa5f-7ef2-aabd-7f2688026b08\exec-68bd61a4-96a7-4669-9533-f6d7cc51ecf9.png`
- Desktop implementation: `C:\Users\sivot\.codex\generated_images\01a1654b-aa5f-7ef2-aabd-7f2688026b08\web-implementation-1536x1024.png`
- Mobile navigation implementation: `C:\Users\sivot\.codex\generated_images\01a1654b-aa5f-7ef2-aabd-7f2688026b08\web-mobile-menu-390x844.png`
- Desktop comparison: 1536 x 1024 source pixels against a 1536 x 1024 CSS viewport at device scale factor 1. No density normalization was required.
- Mobile check: 390 x 844 CSS viewport at device scale factor 1.
- State: home route, light theme; mobile navigation open for the responsive check.

## Full-view comparison

The implementation preserves the selected concept's editorial hierarchy: a restrained institutional header, split introduction, three direct study and research pathways, and a long-form department overview with secondary links. The denser two-tier university navigation from the concept was intentionally replaced with the same compact interaction pattern used by the People application, as requested.

The concept's photographic hero and campus image were not carried into the implementation because public-asset work is outside the approved scope. The semantic primary-color panel preserves the intended split composition without introducing copied, placeholder, or unowned assets. This is an accepted product constraint rather than an unresolved fidelity issue.

## Focused-region comparison

- Header: department identity, primary destinations, current-route state, and theme control remain aligned on desktop; mobile reduces these to the identity and a single menu trigger.
- Secondary navigation: desktop exposes the less frequent department and product destinations through a compact `More` popover; mobile keeps the same destinations in a clearly labelled group. Local routes expose the current-page state in both variants.
- Hero: serif display type, compact eyebrow, readable supporting copy, direct action, and the split 50/50 composition follow the visual target.
- Pathways: the three equal-width rows retain clear icons, headings, explanations, and destination affordances.
- Mobile sheet: all department and related-product destinations are grouped, the long list scrolls independently, and the theme control stays in a fixed footer.

## Required fidelity surfaces

- Fonts and typography: Source Serif 4 provides the editorial display voice; Open Sans handles navigation and body copy. Weight, wrapping, and hierarchy remain readable at both checked viewports.
- Spacing and layout rhythm: desktop sections use consistent full-width bands and bounded content; mobile stacks the split hero and keeps 44-pixel navigation targets.
- Colors and visual tokens: every component uses the shared semantic theme tokens. Light and dark themes retain readable foreground, hover, active, border, and focus states.
- Image quality and asset fidelity: no image assets are shipped in this phase by explicit scope. No placeholder, copied archive image, or code-drawn image substitute was introduced.
- Copy and content: durable department information is concise and clearly separated from People, Projects, and e-learning product ownership.

## Findings

No actionable P0, P1, or P2 findings remain.

## Comparison history

1. The first browser pass exposed invalid nested paragraph markup produced by Markdown text inside native JSX paragraph elements. The MDX was corrected, a source-level regression test was added, and the revised page rendered without hydration warnings.
2. The mobile theme control initially exposed a server-rendered directional tooltip that could disagree with the active client theme. The shared control now uses the stable `Change color theme` title. A shared UI test covers the contract, and the control was verified switching from dark to light in the open mobile sheet.
3. The post-fix desktop and mobile captures show no clipped persistent controls, horizontal overflow, or browser console warnings. Every editorial route was opened and its unique page title and `h1` were confirmed.
4. Independent review found that secondary destinations were mobile-only, route metadata inherited the home canonical URL, footer links suppressed their focus outline, and mobile secondary links lacked a current-page state. The desktop `More` menu, per-route metadata helper, visible footer focus treatment, and matching mobile `aria-current` state were added and verified on `/services`.

## Open questions

- Photography and official brand assets can be added in a separate asset-owned phase if that scope is approved later.

## Implementation checklist

- [x] Match the selected editorial hierarchy.
- [x] Follow the People-style responsive navigation pattern.
- [x] Verify light and dark theme switching.
- [x] Verify all local editorial routes and the mobile menu.
- [x] Verify per-route canonical and social metadata.
- [x] Verify desktop and mobile secondary navigation states.
- [x] Check browser warnings and hydration behavior.

## Follow-up polish

- P3: Replace the semantic hero panel with approved department photography only when an owned, optimized asset set is available.

final result: passed
