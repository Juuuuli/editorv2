const fs = require('fs');
let b = fs.readFileSync('src/features/system/ManualPanel.js');
let s = b.toString('utf8');
if (s.includes('\0')) {
    s = b.toString('utf16le');
}
s = s.replace(/imgSrc\.startsWith\('src\/'\)/g, "imgSrc.startsWith('./manual/') || imgSrc.startsWith('src/')");
fs.writeFileSync('src/features/system/ManualPanel.js', s, 'utf8');
