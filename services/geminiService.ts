
import { GoogleGenAI, Type } from "@google/genai";

export const analyzeDevOpsComments = async (comments: string[]): Promise<{summary: string, completed: string[], next: string[]}> => {
  if (comments.length === 0) return { summary: "No history found.", completed: [], next: [] };
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze these DevOps discussion comments. Extract: 1. Completed milestones, 2. Next actions, 3. One-sentence summary. Comments: ${comments.slice(-5).join('\n---\n')}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            completed: { type: Type.ARRAY, items: { type: Type.STRING } },
            next: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["summary", "completed", "next"]
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("DevOps Analysis failed:", error);
    return { summary: "Analysis unavailable", completed: [], next: [] };
  }
};

/**
 * Corrects spelling and grammar errors using gemini-flash-lite-latest for maximum speed.
 */
export const fixSpelling = async (text: string): Promise<string> => {
  if (!text || text.trim().length < 2) return text;
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: `Fix only spelling and grammar. Keep the same length and meaning. Return ONLY the fixed text.\n\nText: "${text}"`,
    });
    return response.text?.trim() || text;
  } catch (error) {
    console.error("Spelling fix failed:", error);
    return text;
  }
};

export const askComplexQuery = async (prompt: string, context: string, userProfile?: { name: string, email: string }): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `PLAN CONTEXT:\n${context}\n\nUSER: ${userProfile?.name || 'User'}\n\nQUERY: ${prompt}`,
      config: {
        thinkingConfig: { thinkingBudget: 16000 }
      }
    });
    return response.text || "I couldn't process that request.";
  } catch (error) {
    console.error("Strategic query failed:", error);
    return "Error connecting to AI Strategist.";
  }
};
