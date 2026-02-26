const https = require('https');
const fs = require('fs');
const path = require('path');

const FONTS = [
  {
    url: 'https://github.com/google/fonts/raw/main/apache/roboto/static/Roboto-Regular.ttf',
    filename: 'Roboto-Regular.ttf'
  },
  {
    url: 'https://github.com/google/fonts/raw/main/apache/roboto/static/Roboto-Medium.ttf',
    filename: 'Roboto-Medium.ttf'
  },
  {
    url: 'https://github.com/google/fonts/raw/main/apache/roboto/static/Roboto-Bold.ttf',
    filename: 'Roboto-Bold.ttf'
  },
  {
    url: 'https://github.com/google/fonts/raw/main/apache/roboto/static/Roboto-Black.ttf',
    filename: 'Roboto-Black.ttf'
  }
];

const fontsDir = path.join(__dirname, '..', 'assets', 'fonts');

// Create fonts directory if it doesn't exist
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

FONTS.forEach(font => {
  const file = fs.createWriteStream(path.join(fontsDir, font.filename));
  https.get(font.url, response => {
    response.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log(`Downloaded ${font.filename}`);
    });
  }).on('error', err => {
    fs.unlink(path.join(fontsDir, font.filename), () => {});
    console.error(`Error downloading ${font.filename}:`, err.message);
  });
}); 