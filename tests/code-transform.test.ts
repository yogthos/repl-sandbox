import { describe, it, expect } from "vitest";
import { extractDeclarations, wrapCodeForReturn } from "../src/code-transform.js";

describe("extractDeclarations", () => {
  it("extracts top-level const as var declaration", () => {
    const { declarations, mainCode } = extractDeclarations("const x = 42");
    expect(declarations).toEqual(["var x;"]);
    expect(mainCode).toBe("x = 42");
  });

  it("extracts top-level let as var declaration", () => {
    const { declarations, mainCode } = extractDeclarations("let y = 'hello'");
    expect(declarations).toEqual(["var y;"]);
    expect(mainCode).toBe("y = 'hello'");
  });

  it("converts destructuring to var", () => {
    const { declarations, mainCode } = extractDeclarations(
      "const { a, b } = obj",
    );
    expect(declarations).toEqual(["var { a, b } = obj"]);
    expect(mainCode).toBe("");
  });

  it("converts array destructuring to var", () => {
    const { declarations, mainCode } = extractDeclarations(
      "let [x, y] = arr",
    );
    expect(declarations).toEqual(["var [x, y] = arr"]);
    expect(mainCode).toBe("");
  });

  it("ignores indented declarations (inside blocks)", () => {
    const code = "if (true) {\n    const z = 1\n}";
    const { declarations, mainCode } = extractDeclarations(code);
    expect(declarations).toEqual([]);
    expect(mainCode).toBe(code);
  });

  it("handles multiple declarations", () => {
    const code = "const a = 1\nconst b = 2\nconsole.log(a + b)";
    const { declarations, mainCode } = extractDeclarations(code);
    expect(declarations).toEqual(["var a;", "var b;"]);
    expect(mainCode).toContain("a = 1");
    expect(mainCode).toContain("b = 2");
    expect(mainCode).toContain("console.log(a + b)");
  });
});

describe("wrapCodeForReturn", () => {
  it("wraps last expression for capture", () => {
    const result = wrapCodeForReturn("42");
    expect(result).toContain("__result__ = 42;");
  });

  it("does not wrap statements", () => {
    const stmts = [
      "if (true) {}",
      "for (let i = 0; i < 10; i++) {}",
      "const x = 5",
      "function foo() {}",
      "return 42",
    ];
    for (const stmt of stmts) {
      expect(wrapCodeForReturn(stmt)).toBe(stmt);
    }
  });

  it("wraps last expression in multi-line code", () => {
    const code = "const x = 1\nx + 1";
    const result = wrapCodeForReturn(code);
    expect(result).toContain("__result__ = x + 1;");
  });

  it("does not wrap lines ending with }", () => {
    expect(wrapCodeForReturn("if (x) { y() }")).toBe("if (x) { y() }");
  });

  it("strips trailing semicolon from expression", () => {
    const result = wrapCodeForReturn("x + 1;");
    expect(result).toContain("__result__ = x + 1;");
  });

  it("returns empty/whitespace code as-is", () => {
    expect(wrapCodeForReturn("")).toBe("");
    expect(wrapCodeForReturn("   ")).toBe("   ");
  });

  it("does not wrap comments", () => {
    expect(wrapCodeForReturn("// just a comment")).toBe("// just a comment");
  });
});
