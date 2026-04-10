# SmartCards

SmartCards is a full-stack flashcard app that turns PDF content into interactive study cards using Google Gemini.

## Tech Stack

- Frontend: React + Vite
- Backend: Express + Node.js
- AI: Gemini 1.5 Flash
- PDF parsing: pdf-parse

## Project Structure

- `client/` - React frontend
- `server/` - Express backend

## Setup

1. Install dependencies:

```bash
cd server
npm install

cd ../client
npm install
```

2. Configure environment variables in `server/.env`:

```env
GEMINI_API_KEY=your_key_here
PORT=5000
```

3. Start backend:

```bash
cd server
npm run dev
```

4. Start frontend:

```bash
cd client
npm run dev
```

5. Open `http://localhost:5173`

## API

### `POST /api/generate-flashcards.`

Form data:
- `pdf`: PDF file upload

Response:

```json
{
  "flashcards": [
    {
      "question": "...",
      "answer": "..."
    }
  ]
}
```

## How Study Flow Works

- Click a flashcard to flip between question and answer.
- Mark card as `Got It ✅` to count it as mastered.
- Mark card as `Need Practice 🔁` to push it to the end of the queue.
- When queue ends, SmartCards shows final mastery score.

Live demo: https://flashcard-xi-mauve.vercel.app/
