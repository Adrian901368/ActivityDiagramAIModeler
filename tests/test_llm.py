from app.services.llm_service import generate_simple_response

if __name__ == "__main__":
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Write one sentence about FIIT STU."},
    ]

    content = generate_simple_response(messages)
    print("✅ LLM response:")
    print(content)
