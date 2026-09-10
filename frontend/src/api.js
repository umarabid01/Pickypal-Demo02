// ============================================================
// PickyPal — API helper
// Points at the deployed Express backend via VITE_API_URL.
// ============================================================
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export async function sendMessage(sessionId, message, selectRestaurant) {
  const res = await fetch(`${API_URL}/api/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, message, selectRestaurant }),
  });
  return res.json();
}

export async function simulateStep(sessionId) {
  const res = await fetch(`${API_URL}/api/simulate-step`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  return res.json();
}
