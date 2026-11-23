# 🔮 SpellVault

A personal, offline-only password manager and digital safe for **one user**.
All data is stored exclusively on your device in **IndexedDB**. Zero cloud, zero telemetry, zero network tracking.

---

## 🎨 Design System & Visual Elements

| Design Element | Where & How It Is Used |
|---|---|
| **Holographic Glass Shield** | Welcome screen primary visual (`.shield-3d-visual`) with internal glowing arcs |
| **Iridescent Glass Orb** | Background 3D element with physical metallic/glass transmission |
| **Holographic Orbit Rings** | Multi-layered concentric rings orbiting the central 3D core in real-time |
| **Glassmorphic Vault Cube** | Empty state 3D illustration with 6 rotating translucent glass faces |
| **Liquid Chrome Ribbons** | Ambient flowing Catmull-Rom splines in the background |
| **Bento Grid Layout** | Card-based grouping for accounts and app credentials |
| **Glassmorphism 2.0** | Elevated dark surfaces with backdrop blur (`blur(20px)`) and violet border glows |
| **Neumorphic Micro-interactions** | Tactile button press feedback on copy, reveal, delete, and save |
| **Minimalist Dark UI** | Deep `#080B14` void with `#111625` surface layers |
| **Command Palette UX** | Quick keyboard navigation (`⌘K` or `Ctrl+K`) to focus search instantly |
| **Floating Action Button (FAB)** | Convenient `+` button positioned for one-thumb action on mobile screens |
| **Progressive Disclosure** | Collapsible advanced security settings under `Settings` |
| **Shimmer Skeleton Loading UI** | Smooth loading placeholders |
| **3D Tilt Hover** | Subtle interactive perspective card tilting on desktop mouse movement |
| **Spring Physics Animation** | Natural pop modals and fluid screen transitions |
| **Parallax Depth** | 3D background elements react to mouse and touch movement |
| **Ambient Lighting** | Soft violet background glow filter |

---

## 🐙 Step-by-Step: How to Put This on GitHub

### 1. Open Terminal or PowerShell
In your terminal, navigate to the SpellVault directory:
```bash
cd c:\Users\PUSHKAR\Downloads\SpellVault
```

### 2. Initialize Git Repository
```bash
git init
git add .
git commit -m "Initial commit of SpellVault with 3D elements and PWA"
```

### 3. Create a New Repository on GitHub
1. Open your browser and go to **[github.com/new](https://github.com/new)**.
2. Under **Repository name**, enter: `spellvault`.
3. Choose **Private** (recommended for personal password vaults) or **Public**.
4. **Do NOT** check "Add a README file" (we already have this complete README).
5. Click **Create repository**.

### 4. Push Your Code to GitHub
Copy and paste the commands shown by GitHub into your terminal:
```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/spellvault.git
git push -u origin main
```

---

## 📱 How to Download & Install It on Your Phone

You can install SpellVault directly on your iPhone or Android as a native standalone app with its custom logo:

### Option A: Using GitHub Pages (Easiest for Phone)
1. In your GitHub repository, click **Settings** &rarr; **Pages** (on the left menu).
2. Under **Build and deployment** &rarr; **Branch**, select `main` and `/ (root)`, then click **Save**.
3. Wait 1 minute. GitHub will give you a live URL:
   `https://YOUR_USERNAME.github.io/spellvault/`
4. Open that URL on your phone's browser:
   - **On iPhone (Safari)**: Tap the **Share** button (box with an arrow) &rarr; scroll down and tap **"Add to Home Screen"** &rarr; tap **Add**.
   - **On Android (Chrome)**: Tap the **three-dot menu** &rarr; tap **"Install App"** or **"Add to Home screen"**.
5. The **SpellVault safe logo** (`logo.svg`) will appear right on your home screen and open full-screen like a real native app!

### Option B: Local Network (Without GitHub Pages)
1. On your PC, run:
   ```bash
   python vault-serve.py
   ```
2. Find your PC's local IP address (run `ipconfig` in Command Prompt, e.g. `192.168.1.15`).
3. Connect your phone to the same Wi-Fi network and open `http://192.168.1.15:5173`.
4. Tap **Add to Home Screen**.

---

## 🎨 How Its Logo Works & How to Change It

- **Location**: `c:\Users\PUSHKAR\Downloads\SpellVault\logo.svg`
- The app icon is configured in:
  1. `index.html`:
     ```html
     <link rel="icon" type="image/svg+xml" href="logo.svg">
     <link rel="apple-touch-icon" href="logo.svg">
     ```
  2. `manifest.json`:
     ```json
     "icons": [
       {
         "src": "./logo.svg",
         "sizes": "192x192 512x512",
         "type": "image/svg+xml",
         "purpose": "any maskable"
       }
     ]
     ```
- **To customize the logo**: You can open `logo.svg` in any text editor or vector tool (Figma, Illustrator) to adjust colors or replace the file with any custom icon while keeping the same filename.
