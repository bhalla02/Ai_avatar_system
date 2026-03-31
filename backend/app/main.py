import os
import json
from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from groq import Groq
from gtts import gTTS

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

app = FastAPI(title="AI Avatar Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("temp",    exist_ok=True)
os.makedirs("outputs", exist_ok=True)


# ─────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────

async def transcribe_audio(file) -> str:
    audio_bytes   = await file.read()
    content_type  = file.content_type or "audio/webm"

    # Map mimetype → file extension
    ext_map = {
        "audio/webm":  "webm",
        "audio/ogg":   "ogg",
        "audio/wav":   "wav",
        "audio/mp3":   "mp3",
        "audio/mpeg":  "mp3",
        "audio/mp4":   "mp4",
        "audio/m4a":   "m4a",
        "audio/flac":  "flac",
    }
    ext       = ext_map.get(content_type, "webm")
    filename  = f"audio.{ext}"
    temp_path = f"temp/{filename}"

    with open(temp_path, "wb") as f:
        f.write(audio_bytes)

    # Pass explicit (filename, fileobj, mimetype) tuple — Groq requires this
    with open(temp_path, "rb") as audio_file:
        transcription = client.audio.transcriptions.create(
            file=(filename, audio_file, content_type),
            model="whisper-large-v3",
            response_format="text",
        )

    return str(transcription).strip()


def get_llm_response(text: str, history: list = []) -> str:
    messages = [{
        "role": "system",
        "content": "You are a helpful, expressive human-like AI avatar. Keep replies concise (2-3 sentences)."
    }]
    for h in history[-10:]:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": text})

    completion = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=messages,
        temperature=0.7,
    )
    return completion.choices[0].message.content


def detect_emotion(text: str) -> str:
    try:
        res = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{
                "role": "user",
                "content": f"Return ONE word from: happy, sad, angry, surprised, neutral, thinking, excited.\nText: {text}\nEmotion:"
            }],
            max_tokens=5,
            temperature=0,
        )
        emotion = res.choices[0].message.content.strip().lower()
        valid = {"happy", "sad", "angry", "surprised", "neutral", "thinking", "excited"}
        return emotion if emotion in valid else "neutral"
    except Exception:
        return "neutral"


def text_to_speech(text: str) -> str:
    output_path = "outputs/response.mp3"
    tts = gTTS(text=text, lang="en")
    tts.save(output_path)
    return output_path


# ─────────────────────────────────────────
# REST endpoints
# ─────────────────────────────────────────

@app.get("/")
def home():
    return {"message": "AI Avatar Backend Running"}


@app.post("/chat")
async def chat(
    audio: UploadFile = File(None),
    text:  str        = Form(None),
):
    if text:
        input_text = text
    elif audio:
        input_text = await transcribe_audio(audio)
    else:
        return {"error": "Provide either text or audio"}

    response_text = get_llm_response(input_text)
    audio_path    = text_to_speech(response_text)

    return {
        "input_text":    input_text,
        "response_text": response_text,
        "audio_path":    audio_path,
    }


@app.post("/api/speech/transcribe")
async def transcribe_endpoint(audio: UploadFile = File(...)):
    """Whisper STT — called by the frontend mic button."""
    text = await transcribe_audio(audio)
    return {"text": text}


@app.post("/api/tts/synthesize")
async def tts_endpoint(body: dict):
    """gTTS — returns MP3 audio."""
    text = body.get("text", "")
    if not text:
        return {"error": "No text provided"}
    path = text_to_speech(text)
    return FileResponse(path, media_type="audio/mpeg", filename="response.mp3")


# ─────────────────────────────────────────
# WebSocket — streaming chat
# ─────────────────────────────────────────

@app.websocket("/api/chat/ws")
async def chat_websocket(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data    = await websocket.receive_text()
            payload = json.loads(data)
            message = payload.get("message", "")
            history = payload.get("history", [])

            if not message.strip():
                continue

            full_reply = ""
            stream = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": "You are a helpful, expressive human-like AI avatar. Keep replies concise (2-3 sentences)."},
                    *[{"role": h["role"], "content": h["content"]} for h in history[-10:]],
                    {"role": "user", "content": message},
                ],
                temperature=0.7,
                stream=True,
            )

            for chunk in stream:
                token = chunk.choices[0].delta.content
                if token:
                    full_reply += token
                    await websocket.send_json({"type": "token", "content": token})

            emotion = detect_emotion(full_reply)
            await websocket.send_json({
                "type":    "done",
                "emotion": emotion,
                "full":    full_reply,
            })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass


# ─────────────────────────────────────────
# Static files
# ─────────────────────────────────────────

app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")