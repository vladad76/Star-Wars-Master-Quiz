import { GoogleGenAI, Type } from "@google/genai";
import { Question, Difficulty } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const QUESTION_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      text: { type: Type.STRING },
      options: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        minItems: 4,
        maxItems: 4
      },
      correctAnswer: { type: Type.INTEGER },
      didYouKnow: { type: Type.STRING },
      imagePrompt: { type: Type.STRING },
      audioDescription: { type: Type.STRING }
    },
    required: ["id", "text", "options", "correctAnswer", "didYouKnow", "imagePrompt", "audioDescription"]
  }
};

export async function generateQuizQuestions(difficulty: Difficulty, seenIds: string[] = []): Promise<Question[]> {
  const difficultyPrompts = {
    'Easy': 'Focus on the Skywalker Saga films (Episodes I-IX). Questions should be widely known.',
    'Medium': 'Focus on TV series and Animation (The Mandalorian, Clone Wars, Rebels, Ahsoka). Questions should be moderately challenging.',
    'Hard': 'A 50/50 mix of obscure Legends lore (Expanded Universe) and Behind-the-Scenes production trivia. Only for true masters.'
  };

  const prompt = `Generate 10 unique Star Wars trivia questions for the '${difficulty}' level.
  Context: ${difficultyPrompts[difficulty]}
  
  Strict Constraint: Avoid these questions (seen in previous sessions): ${seenIds.join(', ')}.
  
  For each question, provide:
  1. A clear question text.
  2. Four distinct options.
  3. The index of the correct answer (0-3).
  4. A fascinating "Did you know?" fact related to the question.
  5. A high-fidelity image prompt: "Hyper-realistic 8k cinematic still, [Subject], volumetric lighting, ILM concept art style."
  6. A descriptive audio soundscape: e.g., "The hum of a lightsaber clashing against a cold steel floor."

  Return the data in valid JSON format according to the requested schema.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: QUESTION_SCHEMA
      }
    });

    const questions = JSON.parse(response.text || '[]');
    return questions;
  } catch (error) {
    console.error("Error generating questions:", error);
    throw error;
  }
}
