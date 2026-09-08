"use client";

import { useMemo, useState } from "react";
import screenMap from "../../../docs/design-system/screen-component-map.json";
import "./high-fi.css";

type Screen = (typeof screenMap.screens)[number];
type Viewport = "desktop" | "mobile";
type StateTone = "neutral" | "loading" | "error" | "restricted" | "unsupported" | "empty" | "warning" | "success";

const screens = screenMap.screens as Screen[];
const totalStates = screens.reduce((sum, screen) => sum + screen.states.length, 0);
const researcherNav = ["Projects", "Tests", "Results", "Participants", "Settings"];

function stateKind(state: string): StateTone {
  const value = state.toLowerCase();
  if (["loading", "connecting", "checking", "processing", "buffering", "validating", "accepting", "reconnect"].some((token) => value.includes(token))) return "loading";
  if (["error", "invalid", "conflict", "failed"].some((token) => value.includes(token))) return "error";
  if (["restricted", "permission denied", "redacted"].some((token) => value.includes(token))) return "restricted";
  if (["unsupported", "provider blocked"].some((token) => value.includes(token))) return "unsupported";
  if (["empty", "no data", "no clicks", "no path", "no baseline", "no eligible"].some((token) => value.includes(token))) return "empty";
  if (["warning", "low sample", "blocked", "timeout", "timed out", "give up"].some((token) => value.includes(token))) return "warning";
  if (["pass", "ready", "complete", "published", "connected", "valid", "success"].some((token) => value.includes(token))) return "success";
  return "neutral";
}

function StateNotice({ state }: { state: string }) {
  const kind = stateKind(state);
  const copy: Record<StateTone, string> = {
    neutral: "Selected V1 state. The screen keeps the task context and next action explicit.",
    loading: "Loading keeps existing context visible and prevents duplicate actions.",
    error: "The problem is stated next to a recovery action and entered context is preserved.",
    restricted: "Permission or privacy restrictions are explicit; restricted evidence is never approximated.",
    unsupported: "Provider evidence is unavailable for this capability, so the UI does not fabricate a result.",
    empty: "No eligible content is available. No Data remains unavailable instead of becoming zero.",
    warning: "This condition needs review before continuing and stays separate from usability failure.",
    success: "Required checks are satisfied for this review state.",
  };

  return (
    <div className={`stateNotice stateNotice--${kind}`} role={kind === "error" ? "alert" : "status"}>
      <div><span className="stateDot" aria-hidden="true" /><strong>{state}</strong></div>
      <p>{copy[kind]}</p>
    </div>
  );
}

function ReviewButton({ children, disabled = false, variant = "primary" }: { children: React.ReactNode; disabled?: boolean; variant?: "primary" | "secondary" | "danger" }) {
  return <button type="button" disabled={disabled} className={`hfButton hfButton--${variant}`}>{children}</button>;
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="metricCard"><span className="metricLabel">{label}</span><strong className="metricValue">{value}</strong><span className="metricDetail">{detail}</span></article>;
}

function EmptyState({ title }: { title: string }) {
  return <section className="emptyState"><div className="emptyIcon" aria-hidden="true">○</div><h3>{title}</h3><p>There is no eligible evidence for this state.</p><ReviewButton variant="secondary">Return to overview</ReviewButton></section>;
}

function Skeleton() {
  return <div className="skeletonStack" aria-label="Loading"><span /><span /><span /><span /></div>;
}

function Heatmap() {
  return (
    <div className="heatmapMock" aria-label="Heatmap review placeholder">
      <span style={{ left: "22%", top: "30%", width: 18, height: 18 }} />
      <span style={{ left: "52%", top: "44%", width: 28, height: 28 }} />
      <span style={{ left: "73%", top: "64%", width: 14, height: 14 }} />
      <div className="heatLegend"><span>Low</span><i /><i /><i /><i /><i /><span>High</span></div>
    </div>
  );
}

function RetestComparison() {
  return (
    <section className="comparisonGrid" aria-label="Retest comparison">
      <div className="compareColumn"><span className="eyebrow">Baseline · v3</span><MetricCard label="Completion" value="77%" detail="17 / 22 eligible" /><MetricCard label="Median time" value="42s" detail="n=17 successes" /></div>
      <div className="deltaColumn"><strong>+11 pp</strong><span>Completion</span><strong>−9s</strong><span>Median time</span></div>
      <div className="compareColumn"><span className="eyebrow">Retest · v4</span><MetricCard label="Completion" value="88%" detail="22 / 25 eligible" /><MetricCard label="Median time" value="33s" detail="n=22 successes" /></div>
    </section>
  );
}

function ResearcherShell({ screen, children }: { screen: Screen; children: React.ReactNode }) {
  return (
    <div className="appFrame">
      <aside className="appSidebar">
        <div className="axaMark" aria-label="UT Platform">UT<span>•</span></div>
        <nav aria-label="Primary navigation">{researcherNav.map((item, index) => <a key={item} href="#" className={index === 0 ? "sideNavItem isActive" : "sideNavItem"}>{item}</a>)}</nav>
      </aside>
      <div className="appMain">
        <header className="appTopbar"><div><span className="crumb">Usability Testing Platform / V1</span><strong>{screen.id} · {screen.name}</strong></div><ReviewButton variant="secondary">Preview</ReviewButton></header>
        <main className="screenCanvas">{children}</main>
      </div>
    </div>
  );
}

function ScreenContent({ screen, state }: { screen: Screen; state: string }) {
  const kind = stateKind(state);
  if (kind === "loading") return <ResearcherShell screen={screen}><StateNotice state={state} /><Skeleton /></ResearcherShell>;
  if (kind === "empty") return <ResearcherShell screen={screen}><StateNotice state={state} /><EmptyState title={`No eligible data for ${screen.name}`} /></ResearcherShell>;

  return (
    <ResearcherShell screen={screen}>
      <div className="pageIntro"><div><span className="eyebrow">Researcher · {screen.id}</span><h1>{screen.name}</h1><p>High-fidelity review mapped to the canonical screen inventory and selected state.</p></div><span className="versionPill">Draft v3</span></div>
      <StateNotice state={state} />
      {screen.id === "S25" ? <section className="panel"><h2>Heatmap</h2><p>Canonical-coordinate review surface with explicit unsupported/no-data handling.</p><Heatmap /></section> : null}
      {screen.id === "S30" ? <RetestComparison /> : null}
      {screen.id !== "S25" && screen.id !== "S30" ? (
        <section className="panel formPanel">
          <div className="panelHeader"><div><h2>{screen.name}</h2><p>{screen.componentFamilies.join(" · ")}</p></div><span className="tag">{state}</span></div>
          <label className="field"><span className="fieldLabel">Study name</span><input className={kind === "error" ? "fieldControl fieldControl--error" : "fieldControl"} defaultValue="Checkout usability study" aria-invalid={kind === "error"} /></label>
          <label className="field"><span className="fieldLabel">Context</span><textarea className="fieldControl fieldTextarea" defaultValue="Evidence-first V1 review specimen." /></label>
          <div className="metricsGrid"><MetricCard label="Eligible sessions" value="22" detail="Technical blocks excluded" /><MetricCard label="Completion" value="77%" detail="17 / 22 eligible" /><MetricCard label="Median time" value="42s" detail="Successful sessions" /></div>
          <div className="formActions"><ReviewButton variant="secondary">Cancel</ReviewButton><ReviewButton disabled={kind === "error" || kind === "restricted" || kind === "unsupported"}>Continue</ReviewButton></div>
        </section>
      ) : null}
    </ResearcherShell>
  );
}

function ParticipantContent({ screen, state }: { screen: Screen; state: string }) {
  const kind = stateKind(state);
  const blocked = screen.id === "P10" || kind === "restricted" || kind === "unsupported" || kind === "error";
  return (
    <div className="participantFrame">
      <header className="participantHeader"><div className="participantBrand">UT Study</div><div className="participantProgress"><span>{screen.id} · Participant</span><div><i style={{ width: "66%" }} /></div></div></header>
      <main className="participantMain">
        <section className="participantCard centerCard">
          <span className="eyebrow">{screen.name}</span>
          <h1>{blocked ? "We can’t continue this step" : screen.name}</h1>
          <p>{blocked ? "This is handled as a technical/access condition, not a usability failure." : "Minimal participant UI keeps task instructions clear without revealing expected paths or success targets."}</p>
          <StateNotice state={state} />
          {kind === "loading" ? <Skeleton /> : <div className="formActions"><ReviewButton variant="secondary">Back</ReviewButton><ReviewButton disabled={blocked}>{screen.id === "P02" ? "Agree and start" : "Continue"}</ReviewButton></div>}
        </section>
      </main>
      <footer className="participantFooter">Anonymous session · behavioral tracking starts only after consent.</footer>
    </div>
  );
}

export default function HighFiReview() {
  const [selectedId, setSelectedId] = useState<string>(screens[0]?.id ?? "S01");
  const selectedScreen = useMemo(() => screens.find((screen) => screen.id === selectedId) ?? screens[0], [selectedId]);
  const [selectedState, setSelectedState] = useState<string>(selectedScreen.states[0]);
  const [viewport, setViewport] = useState<Viewport>("desktop");

  function chooseScreen(id: string) {
    const next = screens.find((screen) => screen.id === id) ?? screens[0];
    setSelectedId(next.id);
    setSelectedState(next.states[0]);
  }

  return (
    <main className="reviewPage">
      <header className="reviewHeader">
        <div><span className="eyebrow">Task 14 · High-fidelity QA</span><h1>48-screen / 170-state review</h1><p>Desktop and Mobile specimens use the Task 13 design-system baseline. This route is a review artifact with a no production-data claim.</p></div>
        <div className="coverageBadge" aria-label="Coverage"><strong>{screens.length}</strong><span>screens</span><strong>{totalStates}</strong><span>states</span></div>
      </header>

      <section className="reviewControls" aria-label="Review controls">
        <label><span>Screen</span><select value={selectedScreen.id} onChange={(event) => chooseScreen(event.target.value)}>{screens.map((screen) => <option key={screen.id} value={screen.id}>{screen.id} · {screen.name}</option>)}</select></label>
        <label><span>State</span><select value={selectedState} onChange={(event) => setSelectedState(event.target.value)}>{selectedScreen.states.map((state) => <option key={state} value={state}>{state}</option>)}</select></label>
        <div className="viewportToggle" role="group" aria-label="Viewport"><button type="button" className={viewport === "desktop" ? "isActive" : ""} onClick={() => setViewport("desktop")}>Desktop</button><button type="button" className={viewport === "mobile" ? "isActive" : ""} onClick={() => setViewport("mobile")}>Mobile</button></div>
        <div className="componentSummary"><span>Component families</span><strong title={selectedScreen.componentFamilies.join(", ")}>{selectedScreen.componentFamilies.join(" · ")}</strong></div>
      </section>

      <section className={viewport === "mobile" ? "reviewStage reviewStage--mobile" : "reviewStage"} aria-label={`${selectedScreen.id} ${selectedScreen.name} ${selectedState} ${viewport}`}>
        <div className="deviceFrame">{selectedScreen.id.startsWith("P") ? <ParticipantContent screen={selectedScreen} state={selectedState} /> : <ScreenContent screen={selectedScreen} state={selectedState} />}</div>
      </section>
    </main>
  );
}
