const fs = require('fs-extra');
const path = require('path');

async function copyStatic() {
  // The standalone build creates a nested structure
  const standalonePath = path.join(__dirname, '.next/standalone/frontend');
  const staticPath = path.join(__dirname, '.next/static');
  const publicPath = path.join(__dirname, 'public');

  console.log('Copying static files...');
  console.log('Standalone path:', standalonePath);

  // Copy .next/static to standalone/frontend/.next/static
  if (fs.existsSync(staticPath)) {
    await fs.copy(
      staticPath,
      path.join(standalonePath, '.next/static')
    );
    console.log('✓ Copied .next/static');
  } else {
    console.log('⚠ .next/static not found');
  }

  // Copy public to standalone/frontend/public
  if (fs.existsSync(publicPath)) {
    await fs.copy(
      publicPath,
      path.join(standalonePath, 'public')
    );
    console.log('✓ Copied public folder');
  } else {
    console.log('⚠ public folder not found');
  }
}

copyStatic().catch(console.error);