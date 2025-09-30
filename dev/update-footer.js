const fs = require('fs');
const path = require('path');

// Configuration
const webRoot = path.join(__dirname, 'web');
const componentsDir = path.join(webRoot, 'components');

// Ensure components directory exists
if (!fs.existsSync(componentsDir)) {
  fs.mkdirSync(componentsDir, { recursive: true });
  console.log(`Created directory: ${componentsDir}`);
}

// Function to process HTML files
async function processHtmlFiles() {
  try {
    // Find all HTML files in the web directory
    const files = await findHtmlFiles(webRoot);
    
    console.log(`Found ${files.length} HTML files to process`);
    
    for (const file of files) {
      await updateHtmlFile(file);
    }
    
    console.log('\nUpdate complete! All HTML files now use the component-based footer.');
    console.log('\nNext steps:');
    console.log('1. Review the changes in the updated HTML files');
    console.log('2. Test the footer on different pages');
    console.log('3. Commit the changes to version control');
    
  } catch (error) {
    console.error('Error processing HTML files:', error);
    process.exit(1);
  }
}

// Recursively find all HTML files in a directory
async function findHtmlFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    // Skip node_modules and .git directories
    if (entry.name === 'node_modules' || entry.name === '.git') {
      continue;
    }
    
    if (entry.isDirectory()) {
      files.push(...(await findHtmlFiles(fullPath)));
    } else if (entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Update a single HTML file
async function updateHtmlFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Skip files that already use the component-based footer
    if (content.includes('data-component="footer"')) {
      console.log(`Skipping (already updated): ${filePath}`);
      return;
    }
    
    // Pattern to match the old footer structure
    const footerPattern = /<footer[\s\S]*?<\/footer>/i;
    
    // Replace the footer with our component
    if (footerPattern.test(content)) {
      content = content.replace(footerPattern, '<!-- Footer will be loaded here by components.js -->\n  <div data-component="footer"></div>');
    } else {
      // If no footer found, try to insert before the closing body tag
      const bodyClosePattern = /<\/body>/i;
      if (bodyClosePattern.test(content)) {
        content = content.replace(
          bodyClosePattern, 
          `  <!-- Footer will be loaded here by components.js -->\n  <div data-component="footer"></div>\n</body>`
        );
      }
    }
    
    // Only write if content has changed
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated: ${filePath}`);
    } else {
      console.log(`No changes needed: ${filePath}`);
    }
    
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

// Run the script
processHtmlFiles();
