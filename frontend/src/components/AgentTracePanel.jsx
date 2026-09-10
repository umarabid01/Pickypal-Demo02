import React, { useRef, useEffect, useState } from "react";

/**
 * Dark-themed Agent Trace Panel showing live AI activity —
 * this is the panel that shows a seller/investor the
 * "multi-agent system" working in real time.
 */
export default function AgentTracePanel({ traceSteps, phase, onSimulateStep, showSimulate, isLoading }) {
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [traceSteps]);

  return (
    <div className="trace-panel">
      <div className="trace-header">
        <div className="trace-dot" />
        <h2>Agent Trace</h2>
        <div style={{ marginLeft: "auto" }}>
          <span className={`phase-badge ${phase}`}>
            {phase === "idle" ? "⏳ Idle" : ""}
            {phase.startsWith("collecting_") ? "📋 Onboarding" : ""}
            {phase === "browsing" ? "🔍 Browsing" : ""}
            {phase === "ordering" ? "📝 Ordering" : ""}
            {phase === "confirming" ? "✅ Confirming" : ""}
            {phase === "payment_method" ? "💳 Payment Method" : ""}
            {phase === "paying" ? "💳 Processing" : ""}
            {phase === "tracking" ? "🏍️ Tracking" : ""}
            {phase === "delivered" ? "✅ Delivered" : ""}
          </span>
        </div>
      </div>

      <div className="trace-body" ref={bodyRef}>
        {traceSteps.length === 0 ? (
          <div className="trace-empty">
            <div className="icon">🧠</div>
            <p>Send a message to see the multi-agent system in action.</p>
            <p style={{ fontSize: 12, marginTop: 8 }}>
              Each agent&apos;s reasoning, structured output, and actions will appear here in real time.
            </p>
          </div>
        ) : (
          traceSteps.map((step) => <TraceStepCard key={step.id} step={step} />)
        )}
      </div>

      {showSimulate && (
        <button className="simulate-btn" onClick={onSimulateStep} disabled={isLoading}>
          🏍️ Simulate Next Step
        </button>
      )}
    </div>
  );
}

function TraceStepCard({ step }) {
  const [showJson, setShowJson] = useState(false);

  const time = new Date(step.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const statusIcon = step.status === "running" ? "⟳" : step.status === "success" ? "✓" : "✗";

  return (
    <div className="trace-step">
      <div className="trace-step-header">
        <span className={`trace-agent-badge ${step.agent_name}`}>{step.agent_name}</span>
        <span className={`trace-status ${step.status}`}>
          {statusIcon} {step.status}
          {step.duration_ms ? ` (${step.duration_ms}ms)` : ""}
        </span>
      </div>
      <div className="trace-action">{step.action}</div>
      {step.error_message && (
        <div style={{ color: "#FF3B30", fontSize: 12, marginTop: 4 }}>⚠️ {step.error_message}</div>
      )}
      <div className="trace-time">
        {time} • Input: {step.input_summary}
      </div>
      {step.output_json && (
        <>
          <button className="trace-json-toggle" onClick={() => setShowJson(!showJson)}>
            {showJson ? "▾ Hide JSON" : "▸ Show JSON output"}
          </button>
          {showJson && <pre className="trace-json">{JSON.stringify(step.output_json, null, 2)}</pre>}
        </>
      )}
    </div>
  );
}
