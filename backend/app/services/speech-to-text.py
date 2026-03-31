from app.core.settings import groq_client
import os

async def transcribe_audio(file):
    os.makedirs("temp", exist_ok=True)

    file_path = "temp/input.wav"

    with open(file_path, "wb") as f:
        f.write(await file.read())

    with open(file_path, "rb") as audio_file:
        transcription = groq_client.audio.transcriptions.create(
            file=audio_file,
            model="whisper-large-v3"   # Groq Whisper
        )

    return transcription.text