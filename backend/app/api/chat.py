from fastapi import APIRouter, UploadFile, File

from app.services.speech_to_text import transcribe_audio
from app.services.llm_service import get_llm_response
from app.services.text_to_speech import text_to_speech

router = APIRouter()

@router.post("/chat")
async def chat(audio: UploadFile = File(...)):
    text = await transcribe_audio(audio)

    response = get_llm_response(text)

    audio_path = text_to_speech(response)

    return {
        "input_text": text,
        "response_text": response,
        "audio_path": audio_path
    }