import { codeToTokens } from "shiki";

/**
 * Solidity read-only 코드 뷰.
 *
 * CodeFinding.code_location의 file/line으로 바로 이동할 수 있도록 줄마다
 * anchor를 단다. 편집 기능은 넣지 않는다 — 이 화면은 판정 근거를 읽는
 * 곳이지 코드를 고치는 곳이 아니다.
 */
export async function CodeView({
  source,
  startLine,
  file,
  highlight,
}: {
  source: string;
  startLine: number;
  file: string;
  highlight?: { start: number; end: number };
}) {
  const { tokens } = await codeToTokens(source, {
    lang: "solidity",
    theme: "github-light",
  });

  return (
    <figure className="code-view">
      <figcaption className="code-view-file">{file}</figcaption>
      <ol className="code-view-lines" start={startLine}>
        {tokens.map((line, index) => {
          const lineNumber = startLine + index;
          const highlighted =
            highlight !== undefined &&
            lineNumber >= highlight.start &&
            lineNumber <= highlight.end;

          return (
            <li
              key={lineNumber}
              id={`${file}-L${lineNumber}`}
              className="code-view-line"
              data-highlighted={highlighted ? "true" : undefined}
            >
              <span className="code-view-number" aria-hidden="true">
                {lineNumber}
              </span>
              <code>
                {line.map((token, tokenIndex) => (
                  <span key={tokenIndex} style={{ color: token.color }}>
                    {token.content}
                  </span>
                ))}
              </code>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
