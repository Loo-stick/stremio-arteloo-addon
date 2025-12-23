# Arte.tv - Addon Stremio

Addon Stremio pour accéder au catalogue Arte.tv en streaming légal et gratuit.

## Contenu disponible

- **À la une** : Sélection éditoriale d'Arte
- **Cinéma** : Films disponibles en replay
- **Documentaires** : Large catalogue de documentaires
- **Séries** : Séries européennes et internationales
- **Direct** : Arte en live

## Installation

### Prérequis

- Node.js >= 14.0.0

### Installation locale

1. Clonez le projet :
```bash
git clone https://github.com/Loo-stick/stremio-arteloo-addon.git
cd stremio-arteloo-addon
```

2. Installez les dépendances :
```bash
npm install
```

3. Configurez l'environnement :
```bash
cp .env.example .env
```

4. Démarrez l'addon :
```bash
npm start
```

5. Installez dans Stremio :
   - Ouvrez Stremio
   - Allez dans **Addons** > **Community Addons**
   - Collez : `http://localhost:7000/manifest.json`
   - Cliquez sur **Install**

## Déploiement sur Render

1. Créez un nouveau Web Service sur [Render](https://render.com)
2. Connectez votre repo GitHub
3. Configurez les variables d'environnement :
   - `ADDON_URL` = `https://votre-app.onrender.com`
   - `PORT` = `7000`
4. Deploy!

## Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `PORT` | Port du serveur | 7000 |
| `ADDON_URL` | URL publique de l'addon | http://localhost:7000 |

## Routes utiles

| Route | Description |
|-------|-------------|
| `/manifest.json` | Manifest Stremio |
| `/health` | Statut de l'addon |
| `/stats` | Informations sur l'addon |

## Architecture

```
stremio-arte-addon/
├── index.js              # Serveur Express + Stremio SDK
├── lib/
│   └── arte.js           # Client API Arte.tv
├── .env.example
├── .env                  # Configuration (gitignore)
├── .gitignore
├── package.json
└── README.md
```

## Comment ça marche

1. L'addon récupère le catalogue via l'API Arte.tv (EMAC v4)
2. Quand vous sélectionnez un contenu, il récupère les métadonnées
3. Quand vous lancez la lecture, il récupère le stream HLS
4. Le stream est lu directement dans le player Stremio

## Notes

- Les contenus Arte sont géobloqués (France/Allemagne principalement)
- Les vidéos ont une durée de disponibilité limitée (indiquée dans les métadonnées)
- Pas besoin de clé API, tout est public

## Licence

MIT
