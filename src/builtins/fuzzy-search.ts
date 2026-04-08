/**
 * Injectable fuzzy search implementation (Bitap/Shift-Or algorithm).
 *
 * Requires `__linesArray` (string[]) in the VM context.
 * Exposes `fuzzy_search(query, limit)` as a global.
 */
export const FUZZY_SEARCH_IMPL = `
function fuzzySearch(lines, query, limit) {
  limit = limit || 10;
  if (!query || query.length === 0) return [];
  limit = Math.min(Math.max(1, Math.floor(limit)), 1000);

  var results = [];
  var queryLower = query.toLowerCase();
  var maxDistance = Math.floor(query.length * 0.4);

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (!line) continue;

    var lineLower = line.toLowerCase();

    if (lineLower.includes(queryLower)) {
      results.push({ line: line, lineNum: i + 1, score: 0 });
      continue;
    }

    var score = fuzzyScore(lineLower, queryLower, maxDistance);
    if (score <= maxDistance) {
      results.push({ line: line, lineNum: i + 1, score: score / query.length });
    }
  }

  results.sort(function(a, b) { return a.score - b.score; });
  return results.slice(0, limit);
}

function fuzzyScore(text, pattern, maxDistance) {
  var patternLen = pattern.length;
  var textLen = text.length;

  if (patternLen === 0) return 0;
  if (textLen === 0) return Infinity;

  var minRequiredLength = patternLen - maxDistance;
  if (textLen < minRequiredLength) return Infinity;

  var bestScore = Infinity;
  var maxStart = Math.max(0, textLen - patternLen + maxDistance);

  for (var start = 0; start <= maxStart; start++) {
    var errors = 0;
    var matched = 0;
    var j = start;

    for (var i = 0; i < patternLen && j < textLen; i++) {
      if (text[j] === pattern[i]) {
        matched++;
        j++;
      } else {
        if (j + 1 < textLen && text[j + 1] === pattern[i]) {
          errors++;
          j += 2;
          matched++;
        } else if (i + 1 < patternLen && text[j] === pattern[i + 1]) {
          errors++;
          i++;
          j++;
          matched++;
        } else {
          errors++;
          j++;
        }
      }

      if (errors > maxDistance) break;
    }

    if (matched >= patternLen - maxDistance) {
      bestScore = Math.min(bestScore, errors);
    }
  }

  return bestScore;
}

var fuzzy_search = function(query, limit) {
  return fuzzySearch(__linesArray, query, limit || 10);
};
`;
