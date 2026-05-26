const fs = require('fs');
const path = 'com-mobile/index.js';
let s = fs.readFileSync(path, 'utf8');

function replaceHeroBlock(code) {
  const target = '<View style={styles.hero}>';
  const start = code.indexOf(target);
  if (start < 0) return code;
  let i = start;
  let depth = 0;
  let end = -1;
  while (i < code.length) {
    const nextOpen = code.indexOf('<View', i);
    const nextClose = code.indexOf('</View>', i);
    if (nextClose < 0) break;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 5;
    } else {
      depth -= 1;
      i = nextClose + 7;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end < 0) throw new Error('Could not find hero block end');
  const bar = `<View style={styles.topTitleBar}>\n        <Text style={styles.topTitleText}>{pageTitle}</Text>\n      </View>`;
  return code.slice(0, start) + bar + code.slice(end);
}

function removeExtraBars(code) {
  return code.replace(/\n\s*<View style=\{styles\.(?:fixedWhiteTitleBar|cleanTopTitleBar)\}>[\s\S]*?<\/View>\s*/g, '\n');
}

function removeFinalOverride(code) {
  return code.replace(/\n\s*\/\/ ===== FINAL TOP BAR OVERRIDE =====[\s\S]*?(?=\n\s*\}\);)/m, '\n');
}

function replaceStyleObject(code, name, body) {
  const re = new RegExp(`\\n\\s*${name}:\\s*\\{[\\s\\S]*?\\n\\s*\\},`, 'm');
  if (re.test(code)) return code.replace(re, '\n' + body);
  const marker = 'const styles = StyleSheet.create({';
  const idx = code.indexOf(marker);
  if (idx < 0) throw new Error('StyleSheet not found');
  return code.slice(0, idx + marker.length) + '\n' + body + code.slice(idx + marker.length);
}

s = removeExtraBars(s);
s = replaceHeroBlock(s);
s = removeFinalOverride(s);

s = replaceStyleObject(s, 'topTitleBar', `  topTitleBar: {
    height: 56,
    backgroundColor: '#ffffff',
    borderWidth: 0,
    borderRadius: 0,
    marginTop: 0,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },`);

s = replaceStyleObject(s, 'topTitleText', `  topTitleText: {
    color: '#150b2e',
    fontSize: 23,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 32,
  },`);

fs.writeFileSync(path, s);
console.log('Fixed COM mobile title bar');
// trigger repair workflow 2026-05-26
