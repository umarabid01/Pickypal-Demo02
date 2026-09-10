const STEPS = [
  { key: "browsing", label: "Browse" },
  { key: "ordering", label: "Order" },
  { key: "payment_method", label: "Pay" },
  { key: "tracking", label: "Track" },
];

// Maps backend phases to visible stepper positions.
// Onboarding phases (idle, collecting_*) and confirming phases are hidden/folded.
// "delivered" completes all steps.
function stepIndex(phase) {
  if (phase === "delivered") return STEPS.length;
  // Onboarding and confirmation phases collapse into the preceding visible step
  if (phase.startsWith("collecting_") || phase === "confirming") {
    return 0; // fold into browse/discover
  }
  if (phase === "paying" || phase === "payment_method") {
    return 2; // both map to the "Pay" step
  }
  const i = STEPS.findIndex((s) => s.key === phase);
  return i === -1 ? 0 : i;
}

export default function PhaseStepper({ phase }) {
  if (phase === "idle" || phase.startsWith("collecting_")) return null;

  const current = stepIndex(phase);

  return (
    <div className="stepper" role="status" aria-label={`Order progress: ${phase}`}>
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div className="stepper-item" key={step.key}>
            <div className={`stepper-dot ${done ? "done" : ""} ${active ? "active" : ""}`}>
              {done ? "✓" : ""}
            </div>
            <span className={`stepper-label ${active ? "active" : ""}`}>{step.label}</span>
            {i < STEPS.length - 1 && <div className={`stepper-line ${done ? "done" : ""}`} />}
          </div>
        );
      })}
    </div>
  );
}
