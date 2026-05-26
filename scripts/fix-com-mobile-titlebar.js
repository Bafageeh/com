const fs = require('fs');
const path = 'com-mobile/index.js';
let s = fs.readFileSync(path, 'utf8');

function replaceHeroBlock(code) {
  const lines = code.split('\n');
  const start = lines.findIndex((line) => line.includes('<View style={styles.hero}>'));
  if (start < 0) {
    console.log('No hero block found; skipping JSX replacement');
    return code;
  }

  const end = lines.findIndex((line, index) => index > start && line.includes('{loading ? ('));
  if (end < 0) {
    throw new Error('Could not find loading block after hero');
  }

  const indent = lines[start].match(/^\s*/)[0];
  const replacement = [
    `${indent}<View style={styles.topTitleBar}>`,
    `${indent}  <Text style={styles.topTitleText}>{pageTitle}</Text>`,
    `${indent}</View>`,
    '',
  ];

  lines.splice(start, end - start, ...replacement);
  return lines.join('\n');
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

s = replaceStyleObject(s, 'screen', `  screen: {
    flex: 1,
    backgroundColor: '#12091f',
    paddingTop: 28,
  },`);

s = replaceStyleObject(s, 'topTitleBar', `  topTitleBar: {
    height: 56,
    backgroundColor: 'rgba(255,255,255,0.90)',
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
console.log('Fixed COM mobile title bar: raised 20px and 10% transparent');
