import { NextResponse } from "next/server";
import { Schema, SchemaType } from "@google/generative-ai";
import { getGemini } from "@/lib/geminiClient";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

const responseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    profile: {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING },
        age: { type: SchemaType.NUMBER },
        gender: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["Male", "Female", "Transgender", "All"],
        },
        state: { type: SchemaType.STRING },
        district: { type: SchemaType.STRING },
        community: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["General", "OBC", "MBC", "SC", "ST", "PVTG", "BC", "DNC"],
        },
        income_annual: { type: SchemaType.NUMBER },
        ration_card: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["PHH", "AAY", "NPHH", "None"],
        },
        occupation: { type: SchemaType.STRING },
        medical_need: { type: SchemaType.STRING },
        education_need: { type: SchemaType.STRING },
        condition: { type: SchemaType.STRING },
        general_need: { type: SchemaType.STRING },
        detected_language: { type: SchemaType.STRING },
      },
      required: ["detected_language"],
    },
    conversational_response: { type: SchemaType.STRING },
    search_terms: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    dynamic_followup: {
      type: SchemaType.OBJECT,
      properties: {
        question: { type: SchemaType.STRING },
        chips: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              label: { type: SchemaType.STRING },
              narrowing_keyword: { type: SchemaType.STRING },
            },
            required: ["label", "narrowing_keyword"],
          },
        },
      },
      required: ["question", "chips"],
    },
  },
  required: ["profile", "conversational_response", "search_terms"],
};

const SYSTEM_INSTRUCTION =
  "You are Namma-Urimai (Our Rights), an empathetic, expert Indian government welfare scheme navigator. " +
  "Analyze the citizen's message in English, Tamil, Hindi, Telugu, or romanized text: " +
  "1. Extract citizen parameters into 'profile'. Preserve and merge any previously accumulated profile data. Leave unknown fields empty. " +
  "   - Ration Card: 'Rice Card', 'BPL Card', 'Green Card', or 'அரிசி அட்டை' map to 'PHH'. 'Sugar Card', 'White Card', or 'சர்க்கரை அட்டை' map to 'NPHH'. 'Antyodaya' maps to 'AAY'. 'No ration card' maps to 'None'. " +
  "   - Location inference: If a city or district is named without state, infer state (Chennai, Madurai, Coimbatore, Tiruchirappalli, Salem -> Tamil Nadu; Bengaluru -> Karnataka; Mumbai -> Maharashtra; etc.). " +
  "   - Income inference: If citizen mentions income: '< 1 Lakh' or 'below 1 lakh' set income_annual to 90000; '1 Lakh - 2.5 Lakhs' or '< 2.5 Lakhs' or 'below 2.5 lakhs' set income_annual to 200000; '2.5 Lakhs - 5 Lakhs' or '< 5 Lakhs' or 'below 5 lakhs' set income_annual to 400000; '> 5 Lakhs' or 'above 5 lakhs' set income_annual to 600000. NEVER omit income_annual when user shares income! " +
  "   - Condition inference: 'Destitute / No Family Support', 'Differently Abled Senior', 'Destitute Widow', 'Farmer Senior', etc. set 'condition' and 'general_need'. " +
  "   - Need / Age inference: 'Old age pension' implies senior citizen (set age to 65 and general_need to 'Old Age Pension'). " +
  "2. Write 'conversational_response' in the citizen's detected language (or English if typed in English). " +
  "   Speak warmly as an authoritative civic advisor. Acknowledge their situation and explain how government welfare schemes can support them. Keep it clear, comforting, and 2 sentences. " +
  "3. Generate 2 to 4 'search_terms' for database search. " +
  "4. Contextual Narrowing Hierarchy ('dynamic_followup'): " +
  "   GOAL: Systematically reduce the matching scheme count to <= 5 high-precision schemes using a high-impact question ordering. " +
  "   ORDER OF PRIORITIZED QUESTIONS: " +
  "   Step 1 (State Filter): If citizen's 'state' is NOT yet specified, ask: 'Which state are you currently living in?' with chips: ['📍 Tamil Nadu', '📍 Karnataka', '📍 Maharashtra', '✏️ Other State']. (Narrowing keyword: the state name, or 'other' for Other State). " +
  "   Step 2 (Income Filter): If 'state' is already known, but 'income_annual' is NOT yet specified, ask: 'What is your approximate family annual income?' with chips: ['💰 Below ₹1 Lakh', '💵 ₹1 Lakh - ₹2.5 Lakhs', '💳 ₹2.5 Lakhs - ₹5 Lakhs', '💼 Above ₹5 Lakhs']. (Narrowing keyword: 'below 1 lakh', 'below 2.5 lakhs', 'below 5 lakhs', 'above 5 lakhs'). " +
  "   Step 3 (Domain Sub-Type Filter): If both state and income are known, or if domain requires urgent specific qualification: " +
  "     - Education: ask education stage ['🏫 Class 11-12', '🎓 College / Undergrad', '🔬 Postgraduate', '⚙️ Diploma / Polytechnic']. " +
  "     - Pension: ask living status ['🏠 Destitute / No Family Support', '🦽 Differently Abled Senior', '👵 Destitute Widow', '🌾 Farmer Senior']. " +
  "     - Surgery / Healthcare: ask ration card ['🍚 Rice Card (PHH)', '🍬 Sugar Card (NPHH)', '🚫 No Card']. " +
  "     - Agriculture: ask farm type ['🌱 Small/Marginal Farmer (< 5 Acres)', '🚜 Large Farmer (> 5 Acres)', '🐄 Dairy / Livestock Cultivator']. " +
  "   Step 4 (Completion): If citizen details are already complete or specific enough to pinpoint <= 5 schemes, set 'dynamic_followup.question' to '' and 'chips' to []. Do NOT ask unnecessary questions!";

// Retries transient 503 / "Service Unavailable" errors up to 2 times with backoff
async function generateWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  const delaysMs = [1000, 2000];
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const transient = msg.includes("503") || msg.includes("Service Unavailable");
      if (!transient || attempt >= delaysMs.length) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, delaysMs[attempt]));
    }
  }
}

export async function POST(request: Request) {
  let message: unknown;
  let existingProfile: unknown;
  let history: unknown;

  try {
    const body = await request.json();
    message = body?.message;
    existingProfile = body?.profile;
    history = body?.history;
  } catch {
    message = undefined;
  }

  if (typeof message !== "string" || message.trim() === "") {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const model = process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest";

  try {
    const generativeModel = getGemini().getGenerativeModel({
      model,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
      },
    });

    let prompt = `${SYSTEM_INSTRUCTION}\n`;
    if (existingProfile && typeof existingProfile === "object") {
      prompt += `\nPreviously accumulated citizen profile:\n${JSON.stringify(existingProfile)}\n`;
    }
    if (Array.isArray(history) && history.length > 0) {
      prompt += `\nRecent conversation history:\n${JSON.stringify(history.slice(-4))}\n`;
    }
    prompt += `\nCurrent citizen message:\n${message}`;

    const result = await generateWithRetry(() => generativeModel.generateContent(prompt));
    const parsed = JSON.parse(result.response.text());

    // Merge existing profile with newly extracted values
    const mergedProfile: Profile = {
      ...(typeof existingProfile === "object" && existingProfile !== null ? (existingProfile as Profile) : {}),
      ...(parsed.profile || {}),
    };

    // Deterministic rule-based extraction to guarantee income and needs are preserved everywhere
    const lowerMsg = message.toLowerCase();
    if (!mergedProfile.income_annual) {
      if (
        lowerMsg.includes("1 lakh -") ||
        lowerMsg.includes("1 to 2.5") ||
        lowerMsg.includes("below 2.5") ||
        lowerMsg.includes("< 2.5") ||
        lowerMsg.includes("₹1 lakh")
      ) {
        mergedProfile.income_annual = 200000;
      } else if (
        lowerMsg.includes("below 1 lakh") ||
        lowerMsg.includes("< 1 lakh") ||
        lowerMsg.includes("under 1 lakh")
      ) {
        mergedProfile.income_annual = 90000;
      } else if (
        lowerMsg.includes("2.5 lakh -") ||
        lowerMsg.includes("2.5 to 5") ||
        lowerMsg.includes("below 5") ||
        lowerMsg.includes("< 5")
      ) {
        mergedProfile.income_annual = 400000;
      } else if (
        lowerMsg.includes("above 5 lakh") ||
        lowerMsg.includes("> 5 lakh") ||
        lowerMsg.includes("over 5 lakh")
      ) {
        mergedProfile.income_annual = 600000;
      }
    }

    if (lowerMsg.includes("destitute") || lowerMsg.includes("no family support")) {
      mergedProfile.condition = "Destitute / No Family Support";
      if (!mergedProfile.general_need) mergedProfile.general_need = "Old Age Pension / Destitute support";
    } else if (lowerMsg.includes("differently abled") || lowerMsg.includes("disab")) {
      mergedProfile.condition = "Differently Abled Senior";
      if (!mergedProfile.general_need) mergedProfile.general_need = "Disability assistance";
    } else if (lowerMsg.includes("widow")) {
      mergedProfile.condition = "Destitute Widow";
      if (!mergedProfile.general_need) mergedProfile.general_need = "Widow pension";
    }

    if (lowerMsg.includes("pension") || lowerMsg.includes("old age")) {
      if (!mergedProfile.general_need) mergedProfile.general_need = "Old Age Pension";
      if (!mergedProfile.age) mergedProfile.age = 65;
    }

    if (!mergedProfile.state) {
      if (lowerMsg.includes("tamil nadu") || lowerMsg.includes("chennai")) mergedProfile.state = "Tamil Nadu";
      else if (lowerMsg.includes("karnataka") || lowerMsg.includes("bengaluru")) mergedProfile.state = "Karnataka";
      else if (lowerMsg.includes("maharashtra") || lowerMsg.includes("mumbai")) mergedProfile.state = "Maharashtra";
      else if (lowerMsg.includes("kerala")) mergedProfile.state = "Kerala";
      else if (lowerMsg.includes("telangana")) mergedProfile.state = "Telangana";
      else if (lowerMsg.includes("andhra")) mergedProfile.state = "Andhra Pradesh";
    }

    return NextResponse.json({
      profile: mergedProfile,
      conversational_response: parsed.conversational_response,
      search_terms: parsed.search_terms ?? [],
      dynamic_followup:
        parsed.dynamic_followup &&
        parsed.dynamic_followup.question &&
        Array.isArray(parsed.dynamic_followup.chips) &&
        parsed.dynamic_followup.chips.length > 0
          ? parsed.dynamic_followup
          : null,
    });
  } catch (err) {
    const errName = err instanceof Error ? err.name : "Error";
    const errMessage = (err instanceof Error ? err.message : String(err))
      .replace(/AIza[0-9A-Za-z_-]+|AQ\.[0-9A-Za-z_-]+/g, "<REDACTED>")
      .slice(0, 400);
    console.error("chat: profile extraction failed:", errName, errMessage);
    return NextResponse.json(
      { error: "Could not process the message right now" },
      { status: 502 }
    );
  }
}
