# 🏍️ Midnight Rider — Website

Scotland’s roads. Two wheels. No limits.

## Folder Structure

```
midnight-rider/
├── index.html      ← Main page
├── style.css       ← All styling
├── script.js       ← Cursor, scroll effects, animations
├── images/         ← Create this folder and add your photos here
└── README.md       ← This file
```

## Getting Started in VS Code

1. Open the `midnight-rider` folder in VS Code
1. Install the **Live Server** extension (by Ritwick Dey)
1. Right-click `index.html` → **Open with Live Server**
1. Your site opens in the browser and auto-refreshes when you save!

## Adding Your Own Images (Gallery)

1. Create an `images/` folder inside `midnight-rider/`
1. Drop your photos in (e.g. `ride1.jpg`, `highland.jpg`)
1. In `index.html`, find the gallery section and replace:

```html
<!-- BEFORE (placeholder) -->
<div class="gallery-item tall">
  <div class="gallery-placeholder">
    <span>🏔️</span>
    <p>Highland Pass</p>
  </div>
</div>

<!-- AFTER (real image) -->
<div class="gallery-item tall">
  <img src="images/highland.jpg" alt="Highland pass" />
</div>
```

## Updating Your Social Links

In `index.html`, search for `@midnightrider` and replace with your actual usernames.
Also update the `href` links on the social cards.

## Sections

|Section|What it is                    |
|-------|------------------------------|
|Hero   |Big intro with your name      |
|About  |Bio + stats boxes             |
|Content|TikTok, Instagram, ride types |
|Gallery|Your photos (add real images!)|
|Connect|Social links + contact note   |

## Colours (CSS Variables in style.css)

```css
--amber:  #e8a020   ← Main accent colour
--white:  #f0ece4   ← Text
--chrome: #b0b0b0   ← Secondary text
--black:  #080808   ← Background
```

Change `--amber` to any colour to retheme the whole site instantly.
