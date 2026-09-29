# Kargo Hiring Dashboard

Case 2 build: a shortlist Arjun can trust, scored against his own hire pattern (not the job spec),
with drafted interview briefs and candidate emails.

Live: https://kargo-hiring-two.vercel.app (HTTP Basic Auth protected — ask the project owner for the
password).

## What's here

- **Data**: 8 past-hire CVs (calibration set) + 50 applicant CVs, extracted from the provided drive
  folders and loaded into Postgres (Neon). Note: the case brief says "sixty applications" but the two
  drive folders you attached contain 50 applicant CVs total (30 unlabeled + 15 `pm_*` + 5 `spm_*`) plus
  the 8 separate hire profiles — that's what's actually on disk, so that's what's loaded.
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
  3. **Interview brief** — short and decision-focused, evidence-grounded, only generated for
     INTERVIEW/REVIEW tier. Every line has to map to a specific PM/SPM job-description requirement or
     it doesn't make the cut — this is meant to be scanned in ten seconds, not read like a report.
  4. **Email drafts** — interview invite and/or rejection, written to sound like Arjun actually typed
     them (no em dashes, no AI-assistant stock phrases, contractions welcome) rather than an AI-generated
     template. See "Sending" below for how they go out.
  Scoring/guardrail and brief/emails are split into two separate API-callable stages
  (`runScoreStage` / `runFinishStage`) so evaluating a candidate from the browser never risks hitting a
  serverless function's execution-time limit.
- **Dashboard** (`/`): ranked shortlist across both roles, tier/role/potential-flag filters, an animated
  stats strip, skeleton loading and staggered row entrance.
- **Pipeline board** (`/pipeline`): a Kanban view of every scored candidate grouped by decision — Needs
  review / Advancing / Declined — with one-click Advance/Reject/Undo per card.
- **Candidate page** (`/candidates/[id]`): full rubric breakdown per criterion with evidence, the
  interview brief, editable email drafts with a manual Send button, and the human shortlist decision
  (Advance / Reject / Pending).
- **Upload page** (`/upload`): drop new PDF/DOCX CVs in any time. Each one is scored automatically right
  after upload (calls the same two-stage pipeline as the CLI script) with a live per-file progress list.

## Sending emails

Advancing or rejecting a candidate (on their page or from the pipeline board) **sends that candidate's
email immediately** — the interview invite on Advance, the rejection on Reject — no separate
confirmation step. If the matching email hasn't been drafted yet (e.g. you advance a PASS-tier candidate
by hand), one is generated on the spot before sending.

This was a deliberate, explicit choice by the project owner, made after being told what it removes: the
app's original design required a manual click on the email draft itself before anything went out,
specifically so a wrong rejection couldn't go out by accident. That manual Send button still exists on
the candidate page for ad-hoc sends, edits, or resending, but the decision buttons no longer wait for it.
Re-clicking Advance/Reject on an already-sent candidate is a safe no-op — it won't send a duplicate.

## Setup

```bash
cd kargo-hiring
cp .env.example .env.local
# then edit .env.local:
#   GEMINI_API_KEY=...      (https://aistudio.google.com/apikey)
#   RESEND_API_KEY=...      (https://resend.com/api-keys)
#   DATABASE_URL=...        (Neon Postgres connection string, pooled)
#   SITE_PASSWORD=...       (HTTP Basic Auth gate for a deployed instance; leave unset for open local dev)
```

Resend's free tier can only send from `onboarding@resend.dev` to the email address you signed up with,
until you verify a domain. `.env.example` defaults to that sandbox sender — fine for testing the full
flow, but candidates other than your own inbox won't actually receive anything until you verify a domain
and set `RESEND_FROM_EMAIL`.

Data is already extracted and loaded into the project's Neon database. If you ever need to redo it from
scratch (e.g. a fresh database):

```bash
npm run extract   # re-extract text from data/resumes/** into data/extracted/*.json
npm run ingest    # load into Postgres (skips candidates already present)
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

After changing the email prompt specifically (tone, formatting rules), you don't need to re-score
everyone — just re-draft:

```bash
npm run redraft-emails   # regenerates drafted (not yet sent) invite/rejection emails only
```

## Deployment

Hosted on Vercel, database on Neon, both linked to the `master` branch of this repo. To redeploy:

```bash
npx vercel@latest deploy --prod --yes
```

Environment variables live in the Vercel project settings (`vercel env ls` / `vercel env add`), mirrored
from `.env.local`. The whole site sits behind `middleware.ts`, which gates every route with HTTP Basic
Auth when `SITE_PASSWORD` is set — this dashboard holds real candidate names, emails, and drafted
rejection/interview content, so it's never left open by default.

## Guardrails against burying a good candidate

Two are structural, in `runScoreStage` / the guardrail prompt, not just "be careful" advice:

1. **High-potential override** — pattern_score ≥ 80 with a PASS-tier composite caused by an experience
   gap (not weak evidence) → forced to REVIEW, flagged `potential_flag`, surfaced with a violet badge on
   the dashboard, pipeline board, and candidate page.
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
- Because Advance/Reject sends immediately, a wrong click now sends a real email with no undo. The
  "Undo" button on the pipeline board resets the decision back to pending for your own tracking, but it
  cannot un-send an email that already went out.
