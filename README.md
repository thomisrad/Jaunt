# Jaunt

An invite-only bike ride journal. Live at https://thomisrad.github.io/Jaunt/ once GitHub Pages is on.

- `index.html`, `style.css`, `script.js`: the app
- `firestore.rules`: database security rules (paste into the Firebase console)

The invite list lives in Firestore at `config/access` (`owner` email + `viewers` email list), not in this repo.

## Android app (for posting with photo locations)

The `android/` folder wraps the same website into an app, with a native photo picker that keeps
each photo's location and native Google sign-in. Viewers keep using the website.

One-time setup on your computer: Node.js, Android Studio, Git. Then:

```
git clone https://github.com/thomisrad/Jaunt.git
cd Jaunt
npm install
npm run sync      # copies the website into the app
npm run open      # opens the project in Android Studio
```

Put `google-services.json` (from the Firebase console's Android app) in `android/app/`.
After changing the website files, run `npm run sync` again, then press Run in Android Studio.
