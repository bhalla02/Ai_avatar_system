from gtts import gTTS
import os

def text_to_speech(text: str) -> str:
    os.makedirs("outputs", exist_ok=True)

    path = "outputs/response.mp3"

    tts = gTTS(text=text, lang="en")
    tts.save(path)

    return path