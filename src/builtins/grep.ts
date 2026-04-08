/**
 * Injectable grep implementation for VM sandbox.
 *
 * Requires `context` (string) and `__linesArray` (string[]) in the VM context.
 * Returns matches with line numbers, match text, full line, and capture groups.
 */
export const GREP_IMPL = `
var MAX_GREP_RESULTS = 10000;
var MAX_GREP_ITERATIONS = 1000000;
var MAX_CONTEXT_LENGTH = 50000000;

function grep(pattern, flags) {
  if (!pattern || typeof pattern !== "string") return [];
  if (pattern.length > 500) return [];
  if (/(\\((?:[^()]*[+*])[^()]*\\))[+*]/.test(pattern)) return [];
  try { new RegExp(pattern); } catch(e) { return []; }
  if (flags && typeof flags !== "string") flags = "";
  var f = (flags || '').replace(/[^gimsuy]/g, '');
  if (!f.includes('g')) f += 'g';
  if (!f.includes('m')) f += 'm';
  if (!f.includes('i')) f += 'i';
  var regex = new RegExp(pattern, f);
  var results = [];
  var match;
  var iterations = 0;
  var searchContext = context.length > MAX_CONTEXT_LENGTH ? context.slice(0, MAX_CONTEXT_LENGTH) : context;

  while ((match = regex.exec(searchContext)) !== null) {
    if (++iterations >= MAX_GREP_ITERATIONS) break;
    var beforeMatch = searchContext.slice(0, match.index);
    var lineNum = (beforeMatch.match(/\\n/g) || []).length + 1;
    var line = __linesArray[lineNum - 1] || '';

    results.push({
      match: match[0],
      line: line,
      lineNum: lineNum,
      index: match.index,
      groups: match.slice(1)
    });

    if (results.length >= MAX_GREP_RESULTS) break;
    if (match[0].length === 0) regex.lastIndex++;
  }

  return results;
}
`;
