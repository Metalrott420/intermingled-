const BG = "hsl(240,25%,4%)";
const CARD = "hsl(240,22%,7%)";
const BORDER = "hsl(240,18%,16%)";
const PRIMARY = "hsl(270,85%,60%)";
const SECONDARY = "hsl(38,95%,54%)";
const FG = "hsl(240,10%,96%)";
const MUTED = "hsl(240,10%,48%)";

export default function PoolScreen() {
  const poolCount = 7;
  const name = "ALEX";

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
        overflow: "hidden",
      }}
    >
      {/* Status bar area */}
      <div style={{ height: 44, flexShrink: 0 }} />

      {/* Ticker bar */}
      <div
        style={{
          background: `${SECONDARY}20`,
          borderBottom: `1px solid ${SECONDARY}30`,
          padding: "8px 0",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: SECONDARY,
            whiteSpace: "nowrap",
          }}
        >
          &nbsp;&nbsp;⭐ INTERMINGLED LIVE&nbsp;&nbsp;·&nbsp;&nbsp;REAL-TIME SPEED DATING&nbsp;&nbsp;·&nbsp;&nbsp;⭐ INTERMINGLED LIVE&nbsp;&nbsp;·&nbsp;&nbsp;REAL-TIME SPEED DATING&nbsp;&nbsp;·&nbsp;&nbsp;
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px 20px" }}>
        {/* Radar animation (static representation) */}
        <div
          style={{
            alignSelf: "center",
            position: "relative",
            width: 96,
            height: 96,
            marginBottom: 20,
          }}
        >
          {[0, 12, 24].map((inset) => (
            <div
              key={inset}
              style={{
                position: "absolute",
                inset,
                borderRadius: "50%",
                border: `2px solid ${PRIMARY}${inset === 0 ? "30" : inset === 12 ? "50" : "80"}`,
              }}
            />
          ))}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: `2px solid ${PRIMARY}`,
              borderTopColor: "transparent",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              color: PRIMARY,
            }}
          >
            ⚡
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            fontFamily: "'Barlow Condensed', Impact, system-ui",
            fontWeight: 900,
            fontSize: 30,
            textAlign: "center",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            color: PRIMARY,
            textShadow: `0 0 20px ${PRIMARY}80`,
            marginBottom: 4,
          }}
        >
          BACKSTAGE
        </div>
        <div
          style={{
            textAlign: "center",
            fontSize: 11,
            fontFamily: "monospace",
            color: MUTED,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: 20,
          }}
        >
          COMPETING AS&nbsp;
          <span style={{ color: SECONDARY, fontWeight: 700 }}>{name}</span>
        </div>

        {/* Pool count card */}
        <div
          style={{
            background: `${PRIMARY}08`,
            border: `1px solid ${PRIMARY}35`,
            borderRadius: 14,
            padding: "20px 16px",
            textAlign: "center",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontFamily: "'Barlow Condensed', Impact, system-ui",
              fontWeight: 900,
              fontSize: 56,
              color: PRIMARY,
              textShadow: `0 0 30px ${PRIMARY}70`,
              lineHeight: 1,
              marginBottom: 4,
            }}
          >
            {poolCount}
          </div>
          <div
            style={{
              fontSize: 11,
              fontFamily: "monospace",
              color: MUTED,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
            }}
          >
            SUITORS WAITING
          </div>
          <div
            style={{
              fontSize: 10,
              fontFamily: "monospace",
              color: `${MUTED}99`,
              marginTop: 2,
            }}
          >
            NEED 5 TO GO LIVE
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              fontFamily: "monospace",
              color: SECONDARY,
              fontWeight: 700,
            }}
          >
            🔥 ENOUGH PLAYERS — MATCH INCOMING...
          </div>
        </div>

        {/* Slot dots */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 10,
            marginBottom: 16,
          }}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: i < 5 ? PRIMARY : BORDER,
                boxShadow: i < 5 ? `0 0 10px ${PRIMARY}` : "none",
              }}
            />
          ))}
        </div>

        {/* Status dot */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: SECONDARY,
              boxShadow: `0 0 8px ${SECONDARY}`,
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontFamily: "monospace",
              color: MUTED,
              letterSpacing: "0.08em",
            }}
          >
            LIVE — WAITING FOR CHOOSER
          </span>
        </div>

        {/* Tips card */}
        <div
          style={{
            background: `${CARD}`,
            border: `1px solid ${BORDER}`,
            borderRadius: 14,
            padding: "14px 16px",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontFamily: "monospace",
              color: PRIMARY,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            WHILE YOU WAIT
          </div>
          {[
            "Your personality is being matched with a chooser",
            "You'll be redirected the instant you match",
            "Browse other suitors below to kill time",
          ].map((tip, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                marginBottom: i < 2 ? 8 : 0,
              }}
            >
              <span style={{ color: PRIMARY, marginTop: 1 }}>▸</span>
              <span style={{ fontSize: 13, color: MUTED, lineHeight: 1.4 }}>{tip}</span>
            </div>
          ))}
        </div>

        {/* Browse section header */}
        <div style={{ marginBottom: 12, textAlign: "center" }}>
          <div
            style={{
              fontFamily: "'Barlow Condensed', Impact, system-ui",
              fontWeight: 900,
              fontSize: 18,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: `${FG}cc`,
            }}
          >
            WHO'S IN THE ARENA
          </div>
          <div style={{ fontSize: 11, fontFamily: "monospace", color: MUTED, marginTop: 2 }}>
            8 suitors competing today
          </div>
        </div>

        {/* Profile card preview */}
        <div
          style={{
            background: CARD,
            border: `1px solid ${BORDER}`,
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          {/* Photo placeholder */}
          <div
            style={{
              height: 200,
              background: `linear-gradient(135deg, ${PRIMARY}30, ${SECONDARY}15)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <span
              style={{
                fontFamily: "'Barlow Condensed', Impact, system-ui",
                fontWeight: 900,
                fontSize: 72,
                color: `${PRIMARY}50`,
              }}
            >
              J
            </span>
            {/* Overlay */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: "60%",
                background: `linear-gradient(transparent, ${BG}e8)`,
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 12,
                left: 16,
                right: 16,
              }}
            >
              <div
                style={{
                  fontFamily: "'Barlow Condensed', Impact, system-ui",
                  fontWeight: 900,
                  fontSize: 22,
                  textTransform: "uppercase",
                  color: "white",
                  textShadow: "0 2px 8px rgba(0,0,0,0.6)",
                }}
              >
                JAMIE
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
                Love hiking, coffee, and deep talks ☕
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                background: "rgba(0,0,0,0.5)",
                borderRadius: 999,
                padding: "3px 10px",
                fontSize: 10,
                fontFamily: "monospace",
                color: "rgba(255,255,255,0.75)",
              }}
            >
              1/8
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ padding: "14px", display: "flex", gap: 12 }}>
            <button
              style={{
                flex: 1,
                padding: "12px 0",
                border: `1px solid ${BORDER}`,
                background: "transparent",
                borderRadius: 12,
                color: MUTED,
                fontFamily: "'Barlow Condensed', Impact, system-ui",
                fontWeight: 700,
                fontSize: 14,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              ✕ PASS
            </button>
            <button
              style={{
                flex: 1,
                padding: "12px 0",
                border: "none",
                background: SECONDARY,
                borderRadius: 12,
                color: "hsl(240,25%,6%)",
                fontFamily: "'Barlow Condensed', Impact, system-ui",
                fontWeight: 700,
                fontSize: 14,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                cursor: "pointer",
                boxShadow: `0 0 20px ${SECONDARY}50`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              ★ LIKE
            </button>
          </div>
        </div>
      </div>

      {/* Bottom safe area */}
      <div style={{ height: 34 }} />
    </div>
  );
}
