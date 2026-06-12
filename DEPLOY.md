# Deploy v2 to GitHub Pages

The repo is set up to auto-deploy on every push to `main` via GitHub Actions.
The workflow lives at `.github/workflows/deploy.yml` and uses the **native
GitHub Pages flow** (no `gh-pages` branch).

## One-time setup

### 1. Initialise the repo and push

From inside `debt-projection-tool-v2/`:

```bash
git init
git add .
git commit -m "Debt Projection Tool v2 — initial commit"
git branch -M main
git remote add origin git@github.com:<owner>/<repo-name>.git
git push -u origin main
```

Replace `<owner>` and `<repo-name>` with your GitHub username/org and the
repo's name. Recommended repo name: **`debt-projection-tool-v2`** (matches the
folder; clean URL `https://<owner>.github.io/debt-projection-tool-v2/`).

### 2. Enable GitHub Pages

In the repo on GitHub:

- **Settings → Pages**
- **Source:** *GitHub Actions* (not "Deploy from a branch")

That's it — the workflow will handle everything else.

### 3. Update `package.json` `homepage`

Edit the `homepage` field in `package.json` to match your actual URL:

```json
"homepage": "https://<owner>.github.io/<repo-name>/"
```

This is read by some tooling (e.g. `create-react-app` ecosystem) but isn't
required for Vite — it's good hygiene for npm metadata.

## What the workflow does

On every push to `main`:

1. Checkout the repo
2. Set up Node.js 20 with npm cache
3. `npm ci` — clean install of dependencies
4. `npm run build` with `VITE_BASE_PATH` set to `/<repo-name>/` (auto-derived
   from `github.event.repository.name`, so no hard-coding)
5. Upload `dist/` as a Pages artifact
6. Deploy to GitHub Pages

First deploy takes 1–2 minutes; subsequent pushes ~45 seconds.

## How the base path works

Vite needs to know what URL prefix the app will be served from. GitHub Pages
serves project sites at `/<repo-name>/`. The workflow sets `VITE_BASE_PATH`
to that value at build time, and `vite.config.ts` reads the env var.

For local dev (`npm run dev`), `VITE_BASE_PATH` is unset so Vite uses `./`
and the dev server works at `http://localhost:5173/` without a prefix.

For a custom domain, override at deploy time:

```yaml
# in .github/workflows/deploy.yml, build step
env:
  VITE_BASE_PATH: /
```

## After deploy: verifying

1. The workflow's `deploy` job will print the live URL — open it.
2. Sanity-check: the chart renders, the country selector opens, sliders work,
   the hover tooltip shows year details, narrative cards refresh on slider
   change.
3. Browser DevTools → Network: no 404s on assets (would indicate a base-path
   mismatch).
4. Browser DevTools → Console: no errors.

## Branch protection (optional but recommended)

In **Settings → Branches**, add a rule for `main`:

- Require a pull request before merging
- Require status checks to pass (select the `build` job)

This means the only way to deploy is through a PR that passes CI — a small
guardrail against pushing broken builds directly to `main`.

## Updating the dataset later

When IMF publishes a new WEO vintage (April 2027, October 2026, etc.):

1. Re-run the extraction (see `data/` folder + the engineering notes in
   `README.md`)
2. Replace `src/data/countries.json`
3. Update `_meta.source_vintage` and `_meta.extracted_date`
4. Push to `main` — the workflow auto-deploys the refreshed dataset

## Troubleshooting

**Workflow fails at `npm ci`:** usually a Node version mismatch. The workflow
pins Node 20; if you've added a `.nvmrc` or `engines` field that conflicts,
align them.

**404 on assets after deploy:** the base path didn't match the repo name.
Check the `VITE_BASE_PATH` env in the workflow and the actual repo URL.

**Pages source is wrong:** in repo settings, *Pages → Source* must be
*"GitHub Actions"*. If it's set to "Deploy from a branch", the workflow's
artifact upload won't be picked up.
