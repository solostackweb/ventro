# Responsive Wireframes Specification — Phase 0

**Version:** 0.1  
**Date:** 2026-09-30  
**Status:** Draft for review; implementation in Phase 1–2

---

## Design System Foundation

### Breakpoints
| Name | Width | Target Devices |
|------|-------|----------------|
| `xs` | 320px–479px | Small phones |
| `sm` | 480px–639px | Large phones |
| `md` | 640px–1023px | Tablets / small laptops |
| `lg` | 1024px–1279px | Laptops / desktop |
| `xl` | 1280px–1535px | Large desktop |
| `2xl` | ≥1536px | Ultra-wide |

### Spacing Scale (Base: 4px)
| Token | Value | Use Case |
|-------|-------|----------|
| `space-1` | 4px | Inline gaps |
| `space-2` | 8px | Component padding |
| `space-3` | 12px | Card padding |
| `space-4` | 16px | Section gaps |
| `space-5` | 24px | Major sections |
| `space-6` | 32px | Page margins |
| `space-8` | 48px | Hero sections |

### Typography Scale
| Token | Size (rem) | Line Height | Weight | Use Case |
|-------|------------|-------------|--------|----------|
| `text-xs` | 0.75rem (12px) | 1.5 | 400 | Labels, timestamps |
| `text-sm` | 0.875rem (14px) | 1.5 | 400 | Body secondary |
| `text-base` | 1rem (16px) | 1.6 | 400 | Body primary |
| `text-lg` | 1.125rem (18px) | 1.6 | 400 | Card titles |
| `text-xl` | 1.25rem (20px) | 1.5 | 500 | Section headers |
| `text-2xl` | 1.5rem (24px) | 1.4 | 600 | Page titles |
| `text-3xl` | 1.875rem (30px) | 1.3 | 700 | Hero headlines |
| `text-4xl` | 2.25rem (36px) | 1.2 | 700 | Landing hero |

### Color Tokens (Semantic)
| Token | Light | Dark | Use Case |
|-------|-------|------|----------|
| `bg-primary` | `#ffffff` | `#0f172a` | Page background |
| `bg-secondary` | `#f8fafc` | `#1e293b` | Card background |
| `bg-tertiary` | `#f1f5f9` | `#334155` | Hover/focus |
| `text-primary` | `#0f172a` | `#f8fafc` | Primary text |
| `text-secondary` | `#475569` | `#cbd5e1` | Secondary text |
| `text-muted` | `#94a3b8` | `#64748b` | Placeholders |
| `border-default` | `#e2e8f0` | `#334155` | Borders |
| `accent-blue` | `#2563eb` | `#3b82f6` | Primary actions |
| `accent-green` | `#059669` | `#10b981` | Success/verified |
| `accent-amber` | `#d97706` | `#f59e0b` | Warning/partial |
| `accent-red` | `#dc2626` | `#ef4444` | Error/critical |
| `accent-purple` | `#7c3aed` | `#a855f7` | AI/premium |

### Verification Badge Colors
| Status | Light | Dark | Label |
|--------|-------|------|-------|
| `verified` | `#059669` bg, white text | `#10b981` bg, dark text | Verified |
| `partial` | `#d97706` bg, white text | `#f59e0b` bg, dark text | Partial |
| `unverified` | `#64748b` bg, white text | `#94a3b8` bg, dark text | Unverified |
| `conflicted` | `#dc2626` bg, white text | `#ef4444` bg, dark text | Conflicted |

---

## Component Library

### 1. Navigation Bar (Desktop ≥md)
```
┌─────────────────────────────────────────────────────────────────────┐
│ Logo  [For You] [News] [Investments] [Companies] [Investors] [YC]   │
│                      [Patterns] [Saved] [Community]  [Settings ▼]   │
└─────────────────────────────────────────────────────────────────────┘
```
- Logo links to `/` (For You if signed in, Home if not)
- Active route highlighted with `accent-blue` underline
- Settings dropdown: Profile, Billing, Personalization, Alerts, Sign Out
- Search icon (cmd+k) opens command palette

### 2. Mobile Bottom Navigation (≤sm)
```
┌──────────────────────────────────────┐
│  [For You]  [News]  [Saved]  [Menu]  │
│   🏠        📰      🔖      ☰        │
└──────────────────────────────────────┘
```
- Fixed bottom; safe-area inset for iOS
- Menu opens slide-over drawer with full nav

### 3. Feed Card (Dense List)
```
┌─────────────────────────────────────────────────────────────────────┐
│ [🏷️ AI Infra] [🔖 Verified]  2h ago  •  3 sources  •  🔖 Save      │
│                                                                     │
│ **Sequoia leads $6.6B round in OpenAI**                            │
│ OpenAI raises largest private round ever at $157B valuation...     │
│                                                                     │
│ 🏢 OpenAI  💰 Series B  💵 $6.6B  👥 Sequoia (lead), Thrive, NVIDIA │
│ 🏷️ Foundation Models  🌍 US  📅 2024-10-02                         │
│                                                                     │
│ [Why am I seeing this?]  [Follow OpenAI]  [Follow Sequoia]         │
└─────────────────────────────────────────────────────────────────────┘
```
- **xs/sm**: Stack vertically; tags wrap; actions full-width
- **md+**: Horizontal tag row; actions inline right
- Verification badge always visible
- "Why am I seeing this?" expands inline with explanation

### 4. Feed Card (Comfortable Grid — md+)
```
┌─────────────────────────────┐ ┌─────────────────────────────┐
│ [🏷️ Foundation] [Verified]  │ │ [🏷️ Robotics] [Partial]     │
│                             │ │                             │
│ **Figure AI raises $675M**  │ │ **Skild AI raises $300M**   │
│ Humanoid robotics startup...│ │ Robotics foundation model...│
│                             │ │                             │
│ 🏢 Figure AI  💰 Series B   │ │ 🏢 Skild AI  💰 Series A    │
│ 💵 $675M  👥 Microsoft...   │ │ 💵 $300M  👥 Lightspeed...  │
│ 🏷️ Robotics  🌍 US          │ │ 🏷️ Robotics  🌍 US          │
│                             │ │                             │
│ [Save] [Follow] [Share]     │ │ [Save] [Follow] [Share]     │
└─────────────────────────────┘ └─────────────────────────────┘
```
- 2-col md, 3-col lg, 4-col xl
- Aspect ratio ~4:3

### 5. Company Profile Page
```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Back  OpenAI                                    [Follow] [Share]  │
├─────────────────────────────────────────────────────────────────────┤
│ [Overview] [Funding] [Investors] [Announcements] [Signals] [Save]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  OpenAI                                    🌍 San Francisco, US    │
│  openai.com                                 🏷️ Foundation Models  │
│                                                                     │
│  Building safe AGI. Creator of GPT-4, ChatGPT, DALL·E, Sora.       │
│  Source: openai.com/about (2024-10-01)                              │
│                                                                     │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐   │
│  │ Stage: Growth    │ │ Latest: $6.6B    │ │ Valuation: $157B │   │
│  │ (not disclosed)  │ │ Series B (Oct'24)│ │ (not disclosed)  │   │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘   │
│                                                                     │
│  ─── Funding Timeline ──────────────────────────────────────────── │
│  2024-10  Series B  $6.6B  Sequoia (lead), Thrive, NVIDIA  ✓      │
│  2023-01  Series C  $10B   Microsoft (lead)                  ✓      │
│  2019-07  Series B  $1B    Microsoft (lead)                  ✓      │
│  ────────────────────────────────────────────────────────────────  │
│                                                                     │
│  ─── Key Investors ──────────────────────────────────────────────  │
│  [Sequoia Capital]  [Microsoft]  [Thrive Capital]  [NVIDIA]  [+3]  │
│                                                                     │
│  ─── Recent Announcements ──────────────────────────────────────── │
│  [Card: GPT-4o launch]  [Card: Sora preview]  [Card: Safety work]  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```
- **xs/sm**: Tabs become accordion; timeline stacks; investor chips wrap
- "Not disclosed" shown for unknown values (never empty)
- Source link on every factual claim

### 6. Investor Profile Page
```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Back  Sequoia Capital                                    [Follow] │
├─────────────────────────────────────────────────────────────────────┤
│ [Overview] [Stated Thesis] [Observed Thesis] [Portfolio] [Activity] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Sequoia Capital                                   🌍 Menlo Park   │
│  sequoiacap.com                                    🏷️ Multi-stage  │
│                                                                     │
│  ─── Stated Thesis ──────────────────────────────────────────────  │
│  "AI: A New Era" — Sonya Huang & Pat Grady (2023)                  │
│  "Generative AI Market Map: Infrastructure → Middleware → Apps"    │
│  Source: sequoiacap.com/blog/ai-new-era (2023-09-15)               │
│                                                                     │
│  ─── Observed Thesis (Inferred) ─────────────────────────────────  │
│  Methodology: Portfolio clustering (2023-2024), n=47 AI deals     │
│  Top themes: Foundation Models (32%), AI Infra (28%), Apps (24%)   │
│  Confidence: High  •  Last computed: 2024-10-01                   │
│  [View methodology]  [View all 47 deals]                           │
│                                                                     │
│  ─── Recent Investments ─────────────────────────────────────────  │
│  2024-10  OpenAI        Series B  $6.6B   Lead    ✓  Foundation   │
│  2024-05  xAI           Series B  $6B     Lead    ✓  Foundation   │
│  2024-06  Mistral       Series B  €600M   Participant  Foundation  │
│  2024-03  Glean         Series E  $260M   Lead    ✓  Enterprise   │
│  [View all 47]                                                         │
│                                                                     │
│  ─── Fit for You ────────────────────────────────────────────────  │
│  🎯 3 Foundation Model rounds in 2024 → matches your topic        │
│  🎯 2 AI Infra leads → matches your 'Infrastructure' topic        │
│  📍 US focus → matches your geography                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```
- **Stated** vs **Observed** tabs visually distinct (badge colors)
- Observed thesis shows methodology, period, sample size, confidence
- "Fit for You" only for signed-in users with preferences

### 7. News Feed Page (Desktop)
```
┌─────────────────────────────────────────────────────────────────────┐
│ Filters: [Latest ▼] [Topics ▼] [Geography ▼] [Event Type ▼] [🔍]  │
│         [Companies ▼] [Investors ▼] [YC Batch ▼] [Verified Only]   │
├──────────────────────────┬──────────────────────────────────────────┤
│                          │                                          │
│   Feed Cards             │  Sidebar (lg+)                          │
│   (dense list)           │  ┌──────────────────────────────────┐  │
│                          │  │ Trending Topics                  │  │
│  [Card 1]                │  │ 1. Foundation Models  ↑ 23%      │  │
│  [Card 2]                │  │ 2. AI Infrastructure  ↑ 18%      │  │
│  [Card 3]                │  │ 3. Robotics  → 12%               │  │
│  ...                     │  │ 4. Voice AI  ↑ 31%               │  │
│                          │  ├──────────────────────────────────┤  │
│                          │  │ Active Funds (7d)                │  │
│                          │  │ 1. Sequoia (5 deals)             │  │
│                          │  │ 2. a16z (4 deals)                │  │
│                          │  │ 3. Lightspeed (3 deals)          │  │
│                          │  └──────────────────────────────────┘  │
│                          │                                          │
└──────────────────────────┴──────────────────────────────────────────┘
```
- **xs/sm**: Filters in bottom sheet; sidebar hidden (toggle via filter button)
- URL preserves all filter state for sharing

### 8. Pattern Card
```
┌─────────────────────────────────────────────────────────────────────┐
│ [📊 Published]  AI Infrastructure Funding Surge  Q1 2025           │
│                                                                     │
│  47 deals  •  $12.3B disclosed  •  Baseline: 31 deals/qtr  +52%   │
│  23 distinct companies  •  18 distinct funds  •  Confidence: High │
│                                                                     │
│  ─── Qualifying Events ───  (click to expand)                      │
│  ▸ 2025-03  Together AI   $106M  Series B  NVIDIA, Salesforce      │
│  ▸ 2025-02  Baseten       $40M   Series B  IVP, Spark              │
│  ▸ 2025-01  Modal         $75M   Series B  Redpoint, Amplify       │
│  [Show all 47]                                                     │
│                                                                     │
│  ─── Counterexamples ───                                           │
│  CoreWeave (debt facility) • Lambda Labs (secondary)               │
│                                                                     │
│  [Save] [Discuss] [Share]  •  Source: Crunchbase, SEC, company PR  │
└─────────────────────────────────────────────────────────────────────┘
```

### 9. Onboarding Flow (5 Steps)
```
Step 1/5          Step 2/5          Step 3/5          Step 4/5          Step 5/5
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Role     │     │ Topics   │     │ Geo      │     │ Stage    │     │ Follow   │
│ ○ Founder│     │ ☑ Foun.  │     │ ☑ US     │     │ ☑ Seed   │     │ Search:  │
│ ○ Investor│    │ ☑ Infra  │     │ ☑ India  │     │ ☑ Series A│    │ [Sequoia]│
│ ○ Analyst │    │ ☑ Apps   │     │ ☐ EU     │     │ ☐ Series B│    │ [OpenAI] │
│ ○ Student │    │ ☐ Robot. │     │ ☐ Israel │     │ ☐ Growth │    │ [Anthrop]│
│ ○ Other  │     │ ☐ Hardw. │     │ ☐ Canada │     │ ☐ Public │    │ [+ Add]  │
│          │     │ ☐ Resear.│     │ ☐ SEA    │     │          │    │          │
│ [Next]   │     │ [Next]   │     │ [Next]   │     │ [Next]   │     │ [Finish] │
└──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
```
- Progress bar at top
- All steps skippable; "Skip" link top-right
- Step 5: Typeahead from 50/50 catalog

### 10. Paywall / Coming Soon Modal
```
┌─────────────────────────────────────────────────────────────────────┐
│  Unlock Full Access                                    [×]          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Get investor theses, round details, patterns, alerts & more       │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │   $10 / month — Coming Soon                                 │   │
│  │                                                             │   │
│  │  ✓ Full profiles                                            │   │
│  │  ✓ Stated + Observed thesis                                 │   │
│  │  ✓ Patterns & alerts                                        │   │
│  │  ✓ Unlimited saves                                          │   │
│  │  ✓ Community posting                                        │   │
│  │                                                             │   │
│  │  [Notify Me When Launches]                                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │   Masters' Union Students — 10-Day Access                   │   │
│  │                                                             │   │
│  │  ✓ Same as paid plan                                        │   │
│  │  ✓ No card required                                         │   │
│  │  ✓ Ends automatically                                       │   │
│  │                                                             │   │
│  │  [Verify Student Email]  ← only if @mastersunion.org       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  No subscription yet. We'll email you when pricing is live.        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```
- "Verify Student Email" button only renders server-side when email domain verified
- No subscription path; "Notify Me" captures email for waitlist

### 11. Settings — Personalization
```
┌─────────────────────────────────────────────────────────────────────┐
│ Settings → Personalization                                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  AI Topics          [Foundation Models ████████░░ 0.8] [▼]         │
│                     [Infrastructure ██████░░░░ 0.6] [▼]            │
│                     [Applications ████░░░░░░ 0.4] [▼]              │
│                     [Robotics ░░░░░░░░░░ 0.0] [▼]                  │
│                     [+ Add Topic]                                   │
│                                                                     │
│  Geographies        [US ████████░░] [India ████░░░░░] [EU ░░░░░░] │
│                                                                     │
│  Stages             [Pre-seed ██░░░░░░] [Seed ██████░░░]           │
│                     [Series A ████████░░] [Series B ████░░░░]      │
│                                                                     │
│  Followed Funds     [Sequoia] [a16z] [Lightspeed] [+ Add]         │
│  Followed Companies [OpenAI] [Anthropic] [+ Add]                   │
│                                                                     │
│  [Reset to Onboarding Defaults]  [Save Changes]                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```
- Sliders for weight adjustment (0–1)
- Real-time feed preview updates (debounced)

### 12. Alert Configuration
```
┌─────────────────────────────────────────────────────────────────────┐
│ Settings → Alerts                                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Sequoia Capital                                    [⋮] [🗑] │   │
│  │ Trigger: New funding round matching your topics             │   │
│  │ Frequency: Daily digest  •  Channels: Email + In-app       │   │
│  │ Last sent: 2024-10-01 08:00 UTC  •  [Test] [Edit]          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ OpenAI                                            [⋮] [🗑]   │   │
│  │ Trigger: Any new announcement                               │   │
│  │ Frequency: Instant  •  Channels: In-app only                │   │
│  │ Last sent: 2024-09-28 14:30 UTC  •  [Test] [Edit]          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [+ Create Alert]                                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 13. Discussion Thread
```
┌─────────────────────────────────────────────────────────────────────┐
│ Discussion: Sequoia Capital                    [Sort: Top ▼]       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  @founder_jane  2h ago                                             │
│  "Sequoia's AI thesis aligns well with our infra play. The        │
│  'Infrastructure → Middleware → Apps' framing helped us position." │
│  [👍 12] [Reply] [Flag]                                            │
│                                                                     │
│  ┌ @investor_mike  1h ago                                          │
│  │ "Agreed. Their portfolio density in foundation models is        │
│  │  unmatched. But watch for concentration risk — 3/5 latest     │
│  │  deals are foundation model layers."                           │
│  │  [👍 8] [Reply] [Flag]                                         │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  @researcher_alex  30m ago                                         │
│  "The inferred thesis shows 32% foundation models but that's       │
│  heavily weighted by OpenAI/xAI size. Count-wise it's 8/47 deals." │
│  [👍 5] [Reply] [Flag]                                             │
│                                                                     │
│  ─── Write a reply (Paid members only) ───                         │
│  [Markdown supported]                                               │
│  [Post]                                                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 14. Admin Source Registry
```
┌─────────────────────────────────────────────────────────────────────┐
│ Admin → Sources                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ [+ Add Source]  [Filter: Status ▼] [Search...]                     │
├─────────────────────────────────────────────────────────────────────┤
│ Source                  │ Method │ Status    │ Last Fetch │ Health │
├─────────────────────────┼────────┼───────────┼────────────┼────────┤
│ sequoia-capital-blog    │ RSS    │ ✅ Active │ 2 min ago  │ 100%   │
│ a16z-blog               │ RSS    │ ✅ Active │ 1 min ago  │ 100%   │
│ techcrunch-ai           │ RSS    │ ✅ Active │ 30 sec ago │ 98%    │
│ the-information         │ HTML   │ ⏸ Paused │ 2 days ago │ 0%     │
│ tavily-search           │ API    │ ✅ Active │ 1 hr ago   │ 45%    │
│ sebi-rss                │ RSS    │ ✅ Active │ 6 hr ago   │ 100%   │
│ yc-directory            │ HTML   │ ❌ Blocked │ Never      │ N/A    │
│                                                      [Pause] [Edit] │
└─────────────────────────────────────────────────────────────────────┘
```

### 15. Empty States
| Context | Message | Action |
|---------|---------|--------|
| Feed (no matches) | "No stories match your filters. Try broadening your topics or time range." | [Clear filters] |
| Feed (new user) | "Your personalized feed will appear here after onboarding." | [Complete onboarding] |
| Company profile (sparse) | "Limited public information available. We're tracking for updates." | [Follow for alerts] |
| Search no results | "No companies, investors, or events found for 'query'." | [Browse directory] |
| Trial expired | "Your 10-day trial has ended. Subscribe to continue." | [Subscribe $10/mo] |
| Discussion (trial) | "Upgrade to join the discussion. Read-only during trial." | [Subscribe] |

---

## Responsive Behavior Summary

| Component | xs (320) | sm (480) | md (640) | lg (1024) | xl (1280) |
|-----------|----------|----------|----------|-----------|-----------|
| Nav | Bottom bar | Bottom bar | Top bar | Top bar | Top bar |
| Feed | Dense list | Dense list | Dense list | Grid 2-col | Grid 3-col |
| Profile tabs | Accordion | Accordion | Tabs | Tabs | Tabs |
| Sidebar | Hidden (sheet) | Hidden (sheet) | Hidden (sheet) | Visible | Visible |
| Filters | Bottom sheet | Bottom sheet | Inline | Inline | Inline |
| Pattern card | Stack | Stack | Stack | Stack | Stack |
| Onboarding | Full screen | Full screen | Centered 480px | Centered 480px | Centered 480px |
| Paywall modal | Full screen | Full screen | Centered 480px | Centered 480px | Centered 480px |
| Discussion | Full width | Full width | Full width | 2/3 width | 2/3 width |

---

## Accessibility Requirements

- **Keyboard**: All interactive elements reachable; focus visible (`ring-2 ring-accent-blue`)
- **Screen readers**: Semantic HTML; ARIA labels for icon-only buttons; live regions for feed updates
- **Contrast**: WCAG AA minimum (4.5:1 text, 3:1 UI); verified badges meet 3:1
- **Motion**: `prefers-reduced-motion` respected; no auto-play animations
- **Zoom**: Layout functional at 200% zoom; no horizontal scroll

---

## Implementation Notes (Phase 1–2)

- Use **Tailwind CSS** with custom design tokens above
- **React Aria Components** or **Radix UI** for accessible primitives
- **React Hook Form** + **Zod** for onboarding/forms
- **TanStack Query** for server state; **Zustand** for client state (sidebar, modals)
- **next-themes** for dark mode (system preference default)
- **next/font** with Inter (Latin) + Noto Sans (Indic fallback)
- Components in `components/ui/` (atomic) → `components/features/` (composed)

---

## Next Steps

1. Review wireframes with stakeholders
2. Create Figma/Storybook prototypes for key flows (J-A, J-B, J-C)
3. Validate mobile usability with 5-user test
4. Finalize design tokens; generate Tailwind config
5. Begin Phase 1 implementation with shell + auth + onboarding