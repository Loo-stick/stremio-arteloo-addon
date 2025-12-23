/**
 * Stremio Arte.tv Addon
 *
 * Addon pour accéder au catalogue Arte.tv en streaming légal et gratuit.
 * Propose des documentaires, films, séries et le direct.
 *
 * @version 1.0.0
 */

require('dotenv').config();

const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const express = require('express');
const ArteClient = require('./lib/arte');

// Configuration
const PORT = process.env.PORT || 7000;
const ADDON_URL = process.env.ADDON_URL || `http://localhost:${PORT}`;

// Client Arte
const arte = new ArteClient();

// Préfixe pour les IDs Stremio (évite les conflits avec d'autres addons)
const ID_PREFIX = 'arte:';

/**
 * Définition du manifest de l'addon
 */
const manifest = {
    id: 'community.stremio.arte',
    version: '1.0.0',
    name: 'Arte.tv',
    description: 'Streaming légal et gratuit depuis Arte.tv - Documentaires, films, séries et direct',
    logo: 'https://raw.githubusercontent.com/Loo-stick/stremio-arteloo-addon/main/logo.png',
    background: 'https://api-cdn.arte.tv/img/v2/image/3JuyT2qo2eFCkPakJL1j3P/1920x1080',
    contactEmail: '',
    resources: ['catalog', 'meta', 'stream'],
    types: ['movie', 'series', 'tv'],
    catalogs: [
        {
            type: 'movie',
            id: 'arte-home',
            name: 'Arte - À la une',
            extra: [{ name: 'skip', isRequired: false }]
        },
        {
            type: 'movie',
            id: 'arte-cinema',
            name: 'Arte - Cinéma',
            extra: [{ name: 'skip', isRequired: false }]
        },
        {
            type: 'movie',
            id: 'arte-docs',
            name: 'Arte - Documentaires',
            extra: [{ name: 'skip', isRequired: false }]
        },
        {
            type: 'series',
            id: 'arte-series',
            name: 'Arte - Séries',
            extra: [{ name: 'skip', isRequired: false }]
        },
        {
            type: 'tv',
            id: 'arte-live',
            name: 'Arte - Direct',
            extra: []
        }
    ],
    idPrefixes: [ID_PREFIX]
};

// Création du builder
const builder = new addonBuilder(manifest);

/**
 * Handler pour le catalogue
 */
builder.defineCatalogHandler(async ({ type, id, extra }) => {
    console.log(`[Addon] Catalogue demandé: ${id} (type: ${type})`);

    const skip = parseInt(extra?.skip) || 0;
    const limit = 50;

    try {
        let videos = [];

        switch (id) {
            case 'arte-home':
                videos = await arte.getHomepage();
                break;

            case 'arte-cinema':
                videos = await arte.getCategory('CIN');
                break;

            case 'arte-docs':
                videos = await arte.getCategory('DOR');
                break;

            case 'arte-series':
                videos = await arte.getCategory('SER');
                break;

            case 'arte-live':
                // Retourne le live comme un "channel"
                const live = await arte.getLiveStream();
                if (live && live.streamUrl) {
                    return {
                        metas: [{
                            id: `${ID_PREFIX}LIVE`,
                            type: 'tv',
                            name: 'Arte - Direct',
                            poster: 'https://static-cdn.arte.tv/guide/favicons/apple-touch-icon.png',
                            posterShape: 'square',
                            background: 'https://api-cdn.arte.tv/img/v2/image/3JuyT2qo2eFCkPakJL1j3P/1920x1080',
                            description: live.subtitle
                                ? `${live.title} - ${live.subtitle}`
                                : live.title || 'Arte en direct'
                        }]
                    };
                }
                return { metas: [] };

            default:
                return { metas: [] };
        }

        // Pagination
        const paginated = videos.slice(skip, skip + limit);

        // Formate pour Stremio
        const metas = paginated.map(video => ({
            id: `${ID_PREFIX}${video.programId}`,
            type: type,
            name: video.title,
            poster: video.imageLarge || video.image,
            posterShape: 'regular',
            description: video.description,
            releaseInfo: video.durationLabel,
            genres: video.genre ? [video.genre] : []
        }));

        console.log(`[Addon] Retour de ${metas.length} résultats (skip: ${skip})`);
        return { metas };

    } catch (error) {
        console.error(`[Addon] Erreur catalogue ${id}:`, error.message);
        return { metas: [] };
    }
});

/**
 * Handler pour les métadonnées
 */
builder.defineMetaHandler(async ({ type, id }) => {
    console.log(`[Addon] Meta demandée: ${id} (type: ${type})`);

    // Retire le préfixe
    const programId = id.replace(ID_PREFIX, '');

    // Cas spécial: Live
    if (programId === 'LIVE') {
        const live = await arte.getLiveStream();
        if (live) {
            return {
                meta: {
                    id: id,
                    type: 'tv',
                    name: 'Arte - Direct',
                    poster: 'https://static-cdn.arte.tv/guide/favicons/apple-touch-icon.png',
                    posterShape: 'square',
                    background: 'https://api-cdn.arte.tv/img/v2/image/3JuyT2qo2eFCkPakJL1j3P/1920x1080',
                    description: live.description || 'Arte en direct - La chaîne culturelle européenne',
                    runtime: 'En direct',
                    genres: ['Direct', 'Culture']
                }
            };
        }
        return { meta: null };
    }

    try {
        // Vérifie si c'est une collection (série)
        const isCollection = programId.startsWith('RC-');

        if (isCollection && type === 'series') {
            // Récupère les épisodes de la collection
            const episodes = await arte.getCollectionEpisodes(programId);
            const video = await arte.getVideoMeta(programId);

            if (!video && episodes.length === 0) {
                return { meta: null };
            }

            // Formate les épisodes pour Stremio
            const videos = episodes.map((ep, index) => ({
                id: `${ID_PREFIX}${ep.programId}`,
                title: ep.subtitle || ep.title,
                season: 1,
                episode: index + 1,
                thumbnail: ep.image,
                overview: ep.description,
                released: ep.availability?.start ? new Date(ep.availability.start).toISOString() : undefined
            }));

            // Image principale
            const poster = video?.images?.[0]?.url || episodes[0]?.image;

            return {
                meta: {
                    id: id,
                    type: 'series',
                    name: video?.title?.split(' - ')[0] || episodes[0]?.title?.split(' - ')[0] || 'Série Arte',
                    poster: poster,
                    posterShape: 'regular',
                    background: poster,
                    description: video?.description || episodes[0]?.description,
                    genres: ['Arte', 'Culture'],
                    videos: videos
                }
            };
        }

        // Contenu simple (film, documentaire)
        const video = await arte.getVideoMeta(programId);

        if (!video) {
            return { meta: null };
        }

        // Calcule la durée en format lisible
        const hours = Math.floor(video.duration / 3600);
        const minutes = Math.floor((video.duration % 3600) / 60);
        const runtime = hours > 0 ? `${hours}h${minutes}min` : `${minutes}min`;

        // Image principale
        const poster = video.images && video.images[0]
            ? video.images[0].url
            : null;

        // Date de fin de disponibilité
        let releaseInfo = runtime;
        if (video.rights && video.rights.end) {
            const endDate = new Date(video.rights.end);
            const now = new Date();
            const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
            if (daysLeft > 0 && daysLeft <= 30) {
                releaseInfo = `${runtime} | Dispo ${daysLeft}j`;
            }
        }

        return {
            meta: {
                id: id,
                type: type,
                name: video.title,
                poster: poster,
                posterShape: 'regular',
                background: poster,
                description: video.subtitle
                    ? `${video.subtitle}\n\n${video.description}`
                    : video.description,
                runtime: runtime,
                releaseInfo: releaseInfo,
                genres: ['Arte', 'Culture']
            }
        };

    } catch (error) {
        console.error(`[Addon] Erreur meta ${id}:`, error.message);
        return { meta: null };
    }
});

/**
 * Handler pour les streams
 */
builder.defineStreamHandler(async ({ type, id }) => {
    console.log(`[Addon] Stream demandé: ${id} (type: ${type})`);

    // Retire le préfixe
    const programId = id.replace(ID_PREFIX, '');

    try {
        let streamUrl;
        let title;

        if (programId === 'LIVE') {
            // Stream live
            const live = await arte.getLiveStream();
            if (!live || !live.streamUrl) {
                console.log('[Addon] Pas de stream live disponible');
                return { streams: [] };
            }
            streamUrl = live.streamUrl;
            title = 'Arte Direct';
        } else {
            // Stream VOD
            streamUrl = await arte.getStreamUrl(programId);
            if (!streamUrl) {
                console.log(`[Addon] Pas de stream pour ${programId}`);
                return { streams: [] };
            }

            const meta = await arte.getVideoMeta(programId);
            title = meta?.title || 'Arte';
        }

        console.log(`[Addon] Stream trouvé: ${streamUrl}`);

        return {
            streams: [{
                name: 'Arte.tv',
                title: `${title}\n🇫🇷 Français - HD`,
                url: streamUrl,
                behaviorHints: {
                    notWebReady: false
                }
            }]
        };

    } catch (error) {
        console.error(`[Addon] Erreur stream ${id}:`, error.message);
        return { streams: [] };
    }
});

// Interface de l'addon
const addonInterface = builder.getInterface();

// Serveur Express pour routes additionnelles
const app = express();

// CORS pour Stremio
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Route santé
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        addon: 'Arte.tv',
        version: manifest.version
    });
});

// Statistiques
app.get('/stats', (req, res) => {
    res.json({
        addon: 'Arte.tv',
        version: manifest.version,
        catalogs: manifest.catalogs.map(c => c.id)
    });
});

// Monte l'addon sur Express
const { getRouter } = require('stremio-addon-sdk');
app.use(getRouter(addonInterface));

// Démarrage du serveur
app.listen(PORT, () => {
    console.log(`
[Addon] ========================================
[Addon] Arte.tv Addon v${manifest.version} démarré!
[Addon] Port: ${PORT}
[Addon] URL publique: ${ADDON_URL}
[Addon] Manifest: ${ADDON_URL}/manifest.json
[Addon] ========================================

[Addon] Pour installer dans Stremio:
[Addon] 1. Ouvrez Stremio
[Addon] 2. Allez dans Addons > Community Addons
[Addon] 3. Collez: ${ADDON_URL}/manifest.json
[Addon] ========================================

[Addon] Catalogues disponibles:
[Addon]   - Arte - À la une (films/docs du moment)
[Addon]   - Arte - Cinéma (films)
[Addon]   - Arte - Documentaires
[Addon]   - Arte - Séries
[Addon]   - Arte - Direct (live)
[Addon] ========================================
`);
});
