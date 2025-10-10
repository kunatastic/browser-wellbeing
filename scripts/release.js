#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Configuration
const PACKAGE_JSON = require("../package.json");
const MANIFEST_JSON = require("../manifest.json");
const VERSION = PACKAGE_JSON.version;
const EXTENSION_NAME = "browser-wellbeing";
const RELEASE_DIR = "release";
const ZIP_NAME = `${EXTENSION_NAME}-v${VERSION}.zip`;
const ZIP_PATH = path.join(RELEASE_DIR, ZIP_NAME);

console.log("🚀 Starting release process...");
console.log(`📦 Creating release for version ${VERSION}`);

// Clean previous builds
console.log("🧹 Cleaning previous builds...");
try {
  execSync("pnpm run clean", { stdio: "inherit" });
} catch (error) {
  console.error("❌ Error cleaning:", error.message);
  process.exit(1);
}

// Build the project
console.log("🔨 Building project...");
try {
  // Remove TypeScript build cache to ensure fresh compilation
  if (fs.existsSync("tsconfig.tsbuildinfo")) {
    fs.unlinkSync("tsconfig.tsbuildinfo");
  }

  // Use TypeScript build command for more reliable compilation
  execSync("npx tsc --build --force", { stdio: "inherit" });

  // Verify build completed successfully
  if (!fs.existsSync("dist")) {
    console.error("❌ Build failed - dist directory not created");
    process.exit(1);
  }

  console.log("   ✅ Build completed successfully");
} catch (error) {
  console.error("❌ Error building:", error.message);
  process.exit(1);
}

// Create release directory
console.log("📁 Creating release directory...");
if (fs.existsSync(RELEASE_DIR)) {
  fs.rmSync(RELEASE_DIR, { recursive: true, force: true });
}
fs.mkdirSync(RELEASE_DIR, { recursive: true });

// Copy files to release directory
console.log("📋 Copying files to release directory...");

function copyItem(src, dest) {
  const destPath = path.join(RELEASE_DIR, dest);
  const destDir = path.dirname(destPath);

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  if (fs.statSync(src).isDirectory()) {
    fs.cpSync(src, destPath, { recursive: true });
  } else {
    fs.copyFileSync(src, destPath);
  }
}

// Files to copy
const filesToCopy = [
  { src: "manifest.json", dest: "manifest.json", required: true },
  { src: "dist", dest: "dist", required: true },
  { src: "ui", dest: "ui", required: true },
  { src: "image", dest: "image", required: false },
  { src: "README.md", dest: "README.md", required: false },
  { src: "LICENSE", dest: "LICENSE", required: false },
];

for (const { src, dest, required } of filesToCopy) {
  if (fs.existsSync(src)) {
    copyItem(src, dest);
    console.log(`   ✅ Copied: ${src}`);
  } else if (required) {
    console.error(`❌ Required file/directory not found: ${src}`);
    process.exit(1);
  } else {
    console.log(`   ⚠️  Optional file not found: ${src}`);
  }
}

// Verify required files exist
console.log("🔍 Verifying release...");
const requiredFiles = ["manifest.json", "dist", "ui", "image"];
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(RELEASE_DIR, file))) {
    console.error(`❌ Missing required file: ${file}`);
    process.exit(1);
  }
}
console.log("   ✅ All required files found");

// Create zip file
console.log("📦 Creating zip file...");
try {
  const originalCwd = process.cwd();
  process.chdir(RELEASE_DIR);
  execSync(`zip -r ${ZIP_NAME} . -x "*.DS_Store" "*.log"`, { stdio: "inherit" });
  process.chdir(originalCwd);

  const fileSize = (fs.statSync(ZIP_PATH).size / 1024).toFixed(2);
  console.log(`✅ Release created successfully!`);
  console.log(`📦 Zip file: ${ZIP_PATH} (${fileSize} KB)`);
} catch (error) {
  console.error("❌ Error creating zip file:", error.message);
  console.log("💡 Make sure you have the `zip` command available on your system");
  process.exit(1);
}

// Clean up release directory (keep only zip file)
console.log("🧹 Cleaning up release directory...");
const releaseFiles = fs.readdirSync(RELEASE_DIR);
for (const file of releaseFiles) {
  if (file !== ZIP_NAME) {
    const filePath = path.join(RELEASE_DIR, file);
    if (fs.statSync(filePath).isDirectory()) {
      fs.rmSync(filePath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(filePath);
    }
  }
}
console.log("   ✅ Release directory cleaned up");

// Display release summary
console.log("\n📋 Release Summary:");
console.log(`   Extension: ${MANIFEST_JSON.name} v${VERSION}`);
console.log(`   Zip file: ${ZIP_PATH}`);
console.log(`   Release directory: ${RELEASE_DIR}/`);

console.log("\n🎉 Release completed successfully!");
console.log(`📦 Ready to upload ${ZIP_PATH} to Chrome Web Store`);
