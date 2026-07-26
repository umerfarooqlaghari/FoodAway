const { Jimp, intToRGBA } = require('jimp');

/**
 * Extracts the background color from a base64 image string.
 * It samples the corners of the image using Jimp to determine the background color.
 * If transparent, it falls back to '#FFFFFF'.
 *
 * @param {string} base64Image - Base64 encoded image string
 * @returns {Promise<string>} Hex color code
 */
async function extractPrimaryColor(base64Image) {
  if (!base64Image) return '#FFFFFF';
  
  try {
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    const image = await Jimp.read(buffer);
    
    // Check top-left corner
    const topLeft = intToRGBA(image.getPixelColor(0, 0));
    
    // If it's transparent, we default to white background for the card
    if (topLeft.a < 10) {
      return '#FFFFFF';
    }
    
    // Convert to hex
    const rgbToHex = (r, g, b) => '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
    
    return rgbToHex(topLeft.r, topLeft.g, topLeft.b);
  } catch (error) {
    console.error('Failed to extract background color from image:', error);
    return '#FFFFFF';
  }
}

module.exports = { extractPrimaryColor };
