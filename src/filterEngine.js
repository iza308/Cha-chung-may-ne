// Ultra-fast string processing cho text mode
const SKIN_REGEX = /SKIN\s*:\s*(\d+)/gi;
const BANNED_REGEX = /BAND\s*:\s*YES|BANNED/gi;

// Hash function nhanh hơn Set thuần cho dedup lớn
export function fastHash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16);
}

export function processText(inputText, config) {
  const {
    filterMode, keyword, keywordCondition, caseSensitive,
    minSkin, maxSkin, excludeBanned, deduplicate, trimWhitespace
  } = config;
  
  if (!inputText.trim()) {
    return { lines: [], stats: { total: 0, matched: 0, dupes: 0 } };
  }
  
  // Split nhanh bằng regex thay vì loop
  const rawLines = inputText.split(/\r?\n/);
  const totalInput = rawLines.length;
  
  // Pre-allocate arrays — nhanh hơn push động
  const results = [];
  const seen = new Set();
  let dupes = 0;
  
  // Pre-compute lowercase keyword nếu cần
  const kw = caseSensitive ? keyword : keyword.toLowerCase();
  
  for (let i = 0; i < totalInput; i++) {
    let line = rawLines[i];
    if (trimWhitespace) line = line.trim();
    if (!line) continue;
    
    // Dedup check
    if (deduplicate) {
      const hash = fastHash(line);
      if (seen.has(hash)) {
        dupes++;
        continue;
      }
      seen.add(hash);
    }
    
    let isMatch = false;
    
    if (filterMode === 'keyword') {
      const searchLine = caseSensitive ? line : line.toLowerCase();
      const hasKw = searchLine.includes(kw);
      isMatch = keywordCondition === 'contains' ? hasKw : !hasKw;
    }
    else if (filterMode === 'skin_rank') {
      const isBanned = BANNED_REGEX.test(line);
      BANNED_REGEX.lastIndex = 0; // Reset regex state
      
      if (excludeBanned && isBanned) {
        isMatch = false;
      } else {
        SKIN_REGEX.lastIndex = 0;
        const skinMatch = SKIN_REGEX.exec(line);
        const skinCount = skinMatch ? parseInt(skinMatch[1], 10) : 0;
        isMatch = skinCount >= minSkin && skinCount <= maxSkin;
      }
    }
    else {
      isMatch = true;
    }
    
    if (isMatch) {
      results.push(line);
    }
  }
  
  return {
    lines: results,
    stats: {
      total: totalInput,
      matched: results.length,
      dupes
    }
  };
}
