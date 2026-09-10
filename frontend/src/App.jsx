import React, { useState, useCallback } from "react";
import PhoneFrame from "./components/PhoneFrame.jsx";
import ChatWindow from "./components/ChatWindow.jsx";
import { sendMessage, simulateStep } from "./api.js";

// One random session id per browser tab load — swap this for real
// auth/session logic (e.g. a login, or a persisted device id) later.
const SESSION_ID = "demo-session-" + Math.random().toString(36).slice(2, 8);

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

export default function App() {
  const [messages, setMessages] = useState(() => [
    {
      id: "greeting",
      role: "agent",
      content:
        "Assalam-o-Alaikum! 👋 Welcome to PickyPal — your AI food ordering assistant for Pakistan!\n\nI'm here to help you order safe, delicious food that fits your dietary needs. We'll start with a quick profile setup (your name, phone, address, and any allergies), then you're ready to browse and order.\n\nLet's get started! Just type anything to begin. 🍽️",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [phase, setPhase] = useState("idle");

  const handleSend = useCallback(
    async (text) => {
      if (isLoading) return;

      const userMsg = { id: uuid(), role: "user", content: text, timestamp: new Date().toISOString() };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const data = await sendMessage(SESSION_ID, text);
        const agentMsg = {
          id: uuid(),
          role: "agent",
          content: data.reply || "Sorry, I didn't get a response there — try again?",
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, agentMsg]);
        if (data.phase) setPhase(data.phase);
      } catch {
        const errorMsg = {
          id: uuid(),
          role: "agent",
          content: "I'm having trouble connecting right now. Please try again in a moment.",
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading]
  );

  const handleSimulateStep = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const data = await simulateStep(SESSION_ID);
      if (data.reply) {
        const agentMsg = { id: uuid(), role: "agent", content: data.reply, timestamp: new Date().toISOString() };
        setMessages((prev) => [...prev, agentMsg]);
      }
      if (data.phase) setPhase(data.phase);
    } catch (err) {
      console.error("Simulate step failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  return (
    <div className="showcase">
      <div className="showcase-intro">
        <span className="showcase-eyebrow">🍽️ AI Food Ordering Assistant</span>
        <h1>PickyPal</h1>
        <p>
          Chat naturally about what you want to eat — PickyPal cross-checks every menu item
          against your allergies and dietary needs before it ever gets suggested to you.
        </p>
        <ul className="showcase-points">
          <li>Understands English, Urdu &amp; Punjabi</li>
          <li>Filters menus by allergy in real time</li>
          <li>Order, pay, and track — all in one chat</li>
        </ul>
      </div>

      <PhoneFrame>
        <ChatWindow
          messages={messages}
          isLoading={isLoading}
          onSend={handleSend}
          phase={phase}
          onSimulateStep={handleSimulateStep}
          disabled={isLoading}
        />
      </PhoneFrame>
    </div>
  );
}
