import os
import dotenv
import openai
import instructor
from pydantic import BaseModel

dotenv.load_dotenv('scraper/.env')

class Model(BaseModel):
    response: str

try:
    print("Initializing OpenRouter client...")
    client = instructor.from_openai(
        openai.OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=os.getenv("OPENROUTER_API_KEY")
        ),
        mode=instructor.Mode.JSON
    )
    
    print("Sending test request to moonshotai/kimi-k2.6...")
    res = client.chat.completions.create(
        model="moonshotai/kimi-k2.6",
        messages=[{"role": "user", "content": "Hello! Confirm you are working by saying hello back."}],
        response_model=Model
    )
    print("API TEST SUCCESS:", res.response)
except Exception as e:
    print("API TEST FAILED:", e)
