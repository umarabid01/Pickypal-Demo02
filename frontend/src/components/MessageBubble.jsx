/**
 * Very small markdown-lite renderer for agent replies, which use
 * **bold**, line breaks, and "- " bullet lines. Deliberately minimal —
 * no external markdown dependency needed for this scope.
 */
function renderContent(text) {
  const lines = text.split("\n");
  const nodes = [];
  let listBuffer = [];

  const flushList = (key) => {
    if (listBuffer.length) {
      nodes.push(
        <ul className="msg-list" key={`list-${key}`}>
          {listBuffer.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      listBuffer = [];
    }
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      listBuffer.push(trimmed.slice(2));
    } else {
      flushList(i);
      if (trimmed.length === 0) {
        nodes.push(<div className="msg-line-gap" key={`gap-${i}`} />);
      } else {
        nodes.push(<div key={`line-${i}`}>{renderInline(line)}</div>);
      }
    }
  });
  flushList("end");

  return nodes;
}

function renderInline(line) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

export default function MessageBubble({ role, content, timestamp }) {
  const time = new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`msg-row ${role}`}>
      <div className={`msg-bubble ${role}`}>
        <div className="msg-content">{renderContent(content)}</div>
        <span className="msg-time">{time}</span>
      </div>
    </div>
  );
}
