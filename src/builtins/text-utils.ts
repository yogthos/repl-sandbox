/**
 * Injectable text utility functions for VM sandbox.
 *
 * count_tokens: estimate token count for text (defaults to `context`)
 * locate_line: extract lines by 1-based line number
 *
 * Requires `context` (string) and `__linesArray` (string[]) in the VM context.
 */
export const COUNT_TOKENS_IMPL = `
var MAX_TOKEN_WORDS = 100000;

function count_tokens(text) {
  var MAX_TOKEN_INPUT = 1000000;
  var str = text === undefined ? context : text;
  if (!str || str.length === 0) return 0;
  if (str.length > MAX_TOKEN_INPUT) str = str.slice(0, MAX_TOKEN_INPUT);

  var words = str.split(/\\s+/).filter(function(w) { return w.length > 0; });
  if (words.length > MAX_TOKEN_WORDS) words = words.slice(0, MAX_TOKEN_WORDS);
  var tokenCount = 0;

  for (var idx = 0; idx < words.length; idx++) {
    var word = words[idx];
    var punctuation = (word.match(/[^a-zA-Z0-9]/g) || []).length;
    var cleanWord = word.replace(/[^a-zA-Z0-9]/g, '');

    if (cleanWord.length === 0) {
      tokenCount += punctuation;
    } else if (cleanWord.length <= 12) {
      tokenCount += 1 + Math.floor(punctuation / 2);
    } else {
      tokenCount += Math.ceil(cleanWord.length / 6) + Math.floor(punctuation / 2);
    }
  }

  return tokenCount;
}
`;

export const LOCATE_LINE_IMPL = `
function locate_line(start, end) {
  var totalLines = __linesArray.length;
  var startIdx = start <= 0 ? Math.max(0, totalLines + start) : start - 1;
  var endIdx = end === undefined ? startIdx : (end <= 0 ? Math.max(0, totalLines + end) : end - 1);

  if (startIdx < 0 || startIdx >= totalLines) return '';
  if (endIdx < 0) endIdx = 0;
  if (endIdx >= totalLines) endIdx = totalLines - 1;

  if (startIdx > endIdx) {
    var tmp = startIdx;
    startIdx = endIdx;
    endIdx = tmp;
  }

  startIdx = Math.max(0, startIdx);

  return __linesArray.slice(startIdx, endIdx + 1).join('\\n');
}
`;
