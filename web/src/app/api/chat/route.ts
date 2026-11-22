import { NextResponse } from "next/server";
import { getGemini } from "@/lib/geminiClient";
import type { DynamicFollowup, Profile } from "@/lib/types";
import { SchemaType, type ResponseSchema } from "@google/generative-ai";

export const runtime = "nodejs";

const responseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    profile: {
      type: SchemaType.OBJECT,
      properties: {
        age: { type: SchemaType.NUMBER },
        gender: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["female", "male", "transgender", "other"],
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
  "   - Income inference: If citizen mentions income: '< 1 Lakh' or 'below 1 lakh' set income_annual to 90000; '1 Lakh - 2.5 Lakhs' or '< 2.5 Lakhs' or 'below 2.5 lakhs' set income_annual to 200000; '2.5 Lakhs - 5 Lakhs' or '< 5 Lakhs' or 'below 5 lakhs' set income_annual to 400000; '> 5 Lakhs' or 'above 5 lakhs' set income_annual to 600000. NEVER omit or zero income_annual when user shares income! " +
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

// Rule-based deterministic emergency fallback if LLM endpoint encounters 503 high demand or network timeout
function buildDeterministicFallback(message: string, existingProfile: unknown): {
  profile: Profile;
  conversational_response: string;
  search_terms: string[];
  dynamic_followup: DynamicFollowup | null;
} {
  const lowerMsg = message.toLowerCase();
  const rawExisting =
    typeof existingProfile === "object" && existingProfile !== null
      ? (existingProfile as Record<string, unknown>)
      : {};

  const profile: Profile = { ...(rawExisting as unknown as Profile) };

  // Language check
  let detectedLang = "en";
  if (/[\u0B80-\u0BFF]/.test(message)) detectedLang = "ta";
  else if (/[\u0900-\u097F]/.test(message)) detectedLang = "hi";
  else if (/[\u0C00-\u0C7F]/.test(message)) detectedLang = "te";
  profile.detected_language = detectedLang;

  // State extraction
  if (!profile.state) {
    if (lowerMsg.includes("tamil nadu") || lowerMsg.includes("chennai") || lowerMsg.includes("coimbatore") || lowerMsg.includes("madurai")) profile.state = "Tamil Nadu";
    else if (lowerMsg.includes("karnataka") || lowerMsg.includes("bengaluru")) profile.state = "Karnataka";
    else if (lowerMsg.includes("maharashtra") || lowerMsg.includes("mumbai")) profile.state = "Maharashtra";
    else if (lowerMsg.includes("kerala")) profile.state = "Kerala";
    else if (lowerMsg.includes("telangana") || lowerMsg.includes("hyderabad")) profile.state = "Telangana";
    else if (lowerMsg.includes("andhra")) profile.state = "Andhra Pradesh";
  }

  // Income extraction
  if (!profile.income_annual) {
    if (lowerMsg.includes("1 lakh -") || lowerMsg.includes("below 2.5") || lowerMsg.includes("< 2.5") || lowerMsg.includes("1 to 2.5") || lowerMsg.includes("₹1 lakh")) {
      profile.income_annual = 200000;
    } else if (lowerMsg.includes("below 1 lakh") || lowerMsg.includes("< 1 lakh")) {
      profile.income_annual = 90000;
    } else if (lowerMsg.includes("2.5 lakh -") || lowerMsg.includes("below 5") || lowerMsg.includes("< 5")) {
      profile.income_annual = 400000;
    } else if (lowerMsg.includes("above 5 lakh") || lowerMsg.includes("> 5 lakh")) {
      profile.income_annual = 600000;
    }
  }

  // Condition & Needs
  let conversationalResponse = "We understand your situation and are identifying the government welfare schemes you qualify for.";
  let searchTerms: string[] = [];
  let dynamicFollowup: DynamicFollowup | null = null;

  const isEdu = lowerMsg.includes("scholar") || lowerMsg.includes("student") || lowerMsg.includes("education") || lowerMsg.includes("college") || lowerMsg.includes("school");
  const isPension = lowerMsg.includes("pension") || lowerMsg.includes("old age") || lowerMsg.includes("senior citizen");
  const isHealth = lowerMsg.includes("surgery") || lowerMsg.includes("hernia") || lowerMsg.includes("health") || lowerMsg.includes("hospital") || lowerMsg.includes("medical") || lowerMsg.includes("treatment");
  const isFarmer = lowerMsg.includes("farmer") || lowerMsg.includes("agriculture") || lowerMsg.includes("kisan") || lowerMsg.includes("crop");

  if (isEdu) {
    profile.education_need = profile.education_need || "College / Higher Education Scholarship";
    profile.general_need = profile.general_need || "Scholarship";
    conversationalResponse =
      detectedLang === "ta"
        ? "மாணவர்களுக்கான கல்வி உதவித்தொகை மற்றும் கட்டண சலுகை திட்டங்களை கண்டறிந்துள்ளோம்."
        : "We understand you are seeking educational scholarships and student support. Here are the active government schemes matching your academic needs:";
    searchTerms = ["scholarship", "students", "education", "tuition"];

    if (!profile.state) {
      dynamicFollowup = {
        question: "Which state are you currently studying or living in?",
        chips: [
          { label: "📍 Tamil Nadu", narrowing_keyword: "Tamil Nadu" },
          { label: "📍 Karnataka", narrowing_keyword: "Karnataka" },
          { label: "📍 Maharashtra", narrowing_keyword: "Maharashtra" },
          { label: "✏️ Other State", narrowing_keyword: "other" },
        ],
      };
    } else if (!profile.community) {
      dynamicFollowup = {
        question: "Which community or academic quota applies to you?",
        chips: [
          { label: "👥 BC / MBC / DNC", narrowing_keyword: "BC MBC" },
          { label: "👥 SC / ST", narrowing_keyword: "SC ST" },
          { label: "🎓 First Graduate", narrowing_keyword: "First Graduate" },
          { label: "🌐 General / Open", narrowing_keyword: "General" },
        ],
      };
    }
  } else if (isPension) {
    profile.general_need = "Old Age Pension";
    if (!profile.age) profile.age = 65;
    if (lowerMsg.includes("destitute") || lowerMsg.includes("no family support")) {
      profile.condition = "Destitute / No Family Support";
    }

    conversationalResponse =
      detectedLang === "ta"
        ? "முதியோர் ஓய்வூதியம் மற்றும் முதியவர்களுக்கான சமூக பாதுகாப்பு திட்டங்களை கண்டறிந்துள்ளோம்."
        : "As a senior citizen, you may be eligible for old age pension schemes providing monthly financial security. Here are the verified programs for you:";
    searchTerms = ["old age pension", "senior citizen pension", "social security pension"];

    if (!profile.state) {
      dynamicFollowup = {
        question: "Which state are you currently living in?",
        chips: [
          { label: "📍 Tamil Nadu", narrowing_keyword: "Tamil Nadu" },
          { label: "📍 Karnataka", narrowing_keyword: "Karnataka" },
          { label: "📍 Maharashtra", narrowing_keyword: "Maharashtra" },
          { label: "✏️ Other State", narrowing_keyword: "other" },
        ],
      };
    } else if (!profile.income_annual) {
      dynamicFollowup = {
        question: "What is your approximate family annual income?",
        chips: [
          { label: "💰 Below ₹1 Lakh", narrowing_keyword: "below 1 lakh" },
          { label: "💵 ₹1 Lakh - ₹2.5 Lakhs", narrowing_keyword: "below 2.5 lakhs" },
          { label: "💳 ₹2.5 Lakhs - ₹5 Lakhs", narrowing_keyword: "below 5 lakhs" },
          { label: "💼 Above ₹5 Lakhs", narrowing_keyword: "above 5 lakhs" },
        ],
      };
    }
  } else if (isHealth) {
    profile.medical_need = profile.medical_need || "Surgery & Cashless Hospitalization";
    conversationalResponse =
      detectedLang === "ta"
        ? "மருத்துவ சிகிச்சை மற்றும் கட்டணமில்லா அறுவை சிகிச்சைக்கான அரசு காப்பீட்டு திட்டங்களை கண்டறிந்துள்ளோம்."
        : "We understand you require medical treatment. Government health insurance schemes provide cashless hospitalization up to ₹5 Lakhs per family across network hospitals:";
    searchTerms = ["health insurance", "cashless treatment", "hospitalization", "surgery"];

    if (!profile.state) {
      dynamicFollowup = {
        question: "Which state and district are you currently living in?",
        chips: [
          { label: "📍 Tamil Nadu", narrowing_keyword: "Tamil Nadu" },
          { label: "📍 Karnataka", narrowing_keyword: "Karnataka" },
          { label: "📍 Maharashtra", narrowing_keyword: "Maharashtra" },
          { label: "✏️ Other State", narrowing_keyword: "other" },
        ],
      };
    } else if (!profile.ration_card) {
      dynamicFollowup = {
        question: "Which ration card does your family hold?",
        chips: [
          { label: "🍚 Rice Card (PHH)", narrowing_keyword: "Rice Card" },
          { label: "🍬 Sugar Card (NPHH)", narrowing_keyword: "Sugar Card" },
          { label: "🚫 No Ration Card", narrowing_keyword: "No Card" },
        ],
      };
    }
  } else if (isFarmer) {
    profile.general_need = "Farmer / Agriculture Subsidy";
    conversationalResponse = "We understand you are seeking agricultural welfare programs. Here are the active government schemes matching your needs:";
    searchTerms = ["farmer", "agriculture", "kisan", "crop subsidy"];

    if (!profile.state) {
      dynamicFollowup = {
        question: "Which state are you currently farming in?",
        chips: [
          { label: "📍 Tamil Nadu", narrowing_keyword: "Tamil Nadu" },
          { label: "📍 Karnataka", narrowing_keyword: "Karnataka" },
          { label: "📍 Maharashtra", narrowing_keyword: "Maharashtra" },
          { label: "✏️ Other State", narrowing_keyword: "other" },
        ],
      };
    }
  } else {
    // General fallback
    const words = message
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !["need", "want", "find", "scheme", "schemes", "government", "give", "help"].includes(w.toLowerCase()));
    searchTerms = words.length > 0 ? words.slice(0, 3) : ["welfare", "assistance"];
    conversationalResponse = "Here are the government welfare schemes matching your criteria:";
    if (!profile.state) {
      dynamicFollowup = {
        question: "Which state are you currently living in?",
        chips: [
          { label: "📍 Tamil Nadu", narrowing_keyword: "Tamil Nadu" },
          { label: "📍 Karnataka", narrowing_keyword: "Karnataka" },
          { label: "📍 Maharashtra", narrowing_keyword: "Maharashtra" },
          { label: "✏️ Other State", narrowing_keyword: "other" },
        ],
      };
    }
  }

  return {
    profile,
    conversational_response: conversationalResponse,
    search_terms: searchTerms,
    dynamic_followup: dynamicFollowup,
  };
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

  const modelName = process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest";

  try {
    const generativeModel = getGemini().getGenerativeModel({
      model: modelName,
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

    const result = await generativeModel.generateContent(prompt);
    const parsed = JSON.parse(result.response.text());

    // Clean merge: never let null/undefined/0/empty string in parsed.profile overwrite an existing profile value
    const rawExisting =
      typeof existingProfile === "object" && existingProfile !== null
        ? (existingProfile as Record<string, unknown>)
        : {};
    const rawParsed =
      typeof parsed.profile === "object" && parsed.profile !== null
        ? (parsed.profile as Record<string, unknown>)
        : {};

    const mergedProfile: Profile = { ...(rawExisting as unknown as Profile) };
    for (const [k, v] of Object.entries(rawParsed)) {
      if (v !== null && v !== undefined && v !== "" && v !== 0) {
        (mergedProfile as Record<string, unknown>)[k] = v;
      }
    }

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
      .slice(0, 200);
    console.warn(`[chat] Gemini API encountered issue (${errName}: ${errMessage}). Engaging deterministic fallback.`);

    // Fallback: seamless rule-based processing so citizen NEVER sees an error
    const fallback = buildDeterministicFallback(message, existingProfile);
    return NextResponse.json(fallback);
  }
}
