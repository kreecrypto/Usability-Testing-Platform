# MT-11 Results capability UX — 2026-09-26

Status: QA. Source: current Google Sheet Task List row 104. Base: main dcd4874 (MT-09 provenance and Cloudflare retirement included).

The Results overview and task cards now consume the same Metric Observations as Report. Each metric shows Available, Partial, Unsupported, or No Data; numeric zero appears only for Available metrics with a supported denominator/sample and source evidence. Cards retain sample, numerator/denominator, technical blocks, target provider/snapshot, exact test version, metric/aggregation/rule versions, and evidence IDs behind a disclosure. Unsupported path, heatmap, and funnel views do not render a chart or a synthetic zero. The friction summary also waits for supported capability and evidence.

Validation: npm ci, production build, typecheck, 280/280 tests, design-system check, and high-fi check passed locally. Regression tests cover supported zero, missing data, Partial, and Unsupported presentation. There is no lint script. Real published-study Results browser review, mobile/desktop and Researcher UAT remain pending because production has no published test/session/event rows and researcher auth access is unresolved. Do not classify COMPLETE from this local QA alone.
