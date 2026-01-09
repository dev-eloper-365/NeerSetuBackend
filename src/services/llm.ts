// import { GoogleGenerativeAI } from "@google/generative-ai"; // Commented out - using Groq instead
import Groq from "groq-sdk";
import dotenv from "dotenv";
import logger from "../utils/logger";

dotenv.config();

// LLM Provider Configuration
const LLM_PROVIDER = process.env.LLM_PROVIDER || "groq";
const LOCAL_LLM_URL = process.env.LOCAL_LLM_URL || "http://localhost:11434";

// Groq configuration
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const groq = new Groq({ apiKey: GROQ_API_KEY });

// Commented out Gemini configuration
// const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";
// const gemini = new GoogleGenerativeAI(GOOGLE_API_KEY);

// Validate API key on startup
if (LLM_PROVIDER !== "local" && !GROQ_API_KEY) {
  logger.warn("GROQ_API_KEY is not set. Groq API calls will fail. Set LLM_PROVIDER=local to use local LLM instead.");
}

logger.info(`LLM Provider: ${LLM_PROVIDER}${LLM_PROVIDER === "local" ? ` (${LOCAL_LLM_URL})` : ""}`);

/**
 * Generate response using Local LLM with retry
 */
async function generateLocalResponse(prompt: string, retries: number = 2): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${LOCAL_LLM_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          options: { num_predict: 4096, num_ctx: 8192 },
        }),
      });

      if (!response.ok) {
        throw new Error(`Local LLM error: ${await response.text()}`);
      }

      const data = (await response.json()) as { response?: string };
      return data.response || "I couldn't generate a response.";
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < retries) {
        logger.warn({ attempt: attempt + 1, error: lastError.message }, "Retrying local LLM...");
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  throw lastError;
}

// System prompt for the RAG assistant
const SYSTEM_PROMPT = `You are INGRES AI Assistant, a groundwater data expert for India. Your role is to provide SHORT, PRECISE answers based ONLY on the provided context.

CRITICAL RULES:
1. ONLY use data from the provided context - never make up statistics
2. Focus on the EXACT location/year the user asked about - ignore other locations in context
3. Keep responses BRIEF (3-5 bullet points max for simple queries)
4. Use exact numbers from context with units (ham, mm, %, ha)
5. If specific data isn't in context, say "Data not available" - don't guess
6. ALWAYS respond in markdown format

RESPONSE FORMAT:
- For single location: Direct bullet points with key metrics but if user specifies more provide more details
- For comparisons: Simple table format
- NO lengthy introductions or explanations
- NO repeating the question back
- Bold only the most critical values (status, extraction %)

KEY METRICS TO PRIORITIZE:
• Groundwater Status (Safe/Semi-Critical/Critical/Over-Exploited)
• Stage of Extraction (%)
• Annual Recharge vs Extraction (ham)
• Net Availability (ham)

Example good response:
**Aibawk, Aizawl, Mizoram (2024-2025)**
• Status: **SAFE**
• Extraction: 5.98 ham / 8.61 ham extractable (**69.5%**)
• Annual Recharge: 9.57 ham
• Net Availability: 2.35 ham`;

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: Error) => void;
}

/**
 * Generate a response using Groq or Local LLM
 */
export async function generateResponse(query: string, context: string): Promise<string> {
  const contextMessage = `Context (use ONLY this data):
${context}

Question: ${query}`;

  // Use Local LLM if configured
  if (LLM_PROVIDER === "local") {
    const fullPrompt = `${SYSTEM_PROMPT}\n\n${contextMessage}`;
    return generateLocalResponse(fullPrompt);
  }

  // Default: Groq
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: contextMessage },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_tokens: 2048,
    });

    return completion.choices[0]?.message?.content || "I couldn't generate a response.";
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Handle API errors from Groq
    if (errorMessage.includes("401") || errorMessage.includes("403") || errorMessage.includes("Forbidden") || errorMessage.includes("Unauthorized")) {
      logger.error(
        { 
          err: error,
          apiKeySet: !!GROQ_API_KEY,
          provider: LLM_PROVIDER 
        }, 
        "Groq API authentication failed. Check your GROQ_API_KEY or use LLM_PROVIDER=local"
      );
      throw new Error(
        "API authentication failed. Please check your Groq API key configuration. " +
        "If you don't have an API key, set LLM_PROVIDER=local in your environment variables to use a local LLM."
      );
    }
    
    throw error;
  }

  // Commented out Gemini code
  /*
  // Default: Gemini
  const model = gemini.getGenerativeModel({ model: "gemini-2.5-flash" });

  const chat = model.startChat({
    history: [
      { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
      {
        role: "model",
        parts: [
          {
            text: "Understood. I am INGRES AI Assistant, ready to help with India's groundwater data.",
          },
        ],
      },
    ],
    generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
  });

  try {
    const result = await chat.sendMessage(contextMessage);
    return result.response.text() || "I couldn't generate a response.";
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Handle 403 Forbidden errors from Gemini API
    if (errorMessage.includes("403") || errorMessage.includes("Forbidden") || errorMessage.includes("multipart")) {
      logger.error(
        { 
          err: error,
          apiKeySet: !!GOOGLE_API_KEY,
          provider: LLM_PROVIDER 
        }, 
        "Gemini API authentication failed (403 Forbidden). Check your GOOGLE_API_KEY or use LLM_PROVIDER=local"
      );
      throw new Error(
        "API authentication failed. Please check your Google API key configuration. " +
        "If you don't have an API key, set LLM_PROVIDER=local in your environment variables to use a local LLM."
      );
    }
    
    throw error;
  }
  */
}

/**
 * Generate a streaming response using Groq or Local LLM
 */
export async function generateStreamingResponse(query: string, context: string, callbacks: StreamCallbacks): Promise<void> {
  const contextMessage = `Context (use ONLY this data):
${context}

Question: ${query}`;

  try {
    // Use Local LLM if configured (non-streaming fallback)
    if (LLM_PROVIDER === "local") {
      const fullPrompt = `${SYSTEM_PROMPT}\n\n${contextMessage}`;
      const response = await generateLocalResponse(fullPrompt);
      callbacks.onToken(response);
      callbacks.onComplete(response);
      return;
    }

    // Default: Groq streaming
    const stream = await groq.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: contextMessage },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_tokens: 2048,
      stream: true,
    });

    let fullResponse = "";
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || "";
      if (token) {
        fullResponse += token;
        callbacks.onToken(token);
      }
    }

    callbacks.onComplete(fullResponse);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Handle API errors from Groq
    if (errorMessage.includes("401") || errorMessage.includes("403") || errorMessage.includes("Forbidden") || errorMessage.includes("Unauthorized")) {
      logger.error(
        { 
          err: error,
          apiKeySet: !!GROQ_API_KEY,
          provider: LLM_PROVIDER 
        }, 
        "Groq API authentication failed. Check your GROQ_API_KEY or use LLM_PROVIDER=local"
      );
      
      const friendlyError = new Error(
        "API authentication failed. Please check your Groq API key configuration. " +
        "If you don't have an API key, set LLM_PROVIDER=local in your environment variables to use a local LLM."
      );
      callbacks.onError(friendlyError);
      return;
    }
    
    logger.error({ err: error, errorMessage }, "Streaming response failed");
    callbacks.onError(error instanceof Error ? error : new Error(String(error)));
  }

  // Commented out Gemini streaming code
  /*
  // Default: Gemini streaming
  const model = gemini.getGenerativeModel({ model: "gemini-2.5-flash" });

  const chat = model.startChat({
    history: [
      { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
      {
        role: "model",
        parts: [
          {
            text: "Understood. I am INGRES AI Assistant, ready to help with India's groundwater data.",
          },
        ],
      },
    ],
    generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
  });

  const result = await chat.sendMessageStream(contextMessage);
  let fullResponse = "";

  for await (const chunk of result.stream) {
    const token = chunk.text();
    if (token) {
      fullResponse += token;
      callbacks.onToken(token);
    }
  }

  callbacks.onComplete(fullResponse);
  */
}

/**
 * Generate suggested follow-up questions
 */
export async function generateSuggestions(query: string, context: string, language: string = "en"): Promise<string[]> {
  const languageMap: Record<string, string> = {
    en: "English",
    hi: "Hindi (हिन्दी)",
    bn: "Bengali (বাংলা)",
    te: "Telugu (తెలుగు)",
    ta: "Tamil (தமிழ்)",
    ml: "Malayalam (മലയാളം)",
    pa: "Punjabi (ਪੰਜਾਬੀ)",
    ur: "Urdu (اردو)",
  };

  const languageInstruction = language !== "en" ? `Generate the suggestions in ${languageMap[language] || language}. ` : "";

  const toolDescriptions = `Based on available capabilities, follow-up questions can be of these 5 types:
1. SPECIFIC DATA: Ask for groundwater data of a specific location (state, district, or taluk)
2. COMPARISON: Compare groundwater data between 2-10 different locations
3. RANKINGS: Ask which locations rank highest/lowest by any metric (extraction, stage of extraction, rainfall, recharge, etc.)
4. TRENDS: Ask about how groundwater conditions changed over time for a location
5. EXPLORATION: Ask what districts/taluks exist in a state, or what states exist`;

  const prompt = `${toolDescriptions}

Original query: ${query}
Context: ${context.substring(0, 500)}...

IMPORTANT: Never mention tools, functions, APIs, databases, or any technical implementation details. Never reveal internal workings. Generate natural, user-friendly questions only.

Generate 4-5 relevant follow-up questions the user might want to ask. Each question must fit into ONE of the 5 types above. ${languageInstruction}Return only the questions, one per line.`;

  // Use Local LLM if configured
  if (LLM_PROVIDER === "local") {
    const response = await generateLocalResponse(prompt);
    return response
      .split("\n")
      .map((q) => q.replace(/^\d+\.\s*/, "").trim())
      .filter((q) => q.length > 0)
      .slice(0, 3);
  }

  // Default: Groq
  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content || "";
    return response
      .split("\n")
      .map((q) => q.replace(/^\d+\.\s*/, "").trim())
      .filter((q) => q.length > 0)
      .slice(0, 3);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("401") || errorMessage.includes("403") || errorMessage.includes("Forbidden") || errorMessage.includes("Unauthorized")) {
      logger.error({ err: error }, "Groq API authentication failed for suggestions");
      return []; // Return empty suggestions on auth failure
    }
    throw error;
  }

  // Commented out Gemini code - preserved for reference
  // /*
  // // Default: Gemini
  // try {
  //   const model = gemini.getGenerativeModel({ model: "gemini-2.0-flash" });
  //   const result = await model.generateContent(prompt);
  //   const response = result.response.text() || "";
  //   return response
  //     .split("\n")
  //     .map((q) => q.replace(/^\d+\.\s*/, "").trim())
  //     .filter((q) => q.length > 0)
  //     .slice(0, 3);
  // } catch (error) {
  //   const errorMessage = error instanceof Error ? error.message : String(error);
  //   if (errorMessage.includes("403") || errorMessage.includes("Forbidden")) {
  //     logger.error({ err: error }, "Gemini API authentication failed for suggestions");
  //     return []; // Return empty suggestions on auth failure
  //   }
  //   throw error;
  // }
  // */
}

/**
 * Translate text to the target language
 */
export async function translateText(text: string, language: string = "en"): Promise<string> {
  if (language === "en") return text;

  const languageMap: Record<string, string> = {
    hi: "Hindi (हिन्दी)",
    bn: "Bengali (বাংলা)",
    te: "Telugu (తెలుగు)",
    ta: "Tamil (தமிழ்)",
    ml: "Malayalam (മലയാളം)",
    pa: "Punjabi (ਪੰਜਾਬੀ)",
    ur: "Urdu (اردو)",
  };

  const targetLanguage = languageMap[language] || language;

  const prompt = `Translate the following text to ${targetLanguage}. Keep technical terms and numbers in English. Return ONLY the translated text, nothing else.

Text: ${text}`;

  try {
    // Use Local LLM if configured
    if (LLM_PROVIDER === "local") {
      return await generateLocalResponse(prompt);
    }

    // Default: Groq
    try {
      const completion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.3-70b-versatile",
        temperature: 0.3,
        max_tokens: 1000,
      });
      return completion.choices[0]?.message?.content?.trim() || text;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("401") || errorMessage.includes("403") || errorMessage.includes("Forbidden") || errorMessage.includes("Unauthorized")) {
        logger.error({ err: error, text, language }, "Groq API authentication failed for translation");
        return text; // Fallback to original text on auth failure
      }
      throw error;
    }

    // Commented out Gemini code
    /*
    // Default: Gemini
    try {
      const model = gemini.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent(prompt);
      return result.response.text()?.trim() || text;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("403") || errorMessage.includes("Forbidden")) {
        logger.error({ err: error, text, language }, "Gemini API authentication failed for translation");
        return text; // Fallback to original text on auth failure
      }
      throw error;
    }
    */
  } catch (error) {
    logger.error({ err: error, text, language }, "Translation failed");
    return text; // Fallback to original text
  }
}
