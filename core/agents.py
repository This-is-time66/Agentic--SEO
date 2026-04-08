import os
import re
import requests
from bs4 import BeautifulSoup
from tavily import TavilyClient
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from .models import AgentState

TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY")
llm = ChatGroq(model_name="llama-3.3-70b-versatile", temperature=0.3)

def ddg_search(query: str, max_results: int = 7) -> str:
    try:
        client = TavilyClient(api_key=TAVILY_API_KEY)
        response = client.search(
            query=query,
            max_results=max_results,
            include_raw_content=True,
            search_depth="advanced", 
            exclude_domains=["youtube.com", "youtu.be", "twitter.com", "x.com", "pinterest.com", "instagram.com"]
        )
        results = response.get("results", [])
        if not results:
            return f"No results found for: {query}"
        lines = []
        for i, r in enumerate(results, 1):
            title   = r.get("title", "")
            url     = r.get("url", "")
            snippet = r.get("content", "")
            raw     = r.get("raw_content") or ""

            is_real_prose = len(raw) > 500 and raw.count(' ') > 50
            body = raw[:3000] if is_real_prose else snippet

            lines.append(
                f"{i}. TITLE: {title}\n"
                f"   URL: {url}\n"
                f"   CONTENT:\n{body}\n"
                f"   {'─'*60}"
            )
        return "\n\n".join(lines)
    except Exception as e:
        return f"Search failed: {str(e)}"

def competitor_agent(state: AgentState):
    raw_results = ddg_search(state['keyword'], max_results=4)
    has_real_content = "CONTENT:" in raw_results and len(raw_results) > 500

    if has_real_content:
        instruction = (
            "You have REAL fetched page content for each domain below. "
            "You MUST ground every claim in what you actually read. "
            "For each domain, start with: 'From [domain]: ' and cite specific "
            "section titles, headings, or phrases you actually found in their content. "
            "If a domain's content block is thin, say 'limited content available for [domain]'. "
            "NEVER invent section names or claims not present in the content."
        )
    else:
        instruction = (
            "Search data is unavailable. Do NOT invent competitor content. "
            "Describe only what TYPICALLY appears on pages ranking for this topic, "
            "clearly labelled as 'typical for this topic'."
        )

    response = llm.invoke([
        SystemMessage(content=f"""You are a Competitor Intelligence Agent.
{instruction}
STRICT OUTPUT FORMAT — follow exactly:
1. List each domain found
2. For each domain write:
   - "From [domain]: [specific topics/headings/claims found in their actual content]"
   - "What they cover well: [based on actual content]"
   - "What they do NOT cover: [genuine omission visible from their content]"
3. End with: "Cross-competitor pattern: [what ALL of them cover vs what NONE cover]"
HARD RULES:
- NO generic statements like "tone is neutral" or "content is informative"
- NO invented quotes or section names
- ONLY reference what is in the fetched content below
- Do NOT add a Recommendations section
"IMPORTANT: Each domain's 'What they do NOT cover' MUST be different from other domains."
"If two domains cover different tools, their gaps will naturally differ — find those differences."
"Do NOT copy the same 'not covered' points across multiple domains."
"""),
        HumanMessage(content=f"""Keyword: "{state['keyword']}"
FETCHED CONTENT FROM TOP RANKING PAGES:
{raw_results}
Analyze strictly based on the content above.""")
    ])
    return {"competitors_summary": response.content}

def gap_agent(state: AgentState):
    response = llm.invoke([
        SystemMessage(content="""You are a senior SEO Content Strategist.
Your ONLY job: find questions the SPECIFIC competitor pages above genuinely do not answer.
Rules:
- Each gap MUST name the competitor domain it's missing from
- Format strictly:
  🔍 [Specific question phrased like a Google search]
  - Missing from: [domain1.com, domain2.com — based on what you read]
  - Why they skip it: [1 sentence grounded in their actual content focus]
  - Reader gain: [1 sentence]
- REJECT any gap a beginner tutorial would cover
- REJECT any gap not supported by evidence from the competitor content
- Minimum 7 gaps, each must be hyper-specific (not broad topic areas)
- Do NOT invent gaps — only gaps provable from what competitors actually wrote"""),
        HumanMessage(content=f"""Keyword: "{state['keyword']}"
What competitors actually cover (grounded analysis):
{state['competitors_summary']}
Find ONLY gaps provable from the above competitor content.""")
    ])
    return {"gaps": response.content}

def writer_agent(state: AgentState):
    response = llm.invoke([
        SystemMessage(content="""You are an expert SEO content writer creating genuinely useful, differentiated content.
HARD STOP RULES — violating these will break the output:
❌ NEVER invent specific percentages like "30% faster" or "25% more defects"
❌ NEVER invent cost figures like "$3 million" or "$100,000"
❌ NEVER use the phrase "In one documented case" — this signals fabrication
❌ NEVER repeat the same sentence structure across sections
❌ Do NOT add a References section
❌ Do NOT add numbered citations like (1), (2), (3)
❌ Do NOT mention researcher names, university names, or journal names
❌ Do NOT write phrases like "researchers at University of X found..."
❌ Do NOT write phrases like "a study published in IEEE..."
✅ If you need data, use: "many developers report...", "commonly observed in practice..."
✅ Use concrete realistic scenarios instead of fake statistics
✅ Each section must have a DIFFERENT opening style
✅ Write like a senior developer sharing real experience, not a report
Writing rules:
- Open with a hook that promises what no other article covers
- Use H2 headings for each major gap you address
- Use H3 subheadings for sub-points within sections
- Write with a direct, confident, practical tone — like a senior practitioner sharing hard-won knowledge
- Use real examples, realistic scenarios, and concrete numbers where reasonable
- If a section involves comparing or naming specific tools, ONLY name tools you are certain exist and are directly relevant to the exact topic.
- Each section must have at least 3 paragraphs of genuine depth — avoid pure bullet lists with no explanation
- Minimum 900 words
- End with conclusion paragraph — nothing after it
"""),
        HumanMessage(content=f"""Write a comprehensive SEO article for: "{state['keyword']}"
These are the specific gaps your article must fill — every H2 section should address one:
{state['gaps']}
Make this article feel like it genuinely offers what no top-ranking page does.""")
    ])
    return {"final_article": response.content}