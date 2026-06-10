const fs = require('fs');
const path = require('path');

const readmePath = path.join(__dirname, '../README.md');
const aboutPath = path.join(__dirname, '../public/about.html');

if (!fs.existsSync(readmePath) || !fs.existsSync(aboutPath)) {
  console.error('Error: README.md or public/about.html not found.');
  process.exit(1);
}

const readmeContent = fs.readFileSync(readmePath, 'utf8');
let aboutContent = fs.readFileSync(aboutPath, 'utf8');

// Helper to extract section content from markdown
function extractSection(content, headerName) {
  const lines = content.split('\n');
  let inSection = false;
  const sectionLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('## ') || line.startsWith('# ')) {
      if (inSection) {
        break; // Reached next header
      }
      if (line.endsWith(headerName)) {
        inSection = true;
        continue;
      }
    }
    if (inSection) {
      sectionLines.push(lines[i]);
    }
  }

  return sectionLines.join('\n').trim();
}

// 1. Extract Promotional Text
const promoText = extractSection(readmeContent, 'Promotional text');
if (!promoText) {
  console.error('Error: Could not extract "Promotional text" from README.md.');
  process.exit(1);
}

// 2. Extract Description & Features
const descriptionRaw = extractSection(readmeContent, 'Description');
if (!descriptionRaw) {
  console.error('Error: Could not extract "Description" from README.md.');
  process.exit(1);
}

// Convert Description Raw to HTML
const descLines = descriptionRaw.split('\n');
let htmlDescription = '';
let inList = false;

for (let i = 0; i < descLines.length; i++) {
  const line = descLines[i].trim();
  if (!line) {
    continue;
  }

  // Check if it's a bullet point
  if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
    if (!inList) {
      htmlDescription += '        <ul>\n';
      inList = true;
    }
    // Remove bullet character and trim
    const cleanLine = line.substring(1).trim();
    const colonIndex = cleanLine.indexOf(':');
    if (colonIndex !== -1) {
      const title = cleanLine.substring(0, colonIndex).trim();
      const desc = cleanLine.substring(colonIndex + 1).trim();
      htmlDescription += `          <li><strong>${title}</strong>: ${desc}</li>\n`;
    } else {
      htmlDescription += `          <li>${cleanLine}</li>\n`;
    }
  } else {
    // If we were in a list, close it
    if (inList) {
      htmlDescription += '        </ul>\n';
      inList = false;
    }

    if (line === 'Features:') {
      htmlDescription += '        <h2>Features</h2>\n';
    } else {
      htmlDescription += `        <p>\n          ${line}\n        </p>\n`;
    }
  }
}

if (inList) {
  htmlDescription += '        </ul>\n';
}

// Replace in about.html
// Replace promo text
const promoStartTag = '<!-- sync-start:promo -->';
const promoEndTag = '<!-- sync-end:promo -->';
const promoRegex = new RegExp(`${promoStartTag}[\\s\\S]*?${promoEndTag}`);
aboutContent = aboutContent.replace(promoRegex, `${promoStartTag}${promoText}${promoEndTag}`);

// Replace description text
const descStartTag = '<!-- sync-start:description -->';
const descEndTag = '<!-- sync-end:description -->';
const descRegex = new RegExp(`${descStartTag}[\\s\\S]*?${descEndTag}`);
aboutContent = aboutContent.replace(descRegex, `${descStartTag}\n${htmlDescription}        ${descEndTag}`);

fs.writeFileSync(aboutPath, aboutContent, 'utf8');
console.log('Successfully synchronized README.md content to public/about.html');
