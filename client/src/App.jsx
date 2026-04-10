import { useMemo, useState } from "react";

const API_BASE = "http://localhost:5000";

function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [flashcards, setFlashcards] = useState([]);
  const [queue, setQueue] = useState([]);
  const [currentPos, setCurrentPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [masteredCount, setMasteredCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [started, setStarted] = useState(false);

  const initialCount = useMemo(() => flashcards.length, [flashcards.length]);
  const currentCardId = queue[currentPos];
  const currentCard =
    currentCardId !== undefined ? flashcards[currentCardId] : undefined;

  const isFinished = started && currentCardId === undefined;

  const onFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setPdfFile(file);
    setError("");
  };

  const resetStudy = () => {
    setFlashcards([]);
    setQueue([]);
    setCurrentPos(0);
    setFlipped(false);
    setMasteredCount(0);
    setStarted(false);
    setError("");
  };

  const generateFlashcards = async (event) => {
    event.preventDefault();

    if (!pdfFile) {
      setError("Please choose a PDF first.");
      return;
    }

    const formData = new FormData();
    formData.append("pdf", pdfFile);

    try {
      setLoading(true);
      setError("");
      setStarted(false);

      const response = await fetch(`${API_BASE}/api/generate-flashcards`, {
        method: "POST",
        body: formData
      });

      let data = {};
      const raw = await response.text();
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { error: raw || "Unable to generate flashcards." };
      }

      if (!response.ok) {
        const message = data.details
          ? `${data.error || "Unable to generate flashcards."} (${data.details})`
          : data.error || "Unable to generate flashcards.";
        throw new Error(message);
      }

      const cards = data.flashcards || [];
      const initialQueue = cards.map((_, index) => index);

      setFlashcards(cards);
      setQueue(initialQueue);
      setCurrentPos(0);
      setFlipped(false);
      setMasteredCount(0);
      setStarted(true);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleGotIt = () => {
    setMasteredCount((prev) => prev + 1);
    setCurrentPos((prev) => prev + 1);
    setFlipped(false);
  };

  const handleNeedPractice = () => {
    if (currentCardId === undefined) {
      return;
    }

    setQueue((prevQueue) => [...prevQueue, currentCardId]);
    setCurrentPos((prev) => prev + 1);
    setFlipped(false);
  };

  return (
    <div className="app-shell">
      <div className="bg-orb orb-a" />
      <div className="bg-orb orb-b" />
      <div className="grid-overlay" />

      <main className="content-wrap">
        <header className="hero">
          <h1>SmartCards</h1>
          <p>
            Upload a PDF, let Gemini craft your study deck, and master every
            concept with a smart repeat loop.
          </p>
        </header>

        <section className="panel upload-panel">
          <form onSubmit={generateFlashcards} className="upload-form">
            <label htmlFor="pdf-upload" className="file-picker">
              <span>Select PDF</span>
              <input
                id="pdf-upload"
                type="file"
                accept="application/pdf"
                onChange={onFileChange}
              />
            </label>

            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? "Generating..." : "Generate Flashcards"}
            </button>

            {pdfFile && <p className="hint">Ready: {pdfFile.name}</p>}
            {error && <p className="error-text">{error}</p>}
          </form>
        </section>

        {loading && (
          <section className="panel loading-panel">
            <div className="spinner" />
            <p>Reading PDF and generating cards with Gemini...</p>
          </section>
        )}

        {!loading && started && currentCard && (
          <section className="panel study-panel">
            <div className="progress-row">
              <p>
                Card {currentPos + 1} of {queue.length}
              </p>
              <p>Mastered: {masteredCount}</p>
            </div>

            <button
              type="button"
              className={`flip-card ${flipped ? "is-flipped" : ""}`}
              onClick={() => setFlipped((prev) => !prev)}
            >
              <span className="card-face card-front">
                <strong>Question</strong>
                <p>{currentCard.question}</p>
                <small>Click to flip</small>
              </span>
              <span className="card-face card-back">
                <strong>Answer</strong>
                <p>{currentCard.answer}</p>
                <small>Click to flip back</small>
              </span>
            </button>

            <div className="actions-row">
              <button type="button" className="good-btn" onClick={handleGotIt}>
                Got It \u2705
              </button>
              <button
                type="button"
                className="retry-btn"
                onClick={handleNeedPractice}
              >
                Need Practice \ud83d\udd01
              </button>
            </div>
          </section>
        )}

        {!loading && isFinished && (
          <section className="panel result-panel">
            <h2>You mastered {masteredCount}/{initialCount} cards! \ud83c\udf89</h2>
            <p>Great work. Keep practicing daily to lock in long-term memory.</p>
            <button type="button" className="primary-btn" onClick={resetStudy}>
              Study Another PDF
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
