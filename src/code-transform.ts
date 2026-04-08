/**
 * Code transformations for REPL-like state persistence and expression capture.
 *
 * extractDeclarations: pulls top-level const/let/var out to context-level `var`
 *   so they persist across sandbox executions (REPL semantics).
 *
 * wrapCodeForReturn: captures the last expression as `__result__` for implicit
 *   return from the async IIFE wrapper.
 */

/**
 * Extract top-level variable declarations for context-level persistence.
 *
 * Converts `const x = ...` / `let x = ...` at indent <=2 to `var x;` at
 * context scope (persists between turns) and keeps the assignment in main code.
 * Destructuring declarations stay in mainCode (converted to `var`) to avoid
 * ordering bugs when the RHS references variables defined in the same execution.
 */
export function extractDeclarations(code: string): {
  declarations: string[];
  mainCode: string;
} {
  const lines = code.split("\n");
  const declarations: string[] = [];
  const mainLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trimStart();
    const indent = line.length - trimmed.length;

    if (
      indent <= 2 &&
      (trimmed.startsWith("const ") ||
        trimmed.startsWith("let ") ||
        trimmed.startsWith("var "))
    ) {
      const match = trimmed.match(
        /^(?:const|let|var)\s+(\w+|\{[^}]+\}|\[[^\]]+\])/,
      );
      if (match) {
        const varName = match[1];
        if (varName.startsWith("{") || varName.startsWith("[")) {
          // Destructuring — keep in mainCode to avoid ordering issues
          // when RHS references variables defined in the same execution.
          // Convert to var so it's IIFE-scoped (won't persist across executions).
          mainLines.push(line.replace(/^(\s*)(?:const|let)/, "$1var"));
        } else {
          // Simple variable — declare at context level, assign in main
          declarations.push(`var ${varName};`);
          mainLines.push(
            line.replace(/^(\s*)(?:const|let|var)\s+/, "$1"),
          );
        }
      } else {
        mainLines.push(line);
      }
    } else {
      mainLines.push(line);
    }
  }

  return { declarations, mainCode: mainLines.join("\n") };
}

/**
 * Wrap code so the last expression is captured as `__result__`.
 *
 * Detects whether the last non-empty line is an expression (not a statement
 * like if/for/function/class/return/etc.) and rewrites it to
 * `__result__ = <expression>;`.
 */
export function wrapCodeForReturn(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) return code;

  const lines = trimmed.split("\n");
  let lastIndex = lines.length - 1;
  while (lastIndex >= 0 && !lines[lastIndex].trim()) {
    lastIndex--;
  }

  if (lastIndex < 0) return code;

  const lastLine = lines[lastIndex].trim();
  const lineWithoutSemi = lastLine.endsWith(";")
    ? lastLine.slice(0, -1)
    : lastLine;

  const isStatement =
    lastLine.startsWith("//") ||
    lastLine.startsWith("/*") ||
    lastLine.startsWith("const ") ||
    lastLine.startsWith("let ") ||
    lastLine.startsWith("var ") ||
    lastLine.startsWith("function ") ||
    lastLine.startsWith("class ") ||
    lastLine.startsWith("if ") ||
    lastLine.startsWith("if(") ||
    lastLine.startsWith("for ") ||
    lastLine.startsWith("for(") ||
    lastLine.startsWith("while ") ||
    lastLine.startsWith("while(") ||
    lastLine.startsWith("switch ") ||
    lastLine.startsWith("switch(") ||
    lastLine.startsWith("try ") ||
    lastLine.startsWith("try{") ||
    lastLine.startsWith("return ") ||
    lastLine.startsWith("throw ") ||
    lastLine === "}" ||
    lastLine.endsWith("{") ||
    lastLine.endsWith("}") ||
    lineWithoutSemi.endsWith("}") ||
    lineWithoutSemi === ")" ||
    /^\s*\}\s*\)/.test(lineWithoutSemi);

  if (isStatement) return code;

  const beforeLast = lines.slice(0, lastIndex).join("\n");
  let expression = lastLine;
  if (expression.endsWith(";")) {
    expression = expression.slice(0, -1);
  }

  return `${beforeLast}\n__result__ = ${expression};`;
}
