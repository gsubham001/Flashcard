const express = require("express");
const cors = require("cors");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const dotenv = require("dotenv");
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      const allowed =
        /^https?:\/\/(localhost|127\.0\.0\.1):(5173|5174|5175)$/.test(origin);
      if (allowed) {
        return callback(null, true);
      }

      return callback(new Error("CORS blocked for this origin."));
    },
  }),
);
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("Missing GEMINI_API_KEY in .env file");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const preferredModel = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const fallbackModels = [
  preferredModel,
  "gemini-2.0-flash",
  "gemini-2.0-flash-001",
];

function extractJsonArray(rawText) {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("Gemini returned an empty response.");
  }

  const fencedJson = rawText.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fencedJson && fencedJson[1]) {
    const parsed = JSON.parse(fencedJson[1]);
    return Array.isArray(parsed) ? parsed : parsed.flashcards || [];
  }

  const plainArray = rawText.match(/\[[\s\S]*\]/);
  if (plainArray && plainArray[0]) {
    return JSON.parse(plainArray[0]);
  }

  const plainObject = JSON.parse(rawText);
  if (Array.isArray(plainObject)) {
    return plainObject;
  }
  if (Array.isArray(plainObject.flashcards)) {
    return plainObject.flashcards;
  }

  throw new Error("Could not parse JSON flashcards from AI response.");
}

function buildFallbackFlashcards(text, targetCount = 10) {
  const cleaned = String(text || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return [];
  }

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 18);

  const sourceBlocks = sentences.length > 0 ? sentences : [cleaned];
  const cards = [];

  for (let index = 0; index < Math.min(sourceBlocks.length, 15); index += 1) {
    const source = sourceBlocks[index];
    const shortAnswer =
      source.length > 220 ? `${source.slice(0, 217)}...` : source;
    cards.push({
      question: `What is the main idea of this part of the PDF? (${index + 1})`,
      answer: shortAnswer,
    });
  }

  if (cards.length < targetCount) {
    const words = cleaned.split(/\s+/).filter(Boolean);
    for (
      let index = cards.length;
      index < targetCount && words.length > 0;
      index += 1
    ) {
      const start = Math.max(0, Math.min(words.length - 1, index * 12));
      const chunk = words.slice(start, start + 12).join(" ");
      cards.push({
        question: `What key detail appears in section ${index + 1}?`,
        answer: chunk || cleaned.slice(0, 220),
      });
    }
  }

  return cards.slice(0, 15);
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "SmartCards server is running." });
});

app.post("/api/generate-flashcards", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Please upload a PDF file." });
    }

    if (
      req.file.mimetype !== "application/pdf" &&
      !String(req.file.originalname || "")
        .toLowerCase()
        .endsWith(".pdf")
    ) {
      return res.status(400).json({ error: "Only PDF files are allowed." });
    }

    const pdfData = await pdfParse(req.file.buffer);
    const text = (pdfData.text || "").trim();

    if (!text) {
      return res
        .status(400)
        .json({ error: "Could not extract text from the PDF." });
    }

    const trimmedText = text.length > 18000 ? text.slice(0, 18000) : text;

    const prompt = `You are a helpful study assistant.
Create 10 to 15 high-quality flashcards from the provided text.
Each flashcard must have:
- question: clear and specific
- answer: concise and accurate

Return ONLY valid JSON array with this exact shape:
[
  { "question": "...", "answer": "..." }
]

Do not include markdown, code fences, or explanations.

Text:
${trimmedText}`;

    let flashcards = [];
    let lastError;

    for (const modelName of fallbackModels) {
      const model = genAI.getGenerativeModel({ model: modelName });

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
            },
          });

          const responseText = result.response.text();

          flashcards = extractJsonArray(responseText)
            .filter((item) => item && item.question && item.answer)
            .map((item) => ({
              question: String(item.question).trim(),
              answer: String(item.answer).trim(),
            }))
            .filter((item) => item.question && item.answer)
            .slice(0, 15);

          if (flashcards.length === 0) {
            lastError = new Error("AI returned no usable flashcards.");
          } else {
            break;
          }
        } catch (attemptError) {
          lastError = attemptError;
        }
      }

      if (flashcards.length >= 10) {
        break;
      }
    }

    if (flashcards.length < 10) {
      flashcards = buildFallbackFlashcards(trimmedText, 10);
    }

    if (flashcards.length === 0) {
      return res.status(400).json({
        error: "Could not generate flashcards from this PDF.",
        details: lastError ? String(lastError.message || lastError) : undefined,
      });
    }

    return res.json({ flashcards });
  } catch (error) {
    console.error("Flashcard generation failed:", error);
    return res.status(500).json({
      error: "Failed to generate flashcards. Please try again.",
      details: String(error.message || error),
    });
  }
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      error: "File upload failed.",
      details: error.message,
    });
  }

  if (error) {
    return res.status(400).json({
      error: "Request blocked.",
      details: error.message,
    });
  }

  return next();
});

const server = app.listen(port, () => {
  console.log(`SmartCards backend running on http://localhost:${port}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${port} is already in use. Stop the existing backend process, then start this server again.`,
    );
    process.exit(1);
  }

  console.error("Server failed to start:", error);
  process.exit(1);
});
