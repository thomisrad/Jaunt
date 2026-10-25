# Jaunt

An invite-only bike ride journal. Live at https://thomisrad.github.io/Jaunt/ once GitHub Pages is on.

- `index.html`, `style.css`, `script.js`: the app
- `firestore.rules`: database security rules (paste into the Firebase console)

The invite list lives in Firestore at `config/access` (`owner` email + `viewers` email list), not in this repo.
