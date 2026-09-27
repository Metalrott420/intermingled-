const BG = "hsl(240,25%,4%)";
const CARD = "hsl(240,22%,7%)";
const BORDER = "hsl(240,18%,16%)";
const PRIMARY = "hsl(270,85%,60%)";
const SECONDARY = "hsl(38,95%,54%)";
const FG = "hsl(240,10%,96%)";
const MUTED = "hsl(240,10%,48%)";

const question = {
  q: "How do you prefer to communicate?",
  index: 2,
  total: 7,
  options: [
    "Deep, thoughtful conversations",
    "Quick, playful banter",
    "Actions over words",
    "Short and sweet",
  ],
};

export default function QuizScreen() {
  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        background: BG,
        color: FG,
        fontFamily: "'Barlow', 'Inter', system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Status bar area */}
      <div style={{ height: 44, flexShrink: 0 }} />

      {/* Header */}
      <div
        style={{
          padding: "0 24px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontFamily: "'Barlow Condensed', Impact, system-ui",
            fontWeight: 900,
            fontSize: 22,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            background: `linear-gradient(135deg, ${PRIMARY}, ${SECONDARY})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          INTERMINGLED
        </span>
        <div
          style={{
            fontSize: 12,
            fontFamily: "monospace",
            color: MUTED,
            letterSpacing: "0.1em",
          }}
        >
          STEP {question.index} OF {question.total}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ padding: "0 24px", marginBottom: 32 }}>
        <div
          style={{
            height: 4,
            background: BORDER,
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${(question.index / question.total) * 100}%`,
              background: `linear-gradient(90deg, ${PRIMARY}, ${SECONDARY})`,
              borderRadius: 999,
            }}
          />
        </div>
      </div>

      {/* Card content */}
      <div style={{ flex: 1, padding: "0 20px", display: "flex", flexDirection: "column" }}>
        {/* Personality badge */}
        <div
          style={{
            alignSelf: "center",
            marginBottom: 28,
            background: `${PRIMARY}22`,
            border: `1px solid ${PRIMARY}44`,
            borderRadius: 999,
            padding: "6px 18px",
            fontSize: 11,
            fontFamily: "monospace",
            color: PRIMARY,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          ✦ PERSONALITY QUIZ
        </div>

        {/* Question */}
        <div
          style={{
            fontFamily: "'Barlow Condensed', Impact, system-ui",
            fontWeight: 900,
            fontSize: 32,
            lineHeight: 1.15,
            textAlign: "center",
            marginBottom: 36,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: FG,
          }}
        >
          {question.q}
        </div>

        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {question.options.map((opt, i) => {
            const selected = i === 0;
            return (
              <div
                key={i}
                style={{
                  padding: "18px 20px",
                  border: `2px solid ${selected ? PRIMARY : BORDER}`,
                  borderRadius: 14,
                  background: selected ? `${PRIMARY}18` : CARD,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    border: `2px solid ${selected ? PRIMARY : BORDER}`,
                    background: selected ? PRIMARY : "transparent",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {selected && (
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: "white",
                      }}
                    />
                  )}
                </div>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: selected ? 600 : 400,
                    color: selected ? FG : MUTED,
                    lineHeight: 1.35,
                  }}
                >
                  {opt}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        {/* Next button */}
        <div style={{ padding: "32px 0 48px" }}>
          <button
            style={{
              width: "100%",
              padding: "18px 0",
              background: `linear-gradient(135deg, ${PRIMARY}, hsl(280,85%,58%))`,
              border: "none",
              borderRadius: 14,
              color: "white",
              fontSize: 16,
              fontWeight: 700,
              fontFamily: "'Barlow Condensed', Impact, system-ui",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              cursor: "pointer",
              boxShadow: `0 0 30px ${PRIMARY}60`,
            }}
          >
            NEXT →
          </button>
        </div>
      </div>
    </div>
  );
}
