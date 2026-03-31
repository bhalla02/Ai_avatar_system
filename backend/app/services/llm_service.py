from app.core.settings import groq_client

def get_llm_response(text: str) -> str:
    completion = groq_client.chat.completions.create(
        model="llama3-8b-8192",
        messages=[
            {"role": "system", "content": "You are a human-like AI avatar assistant."},
            {"role": "user", "content": text}
        ],
        temperature=0.7,
    )

    return completion.choices[0].message.content