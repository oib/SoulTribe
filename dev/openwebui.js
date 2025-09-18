// ollama.js – OpenAI-kompatibler API-Aufruf für Open-WebUI

export async function checkWithOllama(sequence) {
    const prompt = sequence.join(" ");

    try {
        const response = await fetch("https://at1.dynproxy.net/api/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer sk-d0e3a491b19c435a975b234969298cd0"
            },
            body: JSON.stringify({
                model: "gemma3:1b",
                messages: [
                  { role: "system", content: "Du bist ein Emoji-Detektiv für Kinder. Bewerte jedes Emoji in genau einer Zeile im Format: Position X: ✅ oder ❌ Emoji – einfache, freundliche Begründung." },
                  { role: "user", content: prompt }                ],
                stream: false
            })
        });

        if (!response.ok) {
            console.error("Ollama API Error:", response.status);
            return "(Fehler beim LLM-Request)";
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() || "(keine Antwort vom Modell)";

    } catch (error) {
        console.error("LLM-Request fehlgeschlagen:", error);
        return "(Verbindungsfehler mit Ollama)";
    }
}

