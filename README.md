# StickerWorld 🌍

Boutique en ligne de stickers : **un sticker pour chaque ville du monde**.

Un site statique (HTML / CSS / JavaScript pur, sans dépendance ni build) qui
affiche un catalogue de villes du monde entier. Chaque ville possède un sticker
au visuel généré automatiquement (badge SVG coloré avec l'initiale, le nom et le
drapeau du pays).

## Fonctionnalités

- **Catalogue mondial** : villes réparties sur 5 continents (Europe, Afrique,
  Asie, Amériques, Océanie).
- **Sticker unique par ville** : visuel SVG généré à la volée, couleur et style
  déterministes (la même ville garde toujours le même sticker).
- **Recherche** instantanée par nom de ville ou de pays.
- **Filtres** par continent.
- **Panier** complet (ajout, quantités, total) avec sauvegarde dans
  `localStorage`, et un faux passage de commande (démo).
- **Responsive** et utilisable sur mobile.

## Lancer le site

Aucune installation requise. Il suffit d'ouvrir `index.html` dans un navigateur,
ou de servir le dossier :

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Structure

| Fichier      | Rôle                                                        |
|--------------|-------------------------------------------------------------|
| `index.html` | Structure de la page                                        |
| `style.css`  | Styles (thème sombre, cartes, panier latéral)               |
| `cities.js`  | Données : liste des villes, continents, prix                |
| `app.js`     | Logique : génération des stickers, recherche, filtres, panier |

## Ajouter une ville

Il suffit d'ajouter une entrée dans le tableau `CITIES` de `cities.js` :

```js
{ name: "Nantes", country: "France", flag: "🇫🇷", continent: "europe" },
```

Le sticker correspondant est généré automatiquement.

> Démo — aucun paiement réel n'est effectué.
