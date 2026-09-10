import React, { useRef, useEffect, useState } from "react";
import MessageBubble from "./MessageBubble.jsx";

// Quick replies vary by phase to guide the user contextually
const QUICK_REPLIES_BY_PHASE = {
  collecting_name: null, // Free-form name input
  collecting_phone: null, // Free-form phone input
  collecting_address: null, // Free-form address input
  collecting_allergens: ["None 🤷", "Peanuts 🥜", "Dairy 🧀", "Gluten 🌾"],
  browsing: ["Desi 🍛", "Fast Food 🍔", "Something spicy 🌶️"],
  ordering: ["Done ordering 🛒", "Show my bill 📋", "Another item ➕"],
  confirming: ["Confirm ✅", "Make changes 🔄"],
  payment_method: ["COD 💵", "JazzCash 📱", "EasyPaisa 📱"],
  paying: ["Paid ✅", "Need details 🆘"],
  tracking: null, // Will show "Simulate Next Step" button instead
  delivered: ["New order 🛍️"],
};

const PHASE_STATUS = {
  idle: "online",
  collecting_name: "collecting info...",
  collecting_phone: "collecting info...",
  collecting_address: "collecting info...",
  collecting_allergens: "setting up safety...",
  browsing: "finding your options...",
  ordering: "building your order...",
  confirming: "confirming order...",
  payment_method: "choosing payment...",
  paying: "processing payment...",
  tracking: "order is on the way 🏍️",
  delivered: "delivered ✅",
};

/**
 * Full WhatsApp-style chat surface: header, scrollable messages,
 * quick-reply chips, input bar. This is the entire user-facing
 * surface — no agent/system internals are ever rendered here.
 */
export default function ChatWindow({ messages, isLoading, onSend, phase, onSimulateStep, disabled }) {
  const [inputValue, setInputValue] = useState("");
  const chatAreaRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = (text) => {
    const msg = (text ?? inputValue).trim();
    if (!msg || disabled) return;
    onSend(msg);
    setInputValue("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickReplies = QUICK_REPLIES_BY_PHASE[phase] || [];
  const showQuickReplies = !disabled && quickReplies.length > 0 && !messages.some((m) => m.role === "user");
  const showSimulate = phase === "tracking" && !isLoading;

  return (
    <>
      <div className="wa-header">
        <div className="wa-header-avatar">🍽️</div>
        <div className="wa-header-info">
          <h3>PickyPal</h3>
          <p>{isLoading ? "typing..." : PHASE_STATUS[phase] || "online"}</p>
        </div>
      </div>

      <div className="wa-chat-area" ref={chatAreaRef}>
        {messages.map((msg) => (
          <MessageBubble key={msg.id} role={msg.role} content={msg.content} timestamp={msg.timestamp} />
        ))}

        {isLoading && (
          <div className="msg-row agent">
            <div className="msg-bubble agent">
              <div className="typing-indicator">
                <div className="dot" />
                <div className="dot" />
                <div className="dot" />
              </div>
            </div>
          </div>
        )}

        {showSimulate && (
          <div className="wa-system-row">
            <button className="wa-system-btn" onClick={onSimulateStep}>
              🏍️ Simulate Next Step
            </button>
          </div>
        )}
      </div>

      {showQuickReplies && (
        <div className="chip-row">
          {quickReplies.map((chip) => (
            <button key={chip} className="chip" onClick={() => handleSend(chip)}>
              {chip}
            </button>
          ))}
        </div>
      )}

      <div className="wa-input-bar">
        <input
          ref={inputRef}
          type="text"
          placeholder="Type a message..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          autoComplete="off"
        />
        <button
          className="wa-send-btn"
          onClick={() => handleSend()}
          disabled={disabled || !inputValue.trim()}
          aria-label="Send message"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path d="M3 11.5L21 3l-8.5 18-2.5-7.5L3 11.5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </>
  );
}
