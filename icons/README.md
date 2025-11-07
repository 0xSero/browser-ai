# Extension Icons

This directory should contain the following icon files:
- icon16.png (16x16 pixels)
- icon48.png (48x48 pixels)
- icon128.png (128x128 pixels)

## Creating Icons

You can create simple placeholder icons using any image editor or online tool.

For a quick solution, you can use this SVG as a base and convert it to PNG:

```svg
<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" fill="#4f46e5" rx="20"/>
  <text x="64" y="80" font-size="64" text-anchor="middle" fill="white" font-family="Arial">AI</text>
</svg>
```

### Quick Icon Generation Methods:

1. **Using ImageMagick (if installed):**
   ```bash
   convert -size 128x128 xc:#4f46e5 -fill white -font Arial -pointsize 64 -gravity center -annotate +0+0 'AI' icon128.png
   convert icon128.png -resize 48x48 icon48.png
   convert icon128.png -resize 16x16 icon16.png
   ```

2. **Using Online Tools:**
   - Visit: https://www.favicon-generator.org/
   - Upload any image or create a simple design
   - Download the generated icons

3. **Using Figma/Sketch/Inkscape:**
   - Create a 128x128 artboard
   - Design your icon
   - Export as PNG at 128x, 48x, and 16x sizes

## Temporary Solution

For testing purposes, you can use placeholder icons from https://via.placeholder.com/:
- Download and rename them appropriately
- Or the extension will work without icons (just won't show an icon in the toolbar)
