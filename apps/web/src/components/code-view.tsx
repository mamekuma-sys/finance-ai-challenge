import { codeToTokens } from "shiki";

/**
 * Solidity read-only 코드 뷰.
 *
 * CodeFinding의 file/line으로 바로 이동할 수 있게 줄마다 anchor를 단다.
 * 편집 기능은 넣지 않는다 — 이 화면은 판정 근거를 읽는 곳이다.
 */
export async function CodeView({
  source,
  file,
  startLine,
  hit,
}: {
  source: string;
  file: string;
  startLine: number;
  hit?: { start: number; end: number };
}) {
  const { tokens } = await codeToTokens(source, { lang: "solidity", theme: "github-light" });
  const name = file.split("/").pop() ?? file;

  return (
    <figure className="code">
      <ol className="code-lines" start={startLine}>
        {tokens.map((line, index) => {
          const no = startLine + index;
          const inRange = hit !== undefined && no >= hit.start && no <= hit.end;

          return (
            <li
              key={no}
              id={`${name}-L${no}`}
              className="code-line"
              data-hit={inRange ? "true" : undefined}
            >
              <span className="code-no" aria-hidden="true">
                {no}
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
