import os
import logging
from typing import Any, Type, Optional, Tuple, Dict
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Model definitions and cost per million tokens (input, output)
MODEL_PRICING = {
    "google/gemini-2.5-flash": (0.075, 0.30),
    "gemini-2.5-flash": (0.075, 0.30),  # Native fallback
    "moonshotai/kimi-k2.6:free": (0.0, 0.0),
    "moonshotai/kimi-k2.6": (0.66, 3.41),
    "zai-org/glm-5-2": (0.93, 3.00),
    "anthropic/claude-3.5-sonnet": (3.00, 15.00)
}

class LLMManager:
    def __init__(self):
        self.openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
        self.gemini_api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        self._openai_client = None
        self._gemini_client = None
        self._init_clients()

    def _init_clients(self):
        """Initialize instructor-wrapped clients based on available keys."""
        if self.openrouter_api_key:
            try:
                import openai
                import instructor
                self._openai_client = instructor.from_openai(
                    openai.OpenAI(
                        base_url="https://openrouter.ai/api/v1",
                        api_key=self.openrouter_api_key,
                    ),
                    mode=instructor.Mode.JSON
                )
                logger.info("OpenRouter client successfully initialized.")
            except ImportError:
                logger.warning("Failed to import openai/instructor. OpenRouter client not initialized.")

        if self.gemini_api_key:
            try:
                import google.generativeai as genai
                import instructor
                genai.configure(api_key=self.gemini_api_key)
                self._gemini_client = instructor.from_gemini(
                    client=genai.GenerativeModel(model_name="gemini-2.5-flash"),
                    mode=instructor.Mode.GEMINI_JSON,
                )
                logger.info("Native Gemini client successfully initialized.")
            except ImportError:
                logger.warning("Failed to import google.generativeai/instructor. Gemini client not initialized.")

    def calculate_cost(self, model: str, prompt_tokens: int, completion_tokens: int) -> float:
        """Calculate USD cost estimate based on tokens and model type."""
        rates = MODEL_PRICING.get(model, (0.0, 0.0))
        input_cost = (prompt_tokens * rates[0]) / 1_000_000
        output_cost = (completion_tokens * rates[1]) / 1_000_000
        return input_cost + output_cost

    async def get_structured_completion(
        self,
        messages: list[dict],
        response_model: Type[BaseModel],
        purpose: str  # "extraction" or "selectors"
    ) -> Tuple[Any, Dict[str, Any]]:
        """
        Request a structured completion from the LLM hierarchy.
        
        Returns:
            Tuple[parsed_response_model, usage_metadata_dict]
        """
        if purpose == "selectors":
            # Tiered hierarchy for selector generation
            models_to_try = []
            if self._openai_client:
                models_to_try.extend([
                    ("moonshotai/kimi-k2.6", False),
                    ("zai-org/glm-5-2", False),
                    ("google/gemini-2.5-flash", False)
                ])
            if self._gemini_client:
                models_to_try.append(("gemini-2.5-flash", True))
        else:
            # Default extraction path (Gemini Flash preferred)
            models_to_try = []
            if self._openai_client:
                models_to_try.append(("google/gemini-2.5-flash", False))
            if self._gemini_client:
                models_to_try.append(("gemini-2.5-flash", True))

        if not models_to_try:
            raise ValueError("No LLM clients initialized. Please set OPENROUTER_API_KEY or GEMINI_API_KEY.")

        last_error = None
        for model_name, is_native_gemini in models_to_try:
            logger.info(f"Attempting LLM call using model: {model_name} (native={is_native_gemini})")
            try:
                if is_native_gemini:
                    # Native Gemini execution
                    result, raw = self._gemini_client.messages.create_with_completion(
                        messages=messages,
                        response_model=response_model,
                    )
                    prompt_tokens, completion_tokens = self._extract_usage(raw, is_gemini=True)
                else:
                    # OpenRouter execution
                    result, raw = self._openai_client.chat.completions.create_with_completion(
                        model=model_name,
                        messages=messages,
                        response_model=response_model,
                    )
                    prompt_tokens, completion_tokens = self._extract_usage(raw, is_gemini=False)

                cost_usd = self.calculate_cost(model_name, prompt_tokens, completion_tokens)
                usage = {
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "cost_usd": cost_usd,
                    "model_used": model_name
                }
                logger.info(f"LLM call succeeded with {model_name}. Cost: ${cost_usd:.5f}")
                return result, usage

            except Exception as e:
                logger.warning(f"Failed LLM call with {model_name}: {e}")
                last_error = e
                continue

        # If we reach here, all attempts failed
        raise RuntimeError(f"All LLMs in hierarchy failed for purpose '{purpose}'. Last error: {last_error}")

    def _extract_usage(self, raw_completion, is_gemini: bool) -> Tuple[int, int]:
        """Extract prompt and completion token counts from the raw completion response."""
        prompt_tokens = 0
        completion_tokens = 0
        if is_gemini:
            if hasattr(raw_completion, 'usage_metadata') and raw_completion.usage_metadata:
                prompt_tokens = getattr(raw_completion.usage_metadata, 'prompt_token_count', 0)
                completion_tokens = getattr(raw_completion.usage_metadata, 'candidates_token_count', 0)
        else:
            if hasattr(raw_completion, 'usage') and raw_completion.usage:
                prompt_tokens = getattr(raw_completion.usage, 'prompt_tokens', 0)
                completion_tokens = getattr(raw_completion.usage, 'completion_tokens', 0)
        return prompt_tokens, completion_tokens

# Global singleton instance
llm_manager = LLMManager()
