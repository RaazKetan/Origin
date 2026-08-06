# Origin Candidate Scoring — Design Spec

Status: **draft for review** · Owner: Ketan · Last updated: 2026-06-29

This is the design for Origin's candidate signal score. It is the contract the
implementation follows; code in `backend/app/services/scoring.py` should match
this doc, not the other way around.

---

## 1. Principles (non-negotiable)

1. **No fabricated points.** A signal earns points only from real, fetched, or
   user-verified data. We never invent a number to fill a slot. If we can't
   measure it, it is *unscored* — not zero, not guessed.
2. **Absence is neutral, never a penalty.** Per the rubric: Education is never a
   gate; Public presence is positive-only. Missing data must not drag a score
   down. This drives the normalization model in §3.
3. **Authenticity gates the core.** The 45-point GitHub block is multiplied by an
   authenticity factor (0–1). A cram-spike of solo "tutorial dump" repos right
   before applying scores far below organic history.
4. **Bias-aware by construction.** Documentation quality is English-biased →
   capped low and judged on presence/structure, not prose polish. Institution
   tier and company caliber are *soft* (small weight, never gating) because they
   proxy socioeconomic background. GPA is normalized across grading systems.
5. **Anti-gaming is cross-cutting.** Recency, growth slope, and consistency
   (§ Trajectory) exist to catch pre-application inflation, not to reward raw
   volume.
6. **Transparent to the candidate.** Every score shows its breakdown and, for
   unscored signals, *what to add* to raise the ceiling.

---

## 2. The rubric (100 points)

```
GitHub code & contributions ............ 45   × authenticity gate (0–1)
  Best repo (the ceiling) .............. 25
    difficulty / ambition tier .......... 8
    code quality & structure ............ 6
    tests + CI .......................... 4
    builds/runs or deployed ............. 3
    documentation (capped, bias-aware) .. 2
    commit-history quality (this repo) .. 2
  External contributions ............... 15
    merged PRs into others' repos ....... 9   (weighted by project significance + review depth)
    code review / issues on others' .... 3
    collaboration in own repos .......... 3   (multi-contributor, PR-based, not solo dumps)
  Breadth ............................... 5
    language/stack range ................ 3
    substantive non-fork repos .......... 2   (diminishing returns)

Internship / work experience ........... 20
  existence + duration (weighted) ....... 8
  verified scope / shipped real ........ 5
  team/company caliber (soft) .......... 4
  engineering substance of role ........ 3

Verifiable competitive signals ......... 15
  CP rating, contest-verified .......... 8   (Codeforces / LeetCode)
  domain contests ...................... 4   (Kaggle ML, CTF security)
  hackathon wins (inflation-discounted)  3

Education (never a gate) ............... 10
  GPA / standing (normalized) .......... 4
  institution tier (soft) .............. 3
  relevant coursework (if corroborated)  2
  academic honors ...................... 1

Public technical presence (positive-only) 5
  substantive blog / writeups .......... 2
  talks / conference / meetup .......... 1
  Stack Overflow reputation ............ 1
  community contributions used ......... 1

Trajectory / recency (anti-gaming) ...... 5
  recency, last 12 months weighted ..... 2
  growth slope (repos getting harder) .. 2
  consistency vs. cram spike ........... 1
```

---

## 3. Normalization model (the key decision)

The hard part: a strong-GitHub candidate with no linked LeetCode/work history
must not be punished for data we simply never collected. We separate signals
into three roles:

- **CORE (gated):** GitHub block (45). Requires a GitHub account (a signup
  requirement), so it is essentially always assessable. Multiplied by the
  authenticity gate.
- **CREDENTIAL (contributes when present, neutral when absent):** Work (20),
  Education (10).
- **BONUS (additive, never subtracts):** Competitive (15), Public presence (5),
  Trajectory (5).

### Two numbers, both honest

We compute and store two values:

1. **`signal_score` (0–100, the headline).** The candidate's points, but the
   denominator is the **assessable max** — the sum of weights for signals we
   could actually evaluate for *this* candidate. Missing signals leave both
   numerator and denominator, so absence neither adds nor subtracts.

   ```
   signal_score = round(100 * Σ awarded_points(assessable) / Σ weight(assessable))
   ```

2. **`coverage` (0–100%).** How much of the full 100-pt rubric we could assess.
   Drives the candidate-facing nudge ("link LeetCode + add work history to
   raise your ceiling"). Low coverage never lowers `signal_score`; it just flags
   that the score rests on fewer signals.

`portfolio_rank` is derived from `signal_score` (normalized), so absence of
optional data does not change the rank — satisfying "never a gate."

**Worked example.** Candidate with GitHub (authenticity 0.9) + education, nothing
else linked:
- Assessable = GitHub (45) + Education (10) = 55 max.
- Earns, say, 30 of 45 GitHub × 0.9 = 27, and 7 of 10 education = 7 → 34 points.
- `signal_score = round(100 * 34 / 55) = 62` → "Advanced".
- `coverage = 55%`, with "Add work history, link Codeforces" surfaced.

This is the recommended model. **Open question O1** (§8) records the alternative
(absolute out-of-100) if you'd rather the headline number be harsh about gaps.

### Unscored handling

Each leaf returns one of:
- `awarded: float` (0..weight) — assessed, real.
- `UNSCORED` — no data; excluded from both numerator and denominator; listed in
  the breakdown as "not yet measured — needs X".

A leaf is **never** silently `0`. Zero is reserved for "assessed and genuinely
absent" (e.g. we fetched the repo, there is no CI → tests+CI scores 0 of 4).

---

## 4. Per-signal spec: formula · source · status

Legend for **status**: 🟢 computable from data we already store · 🟡 needs a new
GitHub API call we don't make yet · 🔴 needs a new user-supplied + verified input.

### 4.1 GitHub — Best repo (25)

The "ceiling" = the candidate's single best repo, not an average (one excellent
project beats ten toy repos). Pick the best repo per the difficulty×quality
product, then score its facets.

| Leaf | w | Formula | Source | Status |
|---|---|---|---|---|
| difficulty / ambition | 8 | LLM tier 1–8 from README + file tree + languages + dependency manifest. Rubric anchored (CRUD app=2, distributed system/compiler/ML-from-scratch=7–8). | Gemini on richer repo context | 🟡 (need file tree) |
| code quality & structure | 6 | LLM judgment on sampled source files (module layout, naming, dup, error handling). | sampled file contents | 🟡 (need file fetch) |
| tests + CI | 4 | 2 pts test dir / test files present; 2 pts CI workflow (`.github/workflows`, etc.). | repo tree | 🟡 |
| builds / deployed | 3 | homepage/`homepage` field set, deploy badges, or Dockerfile/CI deploy step. | repo metadata + tree | 🟡 |
| documentation | 2 | README length + section structure (has install/usage/etc.). Capped; prose quality ignored (bias). | README (have) | 🟢 |
| commit-history quality | 2 | non-trivial commit count, message quality sample, spread over time (not one dump). | repo commits API | 🟡 |

### 4.2 GitHub — External contributions (15)

| Leaf | w | Formula | Source | Status |
|---|---|---|---|---|
| merged PRs to others' repos | 9 | `is:pr author:X is:merged`, drop own repos. Weight each by target repo stars (log-scaled) × whether it had review. Diminishing returns. | GitHub Search API | 🔴/🟡 |
| review / issues on others' | 3 | reviews given + non-trivial issues opened on repos not owned. | GitHub Search API | 🟡 |
| collaboration in own repos | 3 | own repos with >1 contributor and PR-based flow (not direct-to-main solo dumps). | repo contributors API | 🟡 |

### 4.3 GitHub — Breadth (5)

| Leaf | w | Formula | Source | Status |
|---|---|---|---|---|
| language/stack range | 3 | distinct primary languages across non-fork repos, capped (e.g. 5+ → full). | `top_languages` + per-repo (have) | 🟢 |
| substantive non-fork repos | 2 | count of non-fork repos above a size/commit floor, `log`-damped. | repo list metadata | 🟡 (have urls, need fork flag + size) |

### 4.4 Authenticity gate (multiplier on the 45)

Output ∈ [0,1], multiplies the entire GitHub block. Starts at 1.0; subtract for:
- contribution spike concentrated in the weeks before signup (`contribution_grid` shape). 🟢
- repos all created in a tight window, no history. 🟡
- all repos solo + direct-to-main + near-identical (tutorial dumps). 🟡
- account age vs. claimed activity mismatch. 🟡

Floor at ~0.3 (never fully zero out a real account on heuristics alone).

### 4.5 Internship / work experience (20)

| Leaf | w | Source | Status |
|---|---|---|---|
| existence + duration | 8 | resume work-history (NEW extraction field) | 🔴 (resume parser doesn't extract this yet) |
| verified scope / shipped | 5 | resume + corroboration via GitHub org / references | 🔴 |
| team/company caliber (soft) | 4 | company name → soft tier table; small weight, never gating | 🔴 |
| engineering substance of role | 3 | LLM read of role bullet points | 🔴 |

### 4.6 Verifiable competitive signals (15)

| Leaf | w | Source | Status |
|---|---|---|---|
| CP rating | 8 | Codeforces public API (`user.rating`); LeetCode via unofficial endpoint. User links handle, we verify. | 🔴 |
| domain contests | 4 | Kaggle tier API, CTFtime profile. | 🔴 |
| hackathon wins | 3 | user-claimed + link; inflation-discounted; partial credit without proof. | 🔴 |

### 4.7 Education (10) — never a gate

| Leaf | w | Formula | Source | Status |
|---|---|---|---|---|
| GPA / standing | 4 | normalize to 0–1 across `/4`, `/10`, `%`, classifications; map to pts. | `college_gpa` (have) | 🟢 |
| institution tier (soft) | 3 | soft lookup table; unknown institution = mid, never 0. | `college_name` (have) | 🟢 |
| relevant coursework | 2 | only if corroborated (resume + repos in that domain). | resume | 🟡 |
| academic honors | 1 | from `awards` (filter academic). | `awards` (have) | 🟢 |

### 4.8 Public technical presence (5) — positive-only

| Leaf | w | Source | Status |
|---|---|---|---|
| blog / writeups | 2 | user-linked URL, LLM substance check | 🔴 |
| talks | 1 | user-linked | 🔴 |
| Stack Overflow rep | 1 | SO API by linked profile | 🔴 |
| community contributions used | 1 | npm/PyPI ownership, popular gist, etc. | 🔴 |

### 4.9 Trajectory / recency (5) — anti-gaming

| Leaf | w | Formula | Source | Status |
|---|---|---|---|---|
| recency | 2 | activity in last 12 months from `contribution_grid`, recent-weighted. | have | 🟢 |
| growth slope | 2 | repo difficulty vs. `created_at` — are newer repos harder? | repo created_at + difficulty | 🟡 |
| consistency vs cram | 1 | even spread vs. single pre-application spike. | `contribution_grid` | 🟢 |

---

## 5. What's computable today

Summing 🟢 leaves: documentation (2), breadth/language-range (3), GPA (4),
institution (3), academic honors (1), recency (2), consistency (1), plus the
`contribution_grid`-based parts of the authenticity gate.

**≈ 16 points of directly-real signal now, plus the authenticity multiplier.**
Everything else is 🟡 (one more GitHub fetch) or 🔴 (new user input + verifier).

The normalization in §3 means a candidate assessed only on these still gets a
fair `signal_score` out of their assessable max, with low `coverage` nudging
them to link more.

---

## 6. Data we must start collecting

**New GitHub fetches (unlocks most 🟡):**
- per-repo file tree (`GET /repos/{o}/{r}/git/trees/{branch}?recursive=1`)
- sampled source files for quality read
- repo commits (`GET /repos/{o}/{r}/commits`)
- repo metadata: `fork`, `size`, `homepage`, `stargazers_count`, contributors
- search: merged PRs + reviews authored by the user

Cost note: these are per-repo and rate-limited. Use the user's own OAuth token
(their 5k/hr) as already done for the contribution grid; cache aggressively.

**New user inputs (unlocks 🔴), each with a verifier:**
- work history (extend resume parser schema + manual edit)
- Codeforces / LeetCode / Kaggle / CTFtime handles
- blog / talks / Stack Overflow / package-registry links

**New model columns:** `work_experience (json)`, `competitive_handles (json)`,
`public_links (json)`, plus a cached `score_breakdown (json)` so the UI can show
the per-leaf detail without recomputing.

---

## 7. Phased rollout

- **Phase 1 — rubric engine + real ~16.** Config-driven scorer matching §2–§4,
  implements all 🟢 leaves + authenticity-from-grid, normalization per §3,
  `score_breakdown` persisted, UI shows breakdown + "unscored" list. No fakes.
- **Phase 2 — GitHub deep fetch.** Adds the 🟡 leaves (best-repo facets,
  external PRs, collaboration, growth slope). Biggest single unlock (~40 pts).
- **Phase 3 — linked credentials.** Onboarding inputs + verifier services for
  work / competitive / public presence (the 🔴 leaves).

Each phase is independently shippable; `signal_score` stays honest at every
step because unmeasured signals are excluded from the denominator, not zeroed.

---

## 8. Open questions

- **O1 — headline number.** Recommended: normalized over assessable max (§3).
  Alternative: absolute out of 100 (harsh about gaps, simpler to explain, but
  penalizes missing optional data — conflicts with "never a gate"). Pick one.
- **O2 — best-repo selection.** Difficulty×quality product vs. a learned
  weighting. Start with the product.
- **O3 — authenticity floor.** 0.3 proposed. Too lenient / too harsh?
- **O4 — institution & company tiers.** Who maintains the soft lookup tables,
  and how do we keep them from becoming elitism vectors? Proposal: tiny, mostly
  flat, capped at their small weights.
- **O5 — re-score cadence.** On profile edit + a periodic refresh? GitHub data
  goes stale; commit a TTL like the contribution grid (6h+).
