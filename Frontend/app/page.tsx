"use client";

import { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";

const AvatarCanvas = dynamic(() => import("./components/AvatarCanvas"), {
  ssr: false,
  loading: () => (
    <div style={{
      width: "100vw", height: "100vh", background: "#07070f",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 16, color: "#6060a0", fontFamily: "monospace",
    }}>
      <div style={{
        width: 36, height: 36, border: "2px solid #6c63ff",
        borderTopColor: "transparent", borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <span style={{ fontSize: 12 }}>Loading 3D engine…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  ),
});

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const BACKEND = "http://localhost:8000";
const WS_URL  = "ws://localhost:8000";

export default function Home() {
  const [messages,      setMessages]      = useState<Message[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [isThinking,    setThinking]      = useState(false);
  const [isSpeaking,    setSpeaking]      = useState(false);
  const [isListening,   setListening]     = useState(false);
  const [emotion,       setEmotion]       = useState("neutral");

  const wsRef            = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<BlobPart[]>([]);
  const audioRef         = useRef<HTMLAudioElement | null>(null);

  // ── Open / reuse WebSocket ──────────────────────────────────────────
  const getWS = useCallback((): Promise<WebSocket> => {
    return new Promise((resolve) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        resolve(wsRef.current);
        return;
      }
      const ws = new WebSocket(`${WS_URL}/api/chat/ws`);
      ws.onopen  = () => resolve(ws);
      ws.onerror = () => ws.close();
      wsRef.current = ws;
    });
  }, []);

  // ── Send text → Groq → stream reply → TTS ──────────────────────────
  const sendToAvatar = useCallback(async (text: string) => {
    if (!text.trim()) return;

    setMessages(prev => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: text },
    ]);
    setThinking(true);
    setStreamingText("");

    try {
      const ws = await getWS();
      let fullReply = "";

      ws.onmessage = async (evt) => {
        const msg = JSON.parse(evt.data);

        if (msg.type === "token") {
          fullReply += msg.content;
          setStreamingText(fullReply);
        }

        if (msg.type === "done") {
          setThinking(false);
          setStreamingText("");
          setEmotion(msg.emotion ?? "neutral");
          setMessages(prev => [
            ...prev,
            { id: crypto.randomUUID(), role: "assistant", content: msg.full },
          ]);

          // Play TTS audio from ElevenLabs via backend
          try {
            const res  = await fetch(`${BACKEND}/api/tts/synthesize`, {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({ text: msg.full }),
            });
            const blob = await res.blob();
            const url  = URL.createObjectURL(blob);

            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.src = "";
            }
            const audio = new Audio(url);
            audioRef.current = audio;
            setSpeaking(true);
            audio.play();
            audio.onended = () => {
              setSpeaking(false);
              URL.revokeObjectURL(url);
            };
          } catch {
            setSpeaking(false);
          }
        }

        if (msg.type === "error") {
          setThinking(false);
          setStreamingText("");
        }
      };

      ws.send(JSON.stringify({
        message: text,
        history: messages.map(m => ({ role: m.role, content: m.content })),
      }));

    } catch (e) {
      console.error("WS error:", e);
      setThinking(false);
    }
  }, [getWS, messages]);

  // ── Mic: hold to record, release to send ───────────────────────────
  const handleMicStart = useCallback(async () => {
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setListening(true);
    } catch (e) {
      console.error("Mic error:", e);
    }
  }, []);

  const handleMicStop = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      recorder.stream.getTracks().forEach(t => t.stop());
      mediaRecorderRef.current = null;
      setListening(false);

      if (blob.size < 500) return; // too short — ignore

      try {
        const form = new FormData();
        form.append("audio", blob, "rec.webm");
        const res  = await fetch(`${BACKEND}/api/speech/transcribe`, {
          method: "POST",
          body:   form,
        });
        const data = await res.json();
        if (data.text?.trim()) sendToAvatar(data.text);
      } catch (e) {
        console.error("Transcribe error:", e);
      }
    };

    recorder.stop();
  }, [sendToAvatar]);

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <AvatarCanvas
      isSpeaking={isSpeaking}
      isListening={isListening}
      isThinking={isThinking}
      emotion={emotion}
      messages={messages}
      streamingText={streamingText}
      onMicStart={handleMicStart}
      onMicStop={handleMicStop}
      onSendText={sendToAvatar}
    />
  );
}