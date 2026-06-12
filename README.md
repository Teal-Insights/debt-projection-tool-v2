# Debt Projection Tool — Version 2

A working React app, sibling to v1 (`FT Tool`) with same methodology, but with **latest IMF WEO April 2026 data** and the **full WEO universe** (189 economies, 172 fully projectable).

## What's different from v1


| Item                      | v1 (FT Tool)                                | v2 (This One)                                        |
| ------------------------- | ------------------------------------------- | ---------------------------------------------------- |
| Data source               | FT 2014 bundle (= WEO Oct 2014, frozen)     | **IMF WEO April 2026** (latest)                      |
| Countries                 | Selected 5 (USA, UK, Japan, Greece, Mexico) | **189 in WEO; 172 with full defaults**               |
| Baseline year             | 2014                                        | **2026**                                             |
| Horizon                   | 2014–2019                                   | **2026–2031** (last year = last WEO projection year) |
| Baseline line on chart    | engine projection from defaults             | **WEO's own published debt path**                    |
| `realInterestRate` source | FT-bundled per-country                      | **Implicitly back-solved** from WEO debt path        |


## How the baseline line works

In **v1**, the blue "baseline" line on the chart was an engine projection using the country's default slider values. v2 changes this: the **baseline line is WEO's own published debt-to-GDP path**, drawn directly from `country.baselineProjection`. The user's amber projection line is still engine output — so at defaults the two lines may diverge for years 2027+.

**Why they diverge at defaults:** the engine applies constant 2026 slider values across all six projection years; WEO's actual path reflects different g/r/pb per year. The implicit `realInterestRate` is back-solved so that engine(defaults) ≈ WEO at **2026** — by design — but not at later years.

**What this means visually:** drag a slider and the amber line moves; the blue WEO baseline stays put. The difference is *"how does this scenario compare to WEO's view?"* At defaults, the gap shows the curvature WEO's year-varying assumptions add that a flat-default projection can't capture.

## How to run

```bash
cd debt-projection-tool-v2
npm install         # or: ln -s ../ddt-explorer/node_modules ./node_modules (faster)
npm run dev         # → http://localhost:5173
npm run build       # → dist/ ready for static deploy
```

## Layout

```
debt-projection-tool-v2/
├── README.md                        # this file
├── package.json                     # name: debt-projection-tool-v2, version: 2.0.0
├── vite.config.ts                   # inherited from v1
├── index.html                       # title: "Debt Projection Tool — Version 2"
├── src/
│   ├── App.tsx                      # v2-specific: builds baseline from WEO, filters null-r countries
│   ├── data/
│   │   └── countries.json           # 189 economies × 5 indicators + WEO baseline projection
│   ├── engine/                      # unchanged — same identity as v1
│   ├── narratives/                  # unchanged
│   ├── components/                  # unchanged
│   └── styles/
└── data/                            # raw WEO sources (audit)
    ├── weo-latest-base.json         # equivalent of src/data/countries.json
    ├── weo_latest.xlsx              # raw WEO download
    └── weo-extract-caveats.txt
```

## Dataset (src/data/countries.json)

189 economies from WEO April 2026 (197 in WEO; 8 dropped for missing 2025 debt-to-GDP). 172 of 189 have all five slider defaults populated; the other 17 (countries like Afghanistan, Lebanon, Venezuela) are filtered out at app load.

Per country:

- `historical`: 2022–2025 debt-to-GDP from WEO `GGXWDG_NGDP`
- `startingDebtPct`: 2025 (= last historical entry)
- `baselineYear`: 2026
- `baselineProjection`: WEO's own debt-to-GDP path 2026–2031 (drawn as the blue baseline line)
- `defaults.realGdpGrowth`: WEO `NGDP_RPCH` at 2026
- `defaults.primaryBalance`: WEO `GGXONLB_NGDP` at 2026
- `defaults.realInterestRate`: implicit (back-solved from WEO debt path at 2026; the standup's defensible approach)
- `defaults.realFxAppreciation`: 0 (WEO doesn't publish forward; curate in v3)
- `defaults.fcuShare`: 0 (WEO doesn't publish; curate from IMF Article IV in v3)

Spot-check (implicit r values, % per year):


| Country        | g 2026 | pb 2026 | r 2026 (implicit) |
| -------------- | ------ | ------- | ----------------- |
| United States  | +2.32  | −3.67   | **+0.86**         |
| United Kingdom | +0.80  | −1.23   | **+0.81**         |
| Japan          | +0.72  | −1.74   | **−1.19**         |
| Greece         | +1.80  | +3.78   | **−1.68**         |
| Mexico         | +1.64  | +1.60   | **+5.81**         |
| Türkiye        | +3.37  | −0.34   | **+10.95**        |
| Germany        | +0.79  | −2.83   | **−1.06**         |


