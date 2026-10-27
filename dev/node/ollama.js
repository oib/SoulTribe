// ollama.js – OpenAI-kompatibler API-Aufruf für Open-WebUI

export async function checkWithOllama(sequence) {
    const prompt = sequence.join(" ");

    const BASE = process.env.OLLAMA_BASE || process.env.OPENAI_BASE_URL || "https://at1.dynproxy.net";
    const API_KEY = process.env.OLLAMA_API_KEY || process.env.OPENAI_API_KEY || "";
    const MODEL = process.env.OLLAMA_MODEL || "gpt-oss:20b-cloud";

    try {
        const response = await fetch(`${BASE.replace(/\/$/, "")}/api/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(API_KEY ? { "Authorization": `Bearer ${API_KEY}` } : {})
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                  {
                    role: "system",
                    content: "You are the SoulTribe Assistant. Always follow the user's instructions exactly and reply in the language requested by the user content (for example: if the prompt says 'Respond in German', reply fully in German). Keep responses concise and friendly."
                  },
                  { role: "user", content: prompt }
                ],
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`LLM API error: HTTP ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (!content) {
            throw new Error("LLM returned an empty response");
        }
        return content;

    } catch (error) {
        // Never return placeholder text as if it were model output: callers
        // persist the result, so a transient outage would be stored forever.
        console.error("LLM request failed:", error);
        throw error;
    }
}

