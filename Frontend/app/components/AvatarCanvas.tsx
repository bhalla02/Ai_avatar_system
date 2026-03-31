"use client";
import "@react-three/fiber";
import React, { useRef, useEffect, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  ContactShadows,
  useGLTF,
} from "@react-three/drei";
import * as THREE from "three";

interface AvatarCanvasProps {
  isSpeaking: boolean;
  emotion?: string;
  onMicStart?: () => void;
  onMicStop?: () => void;
  onSendText?: (text: string) => void;
  isListening?: boolean;
  isThinking?: boolean;
  messages?: { role: string; content: string; id: string }[];
  streamingText?: string;
}

function AvatarModel({ isSpeaking }: { isSpeaking: boolean }) {
  const { scene } = useGLTF("/avatar.glb") as any;
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!scene) return;
    const box    = new THREE.Box3().setFromObject(scene);
    const size   = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const s      = 2.2 / Math.max(size.x, size.y, size.z);
    scene.scale.setScalar(s);
    scene.position.sub(centre.multiplyScalar(s));
    scene.position.y -= 0.15;
  }, [scene]);

  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    const t = clock.getElapsedTime();
    g.rotation.y = Math.sin(t * 0.35) * 0.04;
    if (isSpeaking) {
      g.rotation.x = Math.sin(t * 6) * 0.018;
      g.position.y = Math.sin(t * 5) * 0.012;
    } else {
      g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, 0, 0.08);
      g.position.y = THREE.MathUtils.lerp(g.position.y, 0, 0.08);
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  );
}

function CameraRig() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 0.35, 2.6);
    (camera as THREE.PerspectiveCamera).fov = 38;
    camera.updateProjectionMatrix();
    camera.lookAt(0, 0.2, 0);
  }, [camera]);
  return null;
}

const EMOTION_COLOR: Record<string, string> = {
  neutral:   "#6c63ff",
  happy:     "#facc15",
  sad:       "#60a5fa",
  angry:     "#f87171",
  surprised: "#fb923c",
  thinking:  "#a78bfa",
  excited:   "#f472b6",
};

function ThinkingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center", padding: "2px 0" }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: "50%", background: "#6c63ff",
          display: "inline-block",
          animation: "dotBounce 1.2s ease-in-out infinite",
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
    </span>
  );
}

export default function AvatarCanvas({
  isSpeaking,
  emotion       = "neutral",
  onMicStart,
  onMicStop,
  onSendText,
  isListening   = false,
  isThinking    = false,
  messages      = [],
  streamingText = "",
}: AvatarCanvasProps) {
  const [text, setText]       = useState("");
  const [chatOpen, setChatOpen] = useState(true);
  const messagesEndRef          = useRef<HTMLDivElement>(null);
  const accentColor             = EMOTION_COLOR[emotion] ?? "#6c63ff";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const handleSend = useCallback(() => {
    const t = text.trim();
    if (!t) return;
    onSendText?.(t);
    setText("");
  }, [text, onSendText]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSend();
  };

  return (
    <div style={styles.root}>

      {/* ── LEFT: 3-D Avatar ── */}
      <div style={styles.avatarPanel}>

        {/* Dark background layers */}
        <div style={{ ...styles.bg, background: "#07070f" }} />
        <div style={{
          ...styles.bg,
          background: `radial-gradient(ellipse 60% 55% at 50% 62%, ${accentColor}22 0%, transparent 70%)`,
          transition: "background 0.8s ease",
        }} />
        <div style={{
          ...styles.bg,
          backgroundImage: "repeating-linear-gradient(0deg,rgba(255,255,255,0.018) 0,rgba(255,255,255,0.018) 1px,transparent 1px,transparent 4px)",
          pointerEvents: "none",
        }} />

        <Canvas
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
          dpr={[1, 2]}
        >
          <CameraRig />
          <ambientLight intensity={0.7} />
          <directionalLight position={[1, 3, 3]}   intensity={1.6} castShadow />
          <pointLight      position={[-2, 2, 1]}   intensity={0.6} color={accentColor} />
          <pointLight      position={[0, 0, 2.5]}  intensity={0.3} color="#ffffff" />
          <Environment preset="city" />

          <React.Suspense fallback={null}>
            <AvatarModel isSpeaking={isSpeaking} />
          </React.Suspense>

          <ContactShadows position={[0, -1.1, 0]} opacity={0.5} scale={5} blur={3} color={accentColor} />
          <OrbitControls
            enableZoom={false} enablePan={false}
            minPolarAngle={Math.PI * 0.3} maxPolarAngle={Math.PI * 0.6}
            minAzimuthAngle={-0.45} maxAzimuthAngle={0.45}
            enableDamping dampingFactor={0.07}
          />
        </Canvas>

        {/* Emotion badge */}
        <div style={{ ...styles.badge, borderColor: accentColor + "55", color: accentColor }}>
          <span style={{ ...styles.badgeDot, background: accentColor }} />
          {emotion.charAt(0).toUpperCase() + emotion.slice(1)}
        </div>

        {/* Speaking wave */}
        {isSpeaking && (
          <div style={styles.speakingBar}>
            {[0.5, 0.8, 1, 0.8, 0.5].map((h, i) => (
              <div key={i} style={{
                width: 3, borderRadius: 3,
                height: `${h * 20}px`,
                background: accentColor,
                animation: `avatarPulse ${0.45 + i * 0.07}s ease-in-out infinite alternate`,
                animationDelay: `${i * 0.06}s`,
              }} />
            ))}
            <span style={{ ...styles.speakingLabel, color: accentColor }}>Speaking</span>
          </div>
        )}

        {/* Listening indicator */}
        {isListening && (
          <div style={{ ...styles.listenRing, borderColor: "#ef4444" }}>
            <span style={styles.listenLabel}>● Recording</span>
          </div>
        )}
      </div>

      {/* ── RIGHT: Chat panel ── */}
      <div style={styles.chatPanel}>

        {/* Header */}
        <div style={styles.chatHeader}>
          <div>
            <div style={styles.chatTitle}>AI Avatar</div>
            <div style={styles.chatSub}>
              {isThinking ? "Thinking…" : isSpeaking ? "Speaking…" : "Ready"}
            </div>
          </div>
          <button onClick={() => setChatOpen(o => !o)} style={styles.iconBtn}>
            {chatOpen ? "▾" : "▸"}
          </button>
        </div>

        {/* Messages */}
        {chatOpen && (
          <div style={styles.messages}>
            {messages.length === 0 && (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>🤖</div>
                <p style={styles.emptyText}>Say hello to get started</p>
                <p style={styles.emptySub}>Type below or hold the mic</p>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} style={{
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                marginBottom: 10,
              }}>
                <div style={{
                  ...styles.bubble,
                  ...(m.role === "user" ? styles.bubbleUser : styles.bubbleBot),
                  background: m.role === "user" ? accentColor : "#13131f",
                }}>
                  {m.content}
                </div>
              </div>
            ))}

            {/* Streaming reply */}
            {(isThinking || streamingText) && (
              <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
                <div style={{ ...styles.bubble, ...styles.bubbleBot }}>
                  {streamingText
                    ? <>{streamingText}<span style={styles.cursor} /></>
                    : <ThinkingDots />
                  }
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input row */}
        <div style={styles.inputRow}>
          {/* Mic — hold to speak */}
          <button
            onMouseDown={onMicStart}
            onMouseUp={onMicStop}
            onTouchStart={(e) => { e.preventDefault(); onMicStart?.(); }}
            onTouchEnd={(e)   => { e.preventDefault(); onMicStop?.(); }}
            onMouseLeave={onMicStop}
            title="Hold to speak"
            style={{
              ...styles.micBtn,
              background:  isListening ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)",
              borderColor: isListening ? "#ef4444"              : "#2a2a3e",
              color:       isListening ? "#ef4444"              : "#9090b0",
              boxShadow:   isListening ? "0 0 14px rgba(239,68,68,0.35)" : "none",
              transform:   isListening ? "scale(1.08)"          : "scale(1)",
            }}
          >
            {isListening ? "🎙️" : "🎤"}
          </button>

          {/* Text input */}
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type a message…"
            disabled={isThinking}
            style={{
              ...styles.textInput,
              opacity:     isThinking ? 0.5 : 1,
              borderColor: text ? accentColor + "66" : "#2a2a3e",
            }}
          />

          {/* Send */}
          <button
            onClick={handleSend}
            disabled={!text.trim() || isThinking}
            style={{
              ...styles.sendBtn,
              background:  text.trim() ? accentColor : "#1e1e30",
              borderColor: text.trim() ? accentColor : "#2a2a3e",
              opacity:     (!text.trim() || isThinking) ? 0.45 : 1,
              boxShadow:   text.trim() ? `0 0 16px ${accentColor}55` : "none",
              cursor:      (!text.trim() || isThinking) ? "not-allowed" : "pointer",
            }}
          >
            ➤
          </button>
        </div>
      </div>

      <style>{`
        @keyframes avatarPulse { from{opacity:.45;transform:scaleY(.6)} to{opacity:1;transform:scaleY(1)} }
        @keyframes cursorBlink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes dotBounce   { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "flex", width: "100%", height: "100vh",
    background: "#07070f", fontFamily: "'DM Sans','Segoe UI',sans-serif",
    overflow: "hidden", color: "#e8e8f0",
  },
  avatarPanel: { position: "relative", flex: 1, minWidth: 0, overflow: "hidden" },
  bg:          { position: "absolute", inset: 0 },
  chatPanel: {
    width: 360, flexShrink: 0, borderLeft: "1px solid #1e1e2e",
    background: "#0d0d16", display: "flex", flexDirection: "column", height: "100vh",
  },
  chatHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 18px", borderBottom: "1px solid #1e1e2e", flexShrink: 0,
  },
  chatTitle: { fontSize: 14, fontWeight: 600, letterSpacing: "0.05em", color: "#e8e8f0" },
  chatSub:   { fontSize: 11, color: "#6060a0", marginTop: 2, fontFamily: "monospace" },
  iconBtn:   { background: "none", border: "none", color: "#6060a0", cursor: "pointer", fontSize: 18, padding: "4px 6px" },
  messages: {
    flex: 1, overflowY: "auto", padding: "16px",
    display: "flex", flexDirection: "column",
  },
  emptyState: {
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", padding: "40px 0", gap: 8,
  },
  emptyIcon: { fontSize: 36 },
  emptyText: { fontSize: 14, color: "#9090b0", margin: 0 },
  emptySub:  { fontSize: 12, color: "#50506a", margin: 0 },
  bubble: {
    maxWidth: "82%", padding: "10px 14px", borderRadius: 16,
    fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word",
  },
  bubbleUser: { borderRadius: "16px 16px 4px 16px", color: "#ffffff" },
  bubbleBot:  {
    background: "#13131f", border: "1px solid #1e1e2e",
    borderRadius: "16px 16px 16px 4px", color: "#d8d8ec",
  },
  cursor: {
    display: "inline-block", width: 2, height: "1em", background: "#6c63ff",
    marginLeft: 3, verticalAlign: "middle", animation: "cursorBlink 1s step-end infinite",
  },
  inputRow: {
    display: "flex", gap: 8, padding: "12px 14px",
    borderTop: "1px solid #1e1e2e", flexShrink: 0, alignItems: "center",
  },
  micBtn: {
    width: 44, height: 44, borderRadius: 12, border: "1px solid",
    cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center",
    justifyContent: "center", transition: "all 0.15s ease",
    flexShrink: 0, userSelect: "none",
  },
  textInput: {
    flex: 1, height: 44, background: "#0d0d18", border: "1px solid",
    borderRadius: 12, padding: "0 14px", fontSize: 14, color: "#e8e8f0",
    outline: "none", fontFamily: "inherit", transition: "border-color 0.2s",
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 12, border: "1px solid", color: "#fff",
    fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center",
    justifyContent: "center", transition: "all 0.15s ease", flexShrink: 0,
  },
  badge: {
    position: "absolute", top: 16, left: 16, display: "flex", alignItems: "center",
    gap: 6, padding: "5px 12px", borderRadius: 99, border: "1px solid",
    fontSize: 11, fontFamily: "monospace", background: "rgba(7,7,15,0.7)",
    backdropFilter: "blur(10px)",
  },
  badgeDot:     { width: 6, height: 6, borderRadius: "50%" },
  speakingBar: {
    position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
    display: "flex", alignItems: "center", gap: 4, padding: "8px 16px",
    borderRadius: 99, background: "rgba(7,7,15,0.8)", backdropFilter: "blur(10px)",
    border: "1px solid rgba(108,99,255,0.3)",
  },
  speakingLabel: { fontSize: 11, fontFamily: "monospace", marginLeft: 6, letterSpacing: "0.1em" },
  listenRing: {
    position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
    display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
    borderRadius: 99, background: "rgba(7,7,15,0.85)", backdropFilter: "blur(10px)",
    border: "2px solid",
  },
  listenLabel: {
    fontSize: 11, fontFamily: "monospace", color: "#ef4444",
    letterSpacing: "0.08em", animation: "cursorBlink 1s step-end infinite",
  },
};