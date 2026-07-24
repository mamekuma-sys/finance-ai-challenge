interface ProhibitionBlockProps {
  items: readonly string[];
}

export function ProhibitionBlock({ items }: ProhibitionBlockProps) {
  return (
    <aside className="prohibition-block" aria-labelledby="prohibition-title">
      <p className="danger-label">
        <span aria-hidden="true">!</span> 금지 행동
      </p>
      <h2 id="prohibition-title">하지 마세요</h2>
      <ul>
        {items.map((item) => (
          <li key={item}>
            <span className="prohibition-icon" aria-hidden="true">
              ×
            </span>
            <span>
              <strong>금지</strong> {item}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
