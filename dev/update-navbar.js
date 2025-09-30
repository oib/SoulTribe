const fs = require('fs');
const path = require('path');

// Configuration
const webRoot = path.join(__dirname, 'web');
const componentsDir = path.join(webRoot, 'components');
const cssDir = path.join(webRoot, 'css');
const jsDir = path.join(webRoot, 'js');

// Ensure required directories exist
[componentsDir, cssDir, jsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// Function to process HTML files
async function processHtmlFiles() {
  try {
    // Find all HTML files in the web directory
    const files = await findHtmlFiles(webRoot);
    
    console.log(`Found ${files.length} HTML files to process`);
    
    for (const file of files) {
      await updateHtmlFile(file);
    }
    
    console.log('\nUpdate complete! All HTML files now use the component-based navigation.');
    console.log('\nNext steps:');
    console.log('1. Review the changes in the updated HTML files');
    console.log('2. Test the navigation on different pages');
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
    (entry.name === 'node_modules' || entry.name === '.git') 
      ? null
      : entry.isDirectory()
        ? files.push(...(await findHtmlFiles(fullPath)))
        : entry.name.endsWith('.html') && files.push(fullPath);
  }
  
  return files;
}

// Update a single HTML file
async function updateHtmlFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Skip files that already use the component-based nav
    if (content.includes('data-component="navbar"')) {
      console.log(`Skipping (already updated): ${filePath}`);
      return;
    }
    
    // Pattern to match the old header/nav structure
    const headerPattern = /<header[\s\S]*?<\/header>/i;
    const navPattern = /<nav[\s\S]*?<\/nav>/i;
    
    // Replace the header/nav with our component
    if (headerPattern.test(content)) {
      content = content.replace(headerPattern, '<!-- Navigation will be loaded here by components.js -->\n  <div data-component="navbar"></div>');
    } else if (navPattern.test(content)) {
      content = content.replace(navPattern, '<!-- Navigation will be loaded here by components.js -->\n  <div data-component="navbar"></div>');
    } else {
      // If no header/nav found, try to insert after the opening body tag
      const bodyPattern = /<body[^>]*>/i;
      if (bodyPattern.test(content)) {
        content = content.replace(
          bodyPattern, 
          match => `${match}\n  <!-- Navigation will be loaded here by components.js -->\n  <div data-component="navbar"></div>`
        );
      }
    }
    
    // Add components.css if not already present
    const cssLink = '<link rel="stylesheet" href="/css/components.css" />';
    if (!content.includes('components.css')) {
      const headPattern = /<head[^>]*>([\s\S]*?)<\/head>/i;
      const headMatch = content.match(headPattern);
      
      if (headMatch) {
        const headContent = headMatch[1];
        if (!headContent.includes('components.css')) {
          content = content.replace(
            headPattern, 
            `<head>$1\n  ${cssLink}</head>`
          );
        }
      }
    }
    
    // Add components.js before the closing body tag if not already present
    const jsScript = '<script src="/js/components.js"></script>';
    if (!content.includes('components.js')) {
      const bodyClosePattern = /<\/body>/i;
      if (bodyClosePattern.test(content)) {
        content = content.replace(
          bodyClosePattern, 
          `  ${jsScript}\n</body>`
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
