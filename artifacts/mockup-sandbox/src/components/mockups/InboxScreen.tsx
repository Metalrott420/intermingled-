const BG = "hsl(240,25%,4%)";
const CARD = "hsl(240,22%,7%)";
const BORDER = "hsl(240,18%,16%)";
const PRIMARY = "hsl(270,85%,60%)";
const SECONDARY = "hsl(38,95%,54%)";
const FG = "hsl(240,10%,96%)";
const MUTED = "hsl(240,10%,48%)";

const matches = [
  {
    id: "1",
    name: "RILEY",
    initials: "R",
    lastMessage: "Riley: Can't wait to see you! 🔥",
    time: "2m ago",
    unread: true,
  },
  {
    id: "2",
    name: "JORDAN",
    initials: "J",
    lastMessage: "You matched! Say hello.",
    time: "18m ago",
    unread: false,
  },
  {
    id: "3",
    name: "CASEY",
    initials: "C",
    lastMessage: "Casey: That round was intense lol",
    time: "1h ago",
    unread: false,
  },
  {
    id: "4",
    name: "MORGAN",
    initials: "M",
    lastMessage: "You matched! Say hello.",
    time: "3h ago",
    unread: false,
  },
];

export default function InboxScreen() {
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
      {/* Status bar */}
      <div style={{ height: 44, flexShrink: 0 }} />

      {/* Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: `${BG}e8`,
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${BORDER}`,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 16px",
          height: 56,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: `${PRIMARY}15`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
          }}
        >
          ←
        </div>
        <span
          style={{
            fontFamily: "'Barlow Condensed', Impact, system-ui",
            fontWeight: 900,
            fontSize: 20,
            flex: 1,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          MATCHES &amp; MESSAGES
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontFamily: "monospace",
            color: SECONDARY,
            fontWeight: 700,
          }}
        >
          ★ {matches.length} MATCHES
        </div>
      </div>

      {/* Match list */}
      <div style={{ flex: 1 }}>
        {matches.map((match, i) => (
          <div
            key={match.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "16px",
              borderBottom: i < matches.length - 1 ? `1px solid ${BORDER}66` : "none",
              cursor: "pointer",
            }}
          >
            {/* Avatar */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${PRIMARY}35, ${SECONDARY}20)`,
                  border: `1px solid ${BORDER}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: `0 0 15px ${PRIMARY}20`,
                }}
              >
                <span
                  style={{
                    fontFamily: "'Barlow Condensed', Impact, system-ui",
                    fontWeight: 900,
                    fontSize: 24,
                    color: `${PRIMARY}bb`,
                  }}
                >
                  {match.initials}
                </span>
              </div>
              {/* Online dot */}
              <div
                style={{
                  position: "absolute",
                  bottom: -3,
                  right: -3,
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: SECONDARY,
                  border: `2px solid ${BG}`,
                  boxShadow: `0 0 8px ${SECONDARY}`,
                }}
              />
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontFamily: "'Barlow Condensed', Impact, system-ui",
                    fontWeight: 900,
                    fontSize: 17,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: match.unread ? FG : `${FG}cc`,
                  }}
                >
                  {match.name}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "monospace",
                    color: MUTED,
                    flexShrink: 0,
                    marginLeft: 8,
                  }}
                >
                  {match.time}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    color: match.unread ? `${FG}bb` : MUTED,
                    fontFamily: "monospace",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontWeight: match.unread ? 600 : 400,
                  }}
                >
                  {match.lastMessage}
                </span>
                {match.unread && (
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: PRIMARY,
                      flexShrink: 0,
                      boxShadow: `0 0 8px ${PRIMARY}`,
                    }}
                  />
                )}
              </div>
            </div>

            <span style={{ color: MUTED, fontSize: 16, flexShrink: 0 }}>💬</span>
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      <div style={{ padding: "20px 20px 40px" }}>
        <div
          style={{
            background: CARD,
            border: `1px solid ${BORDER}`,
            borderRadius: 16,
            padding: "20px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 28,
              marginBottom: 8,
            }}
          >
            🎯
          </div>
          <div
            style={{
              fontFamily: "'Barlow Condensed', Impact, system-ui",
              fontWeight: 900,
              fontSize: 18,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 8,
            }}
          >
            WANT MORE MATCHES?
          </div>
          <div
            style={{
              fontSize: 13,
              color: MUTED,
              fontFamily: "monospace",
              marginBottom: 16,
              lineHeight: 1.5,
            }}
          >
            Join the pool now and find your next match
          </div>
          <button
            style={{
              width: "100%",
              padding: "14px 0",
              background: `linear-gradient(135deg, ${PRIMARY}, hsl(280,85%,58%))`,
              border: "none",
              borderRadius: 12,
              color: "white",
              fontFamily: "'Barlow Condensed', Impact, system-ui",
              fontWeight: 900,
              fontSize: 15,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              cursor: "pointer",
              boxShadow: `0 0 24px ${PRIMARY}50`,
            }}
          >
            ⚡ FIND A MATCH
          </button>
        </div>
      </div>
    </div>
  );
}
