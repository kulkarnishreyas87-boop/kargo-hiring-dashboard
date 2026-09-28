# Kargo Hiring Dashboard — Candidate Scoring Rubric

Version 1.0 · Case 2 (MESA C4) · Roles: Product Manager (PM), Senior Product Manager (SPM)

This file is the single source of truth for the "Scores candidate against PM and SPM rubrics" step
in the components map. Every CV is scored against BOTH roles. The system recommends; Arjun decides.
No email is ever sent without Arjun clicking send.

---

## 1. Scoring formula

- Every criterion is scored on an integer scale of 0–4.
- Layer score = sum(criterion_score × weight) / 4 × 100  → range 0–100
- COMPOSITE (per role) = 0.60 × PATTERN_SCORE + 0.40 × ROLE_SCORE
- PATTERN_SCORE is the same for both roles. ROLE_SCORE is computed separately for PM and SPM.
- Round final scores to 1 decimal place.

## 2. Recommendation tiers (applied to the composite for each role)

| Composite | Tier       | Drafts generated                                   |
|-----------|------------|----------------------------------------------------|
| >= 75     | INTERVIEW  | Interview invite + interview brief                 |
| 55 – 74.9 | REVIEW     | Interview invite AND rejection (Arjun chooses)     |
| < 55      | PASS       | Respectful rejection                               |

- recommended_role = the role with the higher composite.
- If recommended_role != applied_role, set flag `reroute_suggested = true`.
- Ranking on the dashboard: by best composite, descending.

---

## 3. Layer A — Hire Pattern (60% of composite, same for PM and SPM)

Derived from Arjun's 8 past hires. All 5 "Exceeds Expectations" hires share these traits;
the "Meets" and "Below" hires do not.

### P1. Ground-level operations exposure — weight 0.40
Hands-on work inside freight forwarding, 3PL, port, CHA, customs, carrier or warehouse operations.
- 4: 2+ years hands-on operations. Names real documents (Bill of Lading, Shipping Bill, Certificate of Origin, DO, LC sets), real counterparties (CHA, customs, shipping lines, terminals, carriers) and real volumes.
- 3: 1–2 years hands-on operations, OR a daily customer-facing logistics role with direct shipment involvement.
- 2: Under 1 year hands-on, OR sustained on-site field time (ports, warehouses, forwarder offices) while in a product/engineering role.
- 1: Desk-only logistics exposure — building API integrations with logistics providers, selling or marketing to logistics firms, supply chain analytics without operations.
- 0: No logistics or operations exposure.
RULE: The word "logistics" on a CV is NOT evidence. Desk-only exposure caps at 1.

### P2. Built unasked, adopted by peers — weight 0.25
- 4: Spotted a problem nobody assigned, built a fix, and it was adopted beyond their own team or became a standard / core feature.
- 3: Self-initiated fix adopted by their own team.
- 2: Self-initiated with no adoption evidence, OR adopted but it was assigned work.
- 1: Built only what was assigned.
- 0: No evidence.

### P3. Ownership without a layer — weight 0.20
- 4: Sole owner — no manager, senior, or intermediary layer between them and the outcome. Made the calls.
- 3: Primary owner with light oversight.
- 2: Owned features/accounts inside a structured team with seniors above.
- 1: Supporting role ("supported", "assisted", one member of a large team).
- 0: No evidence.

### P4. Holds under operational pressure, closes the loop — weight 0.15
- 4: A specific incident — acted in the moment, resolved it, AND fixed or documented the root cause (post-mortem, process change).
- 3: A specific incident handled with a clear resolution.
- 2: General claims of speed or reliability with no specific incident.
- 1: Vague mention only.
- 0: No evidence.

---

## 4. Layer B — Role Fit (40% of composite, from the JDs)

Generic anchors for every Layer B criterion:
- 4: Specific, quantified evidence that directly matches the criterion.
- 3: Clear evidence, partly quantified or slightly adjacent.
- 2: Partial or adjacent evidence.
- 1: Weak or implied only.
- 0: Absent.

### 4a. Product Manager (PM) — ROLE_SCORE_PM

| ID  | Criterion | Weight | What a 4 looks like |
|-----|-----------|--------|---------------------|
| PM1 | Ships in short cycles with unprompted adoption | 0.30 | Multiple features shipped with usage/adoption numbers, not just "launched" |
| PM2 | Shipped, killed, learned | 0.25 | Names features stopped because of data, and what capacity went to instead |
| PM3 | Discovery inside customer workflows | 0.25 | Discovery done in the customer's operations (on-site, live workflow), led to a pivot with measured impact |
| PM4 | Built PM rhythms from zero | 0.20 | Created prioritisation, sprint, template or decision processes where none existed, in an early-stage setting |

### 4b. Senior Product Manager (SPM) — ROLE_SCORE_SPM

| ID   | Criterion | Weight | What a 4 looks like |
|------|-----------|--------|---------------------|
| SPM1 | Integration / platform / data-layer ownership | 0.30 | Owned integrations with carrier systems, port portals, ERP/FMS or external APIs; wrote API docs or integration standards |
| SPM2 | Owned an area with no senior PM above; architectural calls | 0.25 | Made build vs configure vs don't-touch decisions with long-term consequences, and owned the results |
| SPM3 | Integrations tied to revenue; cross-functional | 0.20 | An integration unblocked a deal or opened a segment; worked across sales, engineering and customer success |
| SPM4 | Early-stage / unwritten rules; shaped practice | 0.15 | Operated at an early-stage company and defined how the function works |
| SPM5 | Reliability and data-quality standards | 0.10 | Set or enforced uptime, data-quality or incident standards customers rely on |

### 4c. Experience bands (FLAG ONLY — never scored, never a rejection reason)
- PM: 2–4 years product management → `experience_band_pm: in | below | above`
- SPM: 5–8 years product management → `experience_band_spm: in | below | above`

---

## 5. Evidence rules (mandatory for the AI step)

1. Every criterion score must cite the exact CV line it relies on (`evidence` field).
2. No evidence → score 0 and `evidence: "not evidenced"`. Never infer or assume.
3. Any criterion scored 2 or 3 must produce one probe question for the interview brief.
4. Each criterion carries `confidence: high | medium | low`.
5. Do not reward CV length, polish, or number of buzzwords.

## 6. Excluded from scoring (strip before sending to the AI where possible; never score)

Name · gender · age / date of birth · photo · email · phone · address · marital status ·
college name or tier · certifications (Product School, Reforge, etc.) · conference talks ·
employer brand names.

Location / Mumbai relocation: never scored. Add to probes as "Confirm willingness to work in-office in Mumbai."

---

## 7. Required output per candidate (JSON)

```json
{
  "candidate_id": "string",
  "applied_role": "PM | SPM",
  "pattern": {
    "P1": {"score": 0, "evidence": "string", "confidence": "high|medium|low"},
    "P2": {"score": 0, "evidence": "string", "confidence": "high|medium|low"},
    "P3": {"score": 0, "evidence": "string", "confidence": "high|medium|low"},
    "P4": {"score": 0, "evidence": "string", "confidence": "high|medium|low"},
    "pattern_score": 0.0
  },
  "role_pm":  {"criteria": {"PM1": {}, "PM2": {}, "PM3": {}, "PM4": {}}, "role_score": 0.0, "composite": 0.0, "tier": "INTERVIEW|REVIEW|PASS"},
  "role_spm": {"criteria": {"SPM1": {}, "SPM2": {}, "SPM3": {}, "SPM4": {}, "SPM5": {}}, "role_score": 0.0, "composite": 0.0, "tier": "INTERVIEW|REVIEW|PASS"},
  "recommended_role": "PM | SPM",
  "reroute_suggested": false,
  "experience_band_pm": "in|below|above",
  "experience_band_spm": "in|below|above",
  "why_ranked_here": "2–3 sentences in plain English",
  "probes": ["string"]
}
```

Scores in `criteria` objects follow the same shape as the pattern criteria:
`{"score": 0, "evidence": "string", "confidence": "high|medium|low"}`.

---

## 8. Calibration set (regression test — run before scoring the 60 applications)

Expected Pattern Layer scores for Arjun's past hires. Acceptance test: all "Exceeds" hires
must score >= 85 and all others must score <= 45. If not, fix the prompt before scoring applicants.

| Hire (CV file)                 | Rating  | P1 | P2 | P3 | P4 | Pattern |
|--------------------------------|---------|----|----|----|----|---------|
| cv_01_rohan_desai              | Exceeds | 4  | 4  | 4  | 4  | 100     |
| cv_02_sunita_krishnamurthy     | Exceeds | 4  | 4  | 4  | 4  | 100     |
| cv_07_lavanya_iyer             | Exceeds | 4  | 4  | 4  | 4  | 100     |
| cv_06_meghna_tiwari            | Exceeds | 4  | 4  | 3  | 4  | 95      |
| cv_04_aditya_shetty            | Exceeds | 4  | 3  | 4  | 3  | 90      |
| cv_05_preetham_rao             | Below   | 1  | 2  | 1  | 3  | 38.75   |
| cv_08_rahul_bose               | Meets   | 0  | 2  | 4  | 1  | 36.25   |
| cv_03_vikram_nair              | Meets   | 0  | 3  | 1  | 1  | 27.5    |

Key contrast pairs the scorer must get right:
- Rohan vs Preetham: near-identical tech stacks. Rohan has 3 years of port/CHA operations (P1 = 4); Preetham has logistics API integrations only (P1 = 1).
- Lavanya vs Vikram: both PMs with the same certification. Lavanya is ops-native and a sole PM; Vikram is credential-heavy inside a 4-person PM team.

Known limitation: the rubric separates "Exceeds" from everyone else; it does not separate
"Meets" from "Below". This is intended — the goal is to find people who look like the best hires.

## 9. Known data gaps

- Hire profiles (interview notes, outcome lines) were not available; calibration uses CVs only.
- Current tenure / attrition of past hires is not in the ratings table.
- Sample is 8 hires (5 positive, 2 PMs). Spot-check the top and bottom of the ranked 60 with Arjun before trusting the ordering.
