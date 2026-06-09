const fs = require('fs');
const path = require('path');

// Read package.json version
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

// Parse version parts
const parts = version.split('.');
const major = parseInt(parts[0], 10);
const minor = parseInt(parts[1], 10);
const patch = parseInt(parts[2], 10);

// Generate build number using the same formula as Android: major * 10000 + minor * 100 + patch
const buildCode = major * 10000 + minor * 100 + patch;

// Path to Xcode project file
const pbxprojPath = path.join(__dirname, '../ios/App/App.xcodeproj/project.pbxproj');

if (fs.existsSync(pbxprojPath)) {
  let pbxprojContent = fs.readFileSync(pbxprojPath, 'utf8');

  // Replace all instances of MARKETING_VERSION = <value>;
  const marketingVersionRegex = /(MARKETING_VERSION\s*=\s*)[^;]+(;)/g;
  pbxprojContent = pbxprojContent.replace(marketingVersionRegex, `$1${version}$2`);

  // Replace all instances of CURRENT_PROJECT_VERSION = <value>;
  const projectVersionRegex = /(CURRENT_PROJECT_VERSION\s*=\s*)[^;]+(;)/g;
  pbxprojContent = pbxprojContent.replace(projectVersionRegex, `$1${buildCode}$2`);

  fs.writeFileSync(pbxprojPath, pbxprojContent, 'utf8');
  console.log(`Successfully synced iOS version to ${version} (Build ${buildCode})`);
} else {
  console.log('Xcode project not found, skipping iOS version sync.');
}
