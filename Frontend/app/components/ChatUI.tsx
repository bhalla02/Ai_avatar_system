"use client";

import { useState, useRef } from "react";

interface ChatUIProps {
  onSendText: (text: string) => void;
  onMicStart: () => void;
  onMicStop: () => void;
  isThinking?: boolean;
  isListening?: boolean;
}

export default function ChatUI({
  onSendText,
  onMicStart,
  onMicStop,
  isThinking  = false,
  isListening = false,
}: ChatUIProps) {
  const [text, setText] = useState("");

  const handleSend = () => {
    const t = text.trim();
    if (!t || isThinking) return;
    onSendText(t);
    setText("");
  };

  return (
    <div style={{
      display: "flex", gap: 8, padding: "12px 14px",
      borderTop: "1px solid #1e1e2e", background: "#0d0d16",
      alignItems: "center",
    }}>

      {/* Mic — hold to speak */}
      <button
        onMouseDown={onMicStart}
        onMouseUp={onMicStop}
        onMouseLeave={onMicStop}
        onTouchStart={(e) => { e.preventDefault(); onMicStart(); }}
        onTouchEnd={(e)   => { e.preventDefault(); onMicStop();  }}
        title="Hold to speak"
        style={{
          width: 44, height: 44, borderRadius: 12, border: "1px solid",
          background:  isListening ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)",
          borderColor: isListening ? "#ef4444" : "#2a2a3e",
          color:       isListening ? "#ef4444" : "#9090b0",
          fontSize: 18, cursor: "pointer", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          transform: isListening ? "scale(1.08)" : "scale(1)",
          transition: "all 0.15s ease",
        }}
      >
        {isListening ? "🎙️" : "🎤"}
      </button>

      {/* Text input */}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSend()}
        placeholder="Type a message…"
        disabled={isThinking}
        style={{
          flex: 1, height: 44, background: "#0d0d18",
          border: `1px solid ${text ? "#6c63ff66" : "#2a2a3e"}`,
          borderRadius: 12, padding: "0 14px", fontSize: 14,
          color: "#e8e8f0", outline: "none", fontFamily: "inherit",
          opacity: isThinking ? 0.5 : 1,
          transition: "border-color 0.2s",
        }}
      />

      {/* Send */}
      <button
        onClick={handleSend}
        disabled={!text.trim() || isThinking}
        style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background:  text.trim() ? "#6c63ff" : "#1e1e30",
          border:      `1px solid ${text.trim() ? "#6c63ff" : "#2a2a3e"}`,
          color: "#fff", fontSize: 16, cursor: text.trim() ? "pointer" : "not-allowed",
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: (!text.trim() || isThinking) ? 0.45 : 1,
          boxShadow: text.trim() ? "0 0 16px rgba(108,99,255,0.4)" : "none",
          transition: "all 0.15s ease",
        }}
      >
        ➤
      </button>
    </div>
  );
}