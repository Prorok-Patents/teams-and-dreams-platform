import json
import logging
from typing import Optional
from google import genai
from google.genai import types
from pydantic import ValidationError

from scraper.discovery.config import settings
from scraper.discovery.wiki_parsers import WikipediaParser
from scraper.discovery.serper_client import SerperClient
from scraper.discovery.sport_intelligence_report import SportIntelligenceReport

logger = logging.getLogger(__name__)

async def generate_content_with_fallback(client, model, prompt, mime_type="application/json") -> str:
    import os
    try:
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type=mime_type,
                temperature=0.1
            ),
        )
        return response.text
    except Exception as e:
        api_key = os.getenv("OPENROUTER_API_KEY")
        if api_key:
            logging.getLogger(__name__).warning(f"Native Gemini call failed: {e}. Falling back to OpenRouter...")
            try:
                import openai
                or_client = openai.OpenAI(
                    base_url="https://openrouter.ai/api/v1",
                    api_key=api_key
                )
                or_model = model
                if "/" not in or_model:
                    if "gemini-3.5" in or_model or "gemini-2.5" in or_model or "gemini-flash" in or_model:
                        or_model = "google/gemini-2.5-flash"
                    elif "gemini-2.0-flash-lite" in or_model:
                        or_model = "google/gemini-2.0-flash-lite"
                    else:
                        or_model = f"google/{or_model}"
                
                response = or_client.chat.completions.create(
                    model=or_model,
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"} if mime_type == "application/json" else None,
                    max_tokens=4000,
                    temperature=0.1
                )
                return response.choices[0].message.content
            except Exception as or_err:
                logging.getLogger(__name__).error(f"OpenRouter fallback failed: {or_err}")
        raise e


class SportIntelligenceEngine:
    """
    Coordinates Wikipedia and Serper to gather deep context on a sport,
    and uses Gemini to extract a structured Knowledge Graph foundation.
    """
    
    def __init__(self):
        self.wiki = WikipediaParser()
        self.serper = SerperClient()
        self.client = genai.Client(api_key=settings.google_api_key)
        self.model = settings.model_name
        
    async def run_discovery(self, sport_name: str, wiki_title: Optional[str] = None) -> SportIntelligenceReport:
        """
        Run the full intelligence gathering pipeline for a sport.
        """
        title_to_fetch = wiki_title or sport_name
        logger.info(f"Starting intelligence discovery for {sport_name} (Wiki: {title_to_fetch})")
        
        # 1. Fetch Wikipedia context
        logger.info("Fetching Wikipedia data...")
        wiki_text = await self.wiki.get_full_text(title_to_fetch)
        if not wiki_text:
            logger.warning(f"Failed to fetch full Wikipedia text for {title_to_fetch}. Trying summary...")
            wiki_text = await self.wiki.get_page_summary(title_to_fetch)
            
        if not wiki_text:
            raise ValueError(f"Could not find Wikipedia information for {title_to_fetch}")
            
        # We might need to truncate the wiki text to avoid hitting token limits if it's exceptionally long,
        # but Gemini 2.5 Flash has a 1M token context window, so we are usually fine.
        # Let's cap it roughly to the first 100,000 characters just to be safe and fast.
        wiki_text = wiki_text[:100000]
        
        # 2. Extract structured report using Gemini
        logger.info("Analyzing data with Gemini...")
        prompt = f"""
        You are an expert sports data architect mapping out the organizational 
        structure and competitive landscape of {sport_name}.
        
        Analyze the provided Wikipedia text and extract a comprehensive report containing:
        1. The overarching sport category.
        2. A glossary of sport-specific terminology (especially related to events and competitions).
        3. All major governing bodies, continental confederations, national federations, and organizing entities mentioned.
        4. All major competitions (leagues, tournaments, circuits) mentioned.
        5. Structural notes on how the sport is organized (e.g. hierarchical vs independent).
        
        Wikipedia Content:
        {wiki_text}
        """
        
        # We specify JSON output and let Gemini generate it, then parse it manually
        # to avoid the google-genai SDK additional_properties bug.
        prompt += """\n\nReturn the result strictly as a JSON object adhering to this structure:
{
  "sport_name": "string",
  "sport_category": "string",
  "glossary": [{"term": "string", "definition": "string"}],
  "organizations": [{"name": "string", "acronym": "string", "role_description": "string", "inferred_type": "string", "inferred_scope": "string", "website_url": "string", "wikipedia_url": "string"}],
  "competitions": [{"name": "string", "competition_type": "string", "organizer_name": "string", "description": "string", "website_url": "string"}],
  "official_websites": ["string"],
  "structural_notes": "string"
}"""
        import asyncio
        response_text = None
        for attempt in range(6):
            try:
                response_text = await generate_content_with_fallback(
                    client=self.client,
                    model=self.model,
                    prompt=prompt,
                    mime_type="application/json"
                )
                break
            except Exception as e:
                if attempt == 5:
                    raise
                sleep_time = 10 * (attempt + 1)
                logger.warning(f"Gemini API call failed (attempt {attempt + 1}/6) with error: {e}. Retrying in {sleep_time}s...")
                await asyncio.sleep(sleep_time)
        
        try:
            report_data = json.loads(response_text)
            report = SportIntelligenceReport(**report_data)
            logger.info(f"Successfully generated initial report for {sport_name}")
        except (json.JSONDecodeError, ValidationError) as e:
            logger.error(f"Failed to parse Gemini output: {e}. Raw response was:\n{response_text}")
            raise
            
        # 2.5 Secondary deep-dive into related Wikipedia pages
        logger.info("Fetching related Wikipedia pages for deeper discovery...")
        related_urls = [org.wikipedia_url for org in report.organizations if org.wikipedia_url]
        if related_urls:
            related_text = await self.wiki.fetch_related_pages(related_urls)
            if related_text:
                related_text = related_text[:150000] # Cap to prevent massive payloads
                
                logger.info("Analyzing related Wikipedia pages with Gemini...")
                secondary_prompt = f"""
                You are an expert sports data architect mapping out {sport_name}.
                We already have the main governing bodies. Now, analyze these related Wikipedia pages 
                (which belong to the governing bodies or sub-federations) and extract:
                1. ANY national federations, continental confederations, or regional associations mentioned.
                2. ANY additional major competitions, leagues, or tournaments not already obvious.
                
                CRITICAL: Pay special attention to "Member Associations" or "National Federations" sections.
                
                Related Wikipedia Content:
                {related_text}
                
                Return the result strictly as a JSON object adhering to this structure:
                {{
                  "organizations": [{{"name": "string", "acronym": "string", "role_description": "string", "inferred_type": "string", "inferred_scope": "string", "website_url": "string", "wikipedia_url": "string"}}],
                  "competitions": [{{"name": "string", "competition_type": "string", "organizer_name": "string", "description": "string", "website_url": "string"}}]
                }}
                """
                
                response_text2 = None
                for attempt in range(6):
                    try:
                        response_text2 = await generate_content_with_fallback(
                            client=self.client,
                            model=self.model,
                            prompt=secondary_prompt,
                            mime_type="application/json"
                        )
                        break
                    except Exception as e:
                        if attempt == 5:
                            logger.error(f"Secondary Gemini pass failed completely: {e}")
                            break
                        sleep_time = 10 * (attempt + 1)
                        logger.warning(f"Gemini API call failed (attempt {attempt + 1}/6) with error: {e}. Retrying in {sleep_time}s...")
                        await asyncio.sleep(sleep_time)
                
                if response_text2:
                    try:
                        report_data2 = json.loads(response_text2)
                        from scraper.discovery.sport_intelligence_report import OrgMention, CompetitionMention
                        
                        new_orgs = report_data2.get("organizations", [])
                        new_comps = report_data2.get("competitions", [])
                        
                        logger.info(f"Secondary pass found {len(new_orgs)} more orgs and {len(new_comps)} more competitions.")
                        
                        for org_dict in new_orgs:
                            report.organizations.append(OrgMention(**org_dict))
                        for comp_dict in new_comps:
                            report.competitions.append(CompetitionMention(**comp_dict))
                            
                    except (json.JSONDecodeError, ValidationError, TypeError) as e:
                        logger.error(f"Failed to parse secondary Gemini output: {e}. Raw response was:\n{response_text2}")

        # 3. Enhance with official websites via Serper
        logger.info("Enriching with official websites...")
        report = await self._enrich_websites(report)
        
        return report
        
    async def _enrich_websites(self, report: SportIntelligenceReport) -> SportIntelligenceReport:
        """Find official websites for the extracted organizations and competitions."""
        # This could be heavily parallelized, but we do it sequentially or in small batches here
        import asyncio
        
        async def fetch_url(entity_name: str, entity_type: str) -> Optional[str]:
            query = f"official website {entity_name} {report.sport_name} {entity_type}"
            try:
                links = await self.serper.get_top_links(query, num_results=1)
                return links[0] if links else None
            except Exception as e:
                logger.warning(f"Serper search failed for {entity_name}: {e}")
                return None

        # Enrich Orgs
        org_tasks = [fetch_url(org.name, "organization") for org in report.organizations if not org.website_url]
        org_urls = await asyncio.gather(*org_tasks)
        for org, url in zip([o for o in report.organizations if not o.website_url], org_urls):
            org.website_url = url
            if url:
                report.official_websites.append(url)
                
        # Enrich Competitions
        comp_tasks = [fetch_url(comp.name, "competition") for comp in report.competitions if not comp.website_url]
        comp_urls = await asyncio.gather(*comp_tasks)
        for comp, url in zip([c for c in report.competitions if not c.website_url], comp_urls):
            comp.website_url = url
            if url:
                report.official_websites.append(url)
                
        # Deduplicate official websites
        report.official_websites = list(set(report.official_websites))
        
        return report

# Quick test hook
if __name__ == "__main__":
    import asyncio
    from dotenv import load_dotenv
    load_dotenv()
    
    logging.basicConfig(level=logging.INFO)
    
    async def main():
        engine = SportIntelligenceEngine()
        report = await engine.run_discovery("Curling")
        print(report.model_dump_json(indent=2))
        
    asyncio.run(main())
