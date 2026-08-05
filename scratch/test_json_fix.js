function repairAndExtractJSON(text) {
  if (!text) throw new Error('LLM returned an empty response.');
  let str = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const firstBrace = str.indexOf('{');
  const lastBrace = str.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    str = str.slice(firstBrace, lastBrace + 1);
  }

  /* Pass 1: Direct parse */
  try { return JSON.parse(str); } catch {}

  /* Pass 2: Trailing comma cleanup */
  let repaired = str.replace(/,\s*([}\]])/g, '$1');
  try { return JSON.parse(repaired); } catch {}

  /* Pass 3: Unquoted string value repair (e.g. "company": AeroVironm" -> "company": "AeroVironm") */
  let unquotedFixed = repaired.replace(/:\s*(?!(?:true|false|null|-?\d+(?:\.\d+)?)\b)([A-Za-z][^,\{\}\[\]"\r\n]*?)(?=\s*[,}\]\n])/g, ': "$1"');
  unquotedFixed = unquotedFixed.replace(/:\s*([A-Za-z0-9_\-\. ]+)"/g, ': "$1"');
  try { return JSON.parse(unquotedFixed); } catch {}

  /* Pass 4: Fix missing opening quotes on property values (e.g. "key": Value") */
  let missingQuoteFixed = repaired.replace(/:\s*([A-Za-z0-9_\-\.\s]+)"/g, ': "$1"');
  try { return JSON.parse(missingQuoteFixed); } catch {}

  /* Pass 5: Bracket repair */
  let repairedBracket = repaired.replace(/\}\s*\}$/, '}\n  ]\n}');
  try { return JSON.parse(repairedBracket); } catch {}

  /* Pass 6: Full character scanner & stack auto-balancer */
  let out = '';
  let inString = false;
  let isEscaped = false;
  let stack = [];

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (inString) {
      if (char === '\n') { out += '\\n'; continue; }
      if (char === '\r') { out += '\\r'; continue; }
      if (char === '\t') { out += '\\t'; continue; }
      if (char === '\\') { isEscaped = !isEscaped; out += char; }
      else if (char === '"') {
        if (isEscaped) { out += char; isEscaped = false; }
        else {
          const rest = str.slice(i + 1).trimStart();
          const nextChar = rest[0];
          if (!nextChar || [',', '}', ']', ':'].includes(nextChar)) {
            inString = false;
            out += char;
          } else {
            out += '\\"';
          }
        }
      } else { isEscaped = false; out += char; }
    } else {
      if (char === '"') { inString = true; out += char; }
      else if (char === '{' || char === '[') { stack.push(char === '{' ? '}' : ']'); out += char; }
      else if (char === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === ']') stack.pop();
        out += char;
      } else if (char === '}') {
        if (stack.length > 0 && stack[stack.length - 1] === ']') {
          stack.pop();
          out += '\n  ]\n';
        }
        if (stack.length > 0 && stack[stack.length - 1] === '}') {
          stack.pop();
        }
        out += char;
      } else { out += char; }
    }
  }
  if (inString) out += '"';
  out = out.replace(/,\s*$/, '');
  while (stack.length > 0) { out += '\n' + stack.pop(); }
  out = out.replace(/,\s*([}\]])/g, '$1');

  try { return JSON.parse(out); } catch {}

  /* Pass 7: Regex-based object/field extractor fallback */
  console.log('[JSON Repair] Running regex fallback block extraction...');
  const guestMatch = str.match(/"guest"\s*:\s*"([^"]+)"/) || str.match(/"guest"\s*:\s*([A-Za-z0-9_\- ]+)/);
  const hostMatch = str.match(/"host"\s*:\s*"([^"]+)"/) || str.match(/"host"\s*:\s*([A-Za-z0-9_\- ]+)/);
  
  const picks = [];
  const pickRegex = /{\s*"ticker"\s*:\s*"([^"]+)"[\s\S]*?"company"\s*:\s*"?([^",\n\}]+)"?[\s\S]*?"reasoning"\s*:\s*"([^"]+)"/g;
  let match;
  while ((match = pickRegex.exec(str)) !== null) {
    picks.push({
      ticker: match[1].trim(),
      company: match[2].trim().replace(/^"|"$/g, ''),
      reasoning: match[3].trim(),
    });
  }

  if (picks.length > 0) {
    return {
      guest: guestMatch ? guestMatch[1].trim() : 'Market Analyst',
      host: hostMatch ? hostMatch[1].trim() : '',
      picks: picks,
    };
  }

  throw new Error(`JSON malformed`);
}

// Test cases
const test1 = `{\n  "guest": "Kim Bolton",\n  "picks": [\n    {\n      "ticker": "AVAV",\n      "company": AeroVironm",\n      "reasoning": "Solid drone tech"\n    }\n  ]\n}`;
console.log('Test 1 Output:', JSON.stringify(repairAndExtractJSON(test1), null, 2));
