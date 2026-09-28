# Kargo Hiring Dashboard

Case 2 build: a shortlist Arjun can trust, scored against his own hire pattern (not the job spec),
with drafted interview briefs and candidate emails — nothing sends without a human click.

## What's here

- **Data**: 8 past-hire CVs (calibration set) + 50 applicant CVs, extracted from the provided drive
  folders and loaded into SQLite (`data/kargo.db`). Note: the case brief says "sixty applications" but
  the two drive folders you attached contain 50 applicant CVs total (30 unlabeled + 15 `pm_*` + 5
  `spm_*`) plus the 8 separate hire profiles — that's what's actually on disk, so that's what's loaded.
- **Pipeline** (`src/lib/pipeline.ts`): 4 Gemini Flash calls per candidate, matching the components map:
  1. **Score** — every criterion in `data/rubric.md` (Layer A pattern + Layer B role fit for both PM and
     SPM), with evidence citations and confidence, exactly as the rubric's JSON schema requires.
  2. **Guardrail / rank review** — a second Gemini pass that specifically hunts for the failure mode you
     asked to guard against: a candidate whose hire-pattern match is strong but whose mechanical
     composite lands in PASS only because of thin years of experience gets flagged `potential_flag` and
     bumped to REVIEW instead of being silently buried. It also catches the opposite failure — an
     INTERVIEW-tier score backed mostly by "low confidence" / "not evidenced" criteria gets held at
     REVIEW with a note that it needs a human sanity check. See `GUARDRAIL_SYSTEM_PROMPT` in
     `src/lib/rubric.ts` for the exact rules.
  3. **Interview brief** — one page, evidence-grounded, only generated for INTERVIEW/REVIEW tier.
  4. **Email drafts** — interview invite and/or rejection, drafted and stored as `status: drafted`.
     **Nothing ever sends automatically** — see "The Cut" below.
- **Dashboard** (`/`): ranked shortlist across both roles, tier/role/potential-flag filters.
- **Candidate page** (`/candidates/[id]`): full rubric breakdown per criterion with evidence, the
  interview brief, editable email drafts, a Send button that requires typed confirmation, and the
  human shortlist decision (Advance / Reject / Pending) — logged, not inferred.
- **Upload page** (`/upload`): drop new PDF/DOCX CVs in any time; they land as `pending` and get picked
  up by the next pipeline run.

## The Cut (from your slide, honored literally)

Arjun asked for auto-sent rejection/invite emails once he confirms. What's built is stricter than that
by one step, deliberately: **every** email — invite or rejection — is drafted by the pipeline and sits
in `status: drafted` until a human clicks Send on that specific candidate and confirms in the UI. There
is no bulk auto-send, including for PASS-tier rejections. This matches the checks you already
identified (a wrongly-rejected candidate has no recovery path) and it's also a hard rule on my side:
sending any message on a user's behalf always needs an explicit, per-action confirmation — I can't wire
up an auto-send even if asked to. The shortlist review, the confirm-to-send click, and the final hiring
call all stay yours.

## Setup

```bash
cd kargo-hiring
cp .env.example .env.local
# then edit .env.local:
#   GEMINI_API_KEY=...      (https://aistudio.google.com/apikey)
#   RESEND_API_KEY=...      (https://resend.com/api-keys)
```

Resend's free tier can only send from `onboarding@resend.dev` to the email address you signed up with,
until you verify a domain. `.env.example` defaults to that sandbox sender — fine for testing the full
flow, but candidates other than your own inbox won't actually receive anything until you verify a
domain and set `RESEND_FROM_EMAIL`.

Data is already extracted and loaded (`data/kargo.db` exists). If you ever need to redo it:

```bash
npm run extract   # re-extract text from data/resumes/**
npm run ingest    # load into SQLite (skips candidates already present)
```

## Run order

```bash
# 1. Calibration — required before trusting the scorer on real applicants (rubric section 8).
#    Checks all 5 "Exceeds" hires score pattern >= 85 and the rest score <= 45.
npm run calibrate

# 2. Score all 50 applicants (4 Gemini calls each — score, guardrail, brief, email drafts)
npm run pipeline
#    Options: -- --force (rescore everyone), -- --only=id1,id2 (specific candidates), -- --concurrency=N (default 3)

# 3. Dashboard
npm run dev
# open http://localhost:3000 (or whatever port you're running on)
```

If calibration fails, do not run step 2 — fix `SCORING_SYSTEM_PROMPT` / `buildScoringPrompt` in
`src/lib/rubric.ts` first, per the rubric's own instructions.

## Guardrails against burying a good candidate

Two are structural, in `runPipelineForCandidate` / the guardrail prompt, not just "be careful" advice:

1. **High-potential override** — pattern_score ≥ 80 with a PASS-tier composite caused by an experience
   gap (not weak evidence) → forced to REVIEW, flagged `potential_flag`, surfaced with a violet badge on
   both the dashboard and candidate page.
2. **Near-miss protection** — composite 50–55 with ≥2 high-confidence pattern criteria at 3-4 → same
   bump to REVIEW.
3. **Hollow-score check** (the inverse guardrail — protects against false positives, not just false
   negatives) — an INTERVIEW tier resting mostly on "low confidence"/"not evidenced" criteria gets held
   at REVIEW with a note, instead of going straight to an interview invite on thin evidence.

None of these ever downgrade a tier the rubric math already computed as INTERVIEW, and none of them
auto-advance anyone straight to INTERVIEW — the ceiling on an override is REVIEW, i.e. "put this in
front of Arjun," never "skip Arjun."

## Known limitations / things to sanity-check yourself

- PII scrubbing before the AI call strips email/phone/name/LinkedIn by regex; it deliberately does
  *not* strip employer or college names (needed as evidence context per the rubric), so the model is
  instructed not to weight those — verify this holds up by spot-checking a few `why_ranked_here` /
  evidence fields once you've run real scoring.
- Contact emails extracted from the CVs are all `squad_N@pg27.mesaschool.co` placeholders (synthetic
  case data) — real sending will only work once you verify a domain in Resend or test against your own
  inbox.
- Per the rubric's own "known data gaps" section: spot-check the top and bottom of the ranked list
  against your own read of a few CVs before trusting the ordering blindly.
