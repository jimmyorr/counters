const fs = require('fs');

let content = fs.readFileSync('app.js', 'utf8');

// Replace playClickSound() near dialog.close()
content = content.replace(/dialog\.close\([^)]*\);\s*playClickSound\([^)]*\);/g, 'dialog.close();');
content = content.replace(/playClickSound\([^)]*\);\s*dialog\.close\([^)]*\);/g, 'dialog.close();');

fs.writeFileSync('app.js', content, 'utf8');
console.log('Removed navigational audio for dialog close.');
