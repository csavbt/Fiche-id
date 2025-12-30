# Fiche Identification Pro — Version hébergeable (Vercel-ready)

## Lancer en local
```bash
npm install
npm run dev
```
Ouvrir http://localhost:3000

## Déployer sur Vercel
1. Mets ce dossier sur GitHub (ou import direct dans Vercel)
2. Sur Vercel -> Project Settings -> Environment Variables :
   - AES_KEY_BASE64 : copie depuis `.env.example`
3. Deploy

⚠️ Sur Vercel, les fichiers écrits sur disque (/tmp) sont temporaires.
Pour une prod (archives persistantes), brancher un stockage (S3/Supabase/serveur interne).

## Fonctionnalités présentes
- Choix entité + logos
- Formulaire (identité, logiciels, matériel + quantités)
- Téléphone: IMEI + N° obligatoires si coché
- PDF 2 pages (fiche + bon de réception) avec bloc support
- Sauvegarde JSON chiffrée (passwords chiffrés, pas affichés)
