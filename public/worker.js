// Ultra-Fast Filter Worker — chạy nền, không block UI
self.onmessage = async function(e) {
  const { file, config } = e.data;
  const { filterMode, keyword, keywordCondition, caseSensitive, minSkin, maxSkin, excludeBanned, deduplicate, trimWhitespace } = config;
  
  const CHUNK_SIZE = 32 * 1024 * 1024; // 32MB chunks — nhanh hơn 16MB
  const decoder = new TextDecoder('utf-8');
  
  let offset = 0;
  let leftover = '';
  let totalChecked = 0;
  let totalMatched = 0;
  let totalDupes = 0;
  
  // Set dedup tối ưu — dùng hash thay vì string nguyên
  const seenHashes = new Set();
  const hashString = (str) => {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16);
  };
  
  // Pre-compile regex — nhanh hơn match mỗi lần
  const skinRegex = /SKIN\s*:\s*(\d+)/i;
  const bannedRegex = /BAND\s*:\s*YES|BANNED/i;
  const kw = caseSensitive ? keyword : keyword.toLowerCase();
  
  const startTime = performance.now();
  
  while (offset < file.size) {
    const slice = file.slice(offset, offset + CHUNK_SIZE);
    const buffer = await slice.arrayBuffer();
    const text = decoder.decode(buffer, { stream: true });
    const currentText = leftover + text;
    const lines = currentText.split('\n');
    
    if (offset + CHUNK_SIZE < file.size) {
      leftover = lines.pop() || '';
    } else {
      leftover = '';
    }
    
    const matchedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (trimWhitespace) line = line.trim();
      if (!line) continue;
      
      totalChecked++;
      
      // Deduplicate bằng hash — nhanh hơn so sánh string
      if (deduplicate) {
        const hash = hashString(line);
        if (seenHashes.has(hash)) {
          totalDupes++;
          continue;
        }
        if (seenHashes.size < 3000000) seenHashes.add(hash); // Tăng limit lên 3M
      }
      
      let isMatch = false;
      
      if (filterMode === 'keyword') {
        const searchLine = caseSensitive ? line : line.toLowerCase();
        const hasKw = searchLine.includes(kw);
        isMatch = keywordCondition === 'contains' ? hasKw : !hasKw;
      } 
      else if (filterMode === 'skin_rank') {
        const isBanned = bannedRegex.test(line);
        if (excludeBanned && isBanned) {
          isMatch = false;
        } else {
          const skinMatch = line.match(skinRegex);
          const skinCount = skinMatch ? parseInt(skinMatch[1], 10) : 0;
          isMatch = skinCount >= minSkin && skinCount <= maxSkin;
        }
      } 
      else {
        isMatch = true;
      }
      
      if (isMatch) {
        matchedLines.push(line);
        totalMatched++;
      }
    }
    
    // Gửi chunk kết quả về main thread
    if (matchedLines.length > 0) {
      self.postMessage({
        type: 'chunk',
        data: matchedLines.join('\n') + '\n',
        stats: { checked: totalChecked, matched: totalMatched, dupes: totalDupes }
      });
    }
    
    offset += CHUNK_SIZE;
    const progress = Math.min(100, Math.round((offset / file.size) * 100));
    const elapsed = (performance.now() - startTime) / 1000;
    const speed = (offset / (1024 * 1024)) / (elapsed || 0.1);
    
    self.postMessage({
      type: 'progress',
      progress,
      speed: parseFloat(speed.toFixed(1)),
      elapsed: parseFloat(elapsed.toFixed(1)),
      stats: { checked: totalChecked, matched: totalMatched, dupes: totalDupes }
    });
    
    // Yield nhẹ để worker không bị kill
    await new Promise(r => setTimeout(r, 0));
  }
  
  // Xử lý leftover cuối
  if (leftover) {
    let line = trimWhitespace ? leftover.trim() : leftover;
    if (line) {
      totalChecked++;
      let isMatch = false;
      
      if (filterMode === 'keyword') {
        const searchLine = caseSensitive ? line : line.toLowerCase();
        const hasKw = searchLine.includes(kw);
        isMatch = keywordCondition === 'contains' ? hasKw : !hasKw;
      } else if (filterMode === 'skin_rank') {
        const isBanned = bannedRegex.test(line);
        if (!(excludeBanned && isBanned)) {
          const skinMatch = line.match(skinRegex);
          const skinCount = skinMatch ? parseInt(skinMatch[1], 10) : 0;
          isMatch = skinCount >= minSkin && skinCount <= maxSkin;
        }
      } else {
        isMatch = true;
      }
      
      if (isMatch) {
        self.postMessage({
          type: 'chunk',
          data: line + '\n',
          stats: { checked: totalChecked, matched: totalMatched + 1, dupes: totalDupes }
        });
        totalMatched++;
      }
    }
  }
  
  self.postMessage({
    type: 'complete',
    stats: { checked: totalChecked, matched: totalMatched, dupes: totalDupes }
  });
};
