// ============================================================================
// AUDIT'X MINI — CONVERSATION-DRIVEN INTENT ROUTER & MULTI-TURN CONTEXT ENGINE
// Classifies user messages into:
//   normal_question | history_request | new_chat | delete_history |
//   pdf_request | plan_request | remember_note | regenerate |
//   voice_request | out_of_scope
// Supports English, Kannada transliteration, Hinglish, typos, and slash commands.
// ============================================================================

export const INTENT_TYPES = {
  NORMAL_QUESTION: "normal_question",
  HISTORY_REQUEST: "history_request",
  NEW_CHAT: "new_chat",
  DELETE_HISTORY: "delete_history",
  PDF_REQUEST: "pdf_request",
  PLAN_REQUEST: "plan_request",
  REMEMBER_NOTE: "remember_note",
  REGENERATE: "regenerate",
  VOICE_REQUEST: "voice_request",
  OUT_OF_SCOPE: "out_of_scope",
};

/**
 * Normalizes user text for resilient matching (handles typos, punctuation, casing).
 */
export function normalizeQuery(raw = "") {
  return String(raw || "")
    .toLowerCase()
    .replace(/[^\w\s/?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detects if a short user message is an affirmative or negative reply to a pending bot question.
 */
export function detectYesNo(raw = "") {
  const norm = normalizeQuery(raw);
  const yesWords = [
    "yes", "y", "yeah", "yep", "yup", "sure", "ok", "okay", "please",
    "go ahead", "do it", "generate", "download", "haan", "ha", "houdu", "udu",
    "confirm", "proceed",
  ];
  const noWords = [
    "no", "n", "nope", "nah", "cancel", "stop", "dont", "do not", "illa", "nahi",
  ];
  if (yesWords.includes(norm) || yesWords.some((w) => norm === `${w} please`)) {
    return "yes";
  }
  if (noWords.includes(norm)) {
    return "no";
  }
  return null;
}

/**
 * Detects which of the 3 PDF options a user is choosing when replying to the PDF prompt
 * or requesting a specific PDF directly.
 * Returns "chat" | "plan" | "viva" | null
 */
export function detectPdfOptionType(raw = "") {
  const norm = normalizeQuery(raw);

  if (
    norm === "1" ||
    norm === "option 1" ||
    norm === "a" ||
    norm === "first" ||
    norm === "first one" ||
    norm.includes("transcript") ||
    norm.includes("this chat") ||
    norm.includes("our conversation") ||
    norm.includes("our chat") ||
    norm.includes("chat pdf") ||
    norm.includes("full chat")
  ) {
    // Notice: if they explicitly say "project plan" or "viva", let those win below
    if (!norm.includes("project plan") && !norm.includes("viva")) {
      return "chat";
    }
  }

  if (
    norm === "2" ||
    norm === "option 2" ||
    norm === "b" ||
    norm === "second" ||
    norm === "second one" ||
    norm.includes("project plan") ||
    norm.includes("progress report") ||
    norm.includes("what have you done") ||
    norm.includes("send the project plan") ||
    norm.includes("plan pdf") ||
    norm.includes("report pdf")
  ) {
    return "plan";
  }

  if (
    norm === "3" ||
    norm === "option 3" ||
    norm === "c" ||
    norm === "third" ||
    norm === "third one" ||
    norm.includes("viva") ||
    norm.includes("question and answer") ||
    norm.includes("questions and answers") ||
    norm.includes("question sheet") ||
    norm.includes("q and a") ||
    norm.includes("qa sheet")
  ) {
    return "viva";
  }

  return null;
}

/**
 * Classifies a user message into one of the 10 core intents.
 * Takes `pendingState` into account for multi-turn confirmations.
 */
export function classifyUserIntent(rawInput = "", pendingState = null) {
  const trimmed = String(rawInput || "").trim();
  const norm = normalizeQuery(trimmed);

  if (!norm) {
    return { intent: INTENT_TYPES.NORMAL_QUESTION, meta: {} };
  }

  // --------------------------------------------------------------------------
  // 0. HANDLE ACTIVE MULTI-TURN CONFIRMATION STATES FIRST
  // --------------------------------------------------------------------------
  if (pendingState?.type === "confirm_delete_history") {
    const yn = detectYesNo(trimmed);
    if (yn === "yes") {
      return { intent: INTENT_TYPES.DELETE_HISTORY, meta: { confirmed: true } };
    }
    if (yn === "no") {
      return { intent: INTENT_TYPES.DELETE_HISTORY, meta: { confirmed: false } };
    }
  }

  if (pendingState?.type === "choose_pdf_type") {
    const chosen = detectPdfOptionType(trimmed);
    if (chosen) {
      return { intent: INTENT_TYPES.PDF_REQUEST, meta: { pdfType: chosen, fromClarification: true } };
    }
    const yn = detectYesNo(trimmed);
    if (yn === "no") {
      return { intent: INTENT_TYPES.PDF_REQUEST, meta: { cancelled: true } };
    }
  }

  if (pendingState?.type === "offer_plan_pdf") {
    const yn = detectYesNo(trimmed);
    if (yn === "yes" || norm.includes("pdf") || norm.includes("download")) {
      return { intent: INTENT_TYPES.PDF_REQUEST, meta: { pdfType: "plan", fromPlanOffer: true } };
    }
  }

  // --------------------------------------------------------------------------
  // 1. QUIET SLASH COMMAND ROUTING (NO UI HINTS, HANDLED SILENTLY)
  // --------------------------------------------------------------------------
  if (trimmed.startsWith("/")) {
    const cmd = trimmed.toLowerCase().split(/\s+/)[0];
    if (cmd === "/pdf") {
      return { intent: INTENT_TYPES.PDF_REQUEST, meta: { pdfType: null } };
    }
    if (cmd === "/plan") {
      return { intent: INTENT_TYPES.PLAN_REQUEST, meta: {} };
    }
    if (cmd === "/history") {
      return { intent: INTENT_TYPES.HISTORY_REQUEST, meta: { subType: "list" } };
    }
    if (cmd === "/team") {
      return { intent: INTENT_TYPES.NORMAL_QUESTION, meta: { topicOverride: "team_roles_hierarchy" } };
    }
    if (cmd === "/sla") {
      return { intent: INTENT_TYPES.NORMAL_QUESTION, meta: { topicOverride: "sla_timer_workflow" } };
    }
    if (cmd === "/bays") {
      return { intent: INTENT_TYPES.NORMAL_QUESTION, meta: { topicOverride: "staging_bays_racks" } };
    }
    if (cmd === "/stack") {
      return { intent: INTENT_TYPES.NORMAL_QUESTION, meta: { topicOverride: "tech_stack_database_apis" } };
    }
  }

  // --------------------------------------------------------------------------
  // 2. DELETE / CLEAR HISTORY INTENT
  // --------------------------------------------------------------------------
  if (
    norm.includes("delete my history") ||
    norm.includes("delete all history") ||
    norm.includes("delete history") ||
    norm.includes("clear everything") ||
    norm.includes("clear my history") ||
    norm.includes("clear history") ||
    norm.includes("erase history") ||
    norm.includes("wipe history") ||
    norm.includes("delete saved chats")
  ) {
    return { intent: INTENT_TYPES.DELETE_HISTORY, meta: { confirmed: null } };
  }

  // --------------------------------------------------------------------------
  // 3. START NEW CHAT / FORGET THIS SESSION INTENT
  // --------------------------------------------------------------------------
  if (
    norm === "new chat" ||
    norm === "start a new chat" ||
    norm === "start new chat" ||
    norm === "new conversation" ||
    norm === "start a new conversation" ||
    norm === "forget this" ||
    norm === "reset chat" ||
    norm === "fresh chat"
  ) {
    return { intent: INTENT_TYPES.NEW_CHAT, meta: {} };
  }

  // --------------------------------------------------------------------------
  // 4. HISTORY / PAST CHATS / SUMMARIZE / REOPEN ARCHIVED CHAT INTENT
  // --------------------------------------------------------------------------
  if (
    norm.includes("show my old chats") ||
    norm.includes("old chats") ||
    norm.includes("past chats") ||
    norm.includes("previous chats") ||
    norm.includes("saved chats") ||
    norm.includes("chat history") ||
    norm.includes("show history")
  ) {
    return { intent: INTENT_TYPES.HISTORY_REQUEST, meta: { subType: "list" } };
  }

  if (
    norm.includes("what did we talk about") ||
    norm.includes("what did i ask before") ||
    norm.includes("what did i ask earlier") ||
    norm.includes("what have i asked") ||
    norm.includes("summarize our chat") ||
    norm.includes("summarise our chat") ||
    norm.includes("summarize this chat") ||
    norm.includes("summarize chat") ||
    norm.includes("summary of our chat") ||
    norm.includes("recap our chat")
  ) {
    return { intent: INTENT_TYPES.HISTORY_REQUEST, meta: { subType: "summary" } };
  }

  if (
    norm.startsWith("open my chat about ") ||
    norm.startsWith("open chat about ") ||
    norm.startsWith("go back to the chat ") ||
    norm.startsWith("go back to my chat ") ||
    norm.startsWith("find my chat about ") ||
    norm.startsWith("load chat about ")
  ) {
    const searchTopic = norm
      .replace(/^open (my )?chat about /, "")
      .replace(/^go back to (the |my )?chat (where i asked )?(about )?/, "")
      .replace(/^find (my )?chat about /, "")
      .replace(/^load chat about /, "")
      .trim();
    return { intent: INTENT_TYPES.HISTORY_REQUEST, meta: { subType: "search", searchTopic } };
  }

  // --------------------------------------------------------------------------
  // 5. VOICE / READ-ALOUD INTENT
  // --------------------------------------------------------------------------
  if (
    norm === "read this aloud" ||
    norm === "read aloud" ||
    norm === "speak" ||
    norm === "speak this" ||
    norm === "read it aloud" ||
    norm === "read that aloud" ||
    norm === "voice" ||
    norm.includes("read this out loud")
  ) {
    return { intent: INTENT_TYPES.VOICE_REQUEST, meta: {} };
  }

  // --------------------------------------------------------------------------
  // 6. REMEMBER / PIN KEY POINT INTENT
  // --------------------------------------------------------------------------
  if (
    norm === "remember this" ||
    norm === "save this answer" ||
    norm === "note this point" ||
    norm === "pin this" ||
    norm === "pin this answer" ||
    norm === "save this point" ||
    norm === "keep this in mind" ||
    norm.startsWith("remember that ") ||
    norm.startsWith("note this ")
  ) {
    return { intent: INTENT_TYPES.REMEMBER_NOTE, meta: { customNote: trimmed } };
  }

  // --------------------------------------------------------------------------
  // 7. REGENERATE / SHORTER / MORE DETAILED INTENT
  // --------------------------------------------------------------------------
  if (
    norm === "explain again" ||
    norm === "give another answer" ||
    norm === "regenerate" ||
    norm === "try again" ||
    norm === "rephrase" ||
    norm === "rephrase that"
  ) {
    return { intent: INTENT_TYPES.REGENERATE, meta: { style: "retry" } };
  }
  if (
    norm === "make it shorter" ||
    norm === "shorter" ||
    norm === "keep it short" ||
    norm === "in short" ||
    norm === "briefly" ||
    norm.includes("make that shorter")
  ) {
    return { intent: INTENT_TYPES.REGENERATE, meta: { style: "shorter" } };
  }
  if (
    norm === "make it more detailed" ||
    norm === "more detailed" ||
    norm === "explain in detail" ||
    norm === "elaborate" ||
    norm === "in depth" ||
    norm.includes("give more detail")
  ) {
    return { intent: INTENT_TYPES.REGENERATE, meta: { style: "detailed" } };
  }

  // --------------------------------------------------------------------------
  // 8. PDF EXPORT INTENT
  // --------------------------------------------------------------------------
  const asksForPdf =
    norm.includes("pdf") ||
    norm.includes("download our conversation") ||
    norm.includes("download this chat") ||
    norm.includes("export chat") ||
    norm.includes("export our conversation") ||
    norm.includes("viva question sheet");

  if (asksForPdf) {
    // Check if the user already specified which of the 3 PDF types they want
    // Note: "download this chat as pdf" or "give me this chat as pdf" or "export chat"
    // is the canonical trigger where the user wants the bot to ask the clarifying question
    // with the 3 options unless they specifically asked for "project plan" or "viva".
    let explicitType = null;
    if (
      norm.includes("project plan") ||
      norm.includes("progress report") ||
      norm.includes("what have you done")
    ) {
      explicitType = "plan";
    } else if (
      norm.includes("viva") ||
      norm.includes("question sheet") ||
      norm.includes("question and answer") ||
      norm.includes("q and a")
    ) {
      explicitType = "viva";
    }
    return { intent: INTENT_TYPES.PDF_REQUEST, meta: { pdfType: explicitType } };
  }

  // --------------------------------------------------------------------------
  // 9. PROJECT PLAN / PROGRESS REPORT (TEXT FIRST, THEN OFFER PDF)
  // --------------------------------------------------------------------------
  if (
    norm.includes("project plan") ||
    norm.includes("what did you do") ||
    norm.includes("what have you done") ||
    norm.includes("show your work") ||
    norm.includes("progress report") ||
    norm.includes("work completed") ||
    norm.includes("modules completed")
  ) {
    return { intent: INTENT_TYPES.PLAN_REQUEST, meta: {} };
  }

  // --------------------------------------------------------------------------
  // 10. OUT-OF-SCOPE CHECK (PROJECT-ONLY SCOPE GUARDRAIL)
  // --------------------------------------------------------------------------
  if (isStrictlyOutOfScope(norm, pendingState)) {
    return { intent: INTENT_TYPES.OUT_OF_SCOPE, meta: {} };
  }

  return { intent: INTENT_TYPES.NORMAL_QUESTION, meta: {} };
}

/**
 * Checks whether a query is unrelated to AUDIT'X while allowing conversational
 * follow-ups ("tell me more about him", "explain the second one", greetings, etc.).
 */
export function isStrictlyOutOfScope(norm = "", pendingState = null) {
  // Always allow follow-up pronouns and conversational continuations
  const conversationalWords = [
    "audit", "auditx", "store", "dark store", "warehouse", "picker", "rider", "captain",
    "order", "ordering", "sla", "rack", "bay", "bays", "sku", "skus", "chocolate", "chocolates",
    "frame", "frames", "bhaskar", "deepu", "harshitha", "thrupthi", "sinchana", "tiptur",
    "kfgsc", "kalpataru", "ka44", "ka 44", "wallet", "complaint", "complaints", "helpdesk",
    "grn", "dad", "erd", "dfd", "table", "tables", "database", "schema", "api", "apis",
    "endpoint", "endpoints", "route", "routes", "next", "nextjs", "react", "firebase",
    "firestore", "vercel", "pdf", "export", "download", "report", "plan", "viva", "question",
    "summary", "summarize", "history", "chat", "team", "author", "authors", "creator", "built",
    "developed", "member", "members", "role", "roles", "sm", "asm", "md", "timer", "countdown",
    "qr", "barcode", "handover", "doorstep", "rate", "rating", "sound", "audio", "video",
    "tasksearching", "limitation", "limitations", "roadmap", "future", "phase", "yolov8",
    "prophet", "lstm", "amr", "test", "testing", "build", "module", "modules", "progress",
    "prototype", "foam", "physical", "model", "aisle", "bin", "margin", "shrinkage", "otp",
    "login", "pin", "staff", "hub", "delivery", "transit", "minute", "minutes", "second",
    "seconds", "ganesha", "akshayakalpa", "jatre", "blinkit", "zepto", "quick commerce",
    // Conversational follow-ups & greetings
    "hello", "hi", "hey", "namaskara", "namaste", "good morning", "good evening", "thanks",
    "thank you", "who", "what", "how", "why", "where", "explain", "tell me more", "more about",
    "him", "her", "them", "his", "hers", "their", "it", "this", "that", "second", "first",
    "third", "next", "detail", "details", "example",
  ];

  // Explicit off-topic subjects (general trivia, geography, sports, cooking, politics, etc.)
  const offTopicSubjects = [
    "capital of", "france", "paris", "president of", "prime minister", "weather", "temperature",
    "cricket", "ipl", "virat", "rohit", "football", "fifa", "messi", "ronaldo", "movie",
    "actor", "actress", "bollywood", "hollywood", "song", "lyrics", "poem", "write a poem",
    "tell me a joke", "joke", "recipe", "biryani", "pasta", "pizza", "bitcoin", "ethereum",
    "stock market", "nasdaq", "horoscope", "astrology", "biology", "photosynthesis",
    "solar system", "mars", "jupiter", "world war", "napoleon", "einstein", "newton",
  ];

  if (offTopicSubjects.some((subj) => norm.includes(subj))) {
    // Only allow if explicitly tied to AUDIT'X
    if (!norm.includes("audit") && !norm.includes("tiptur") && !norm.includes("warehouse")) {
      return true;
    }
  }

  if (conversationalWords.some((w) => norm.includes(w))) {
    return false;
  }

  // If short unknown phrase and we have active conversation context, treat as follow-up
  if (pendingState?.lastTopic && norm.split(" ").length <= 6) {
    return false;
  }

  return true;
}

