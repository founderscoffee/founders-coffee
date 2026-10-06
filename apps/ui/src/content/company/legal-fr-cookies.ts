import { section, table, text, translatedPage } from './legal-translated';
import type { CompanyPageContent } from './types';

export const cookiesFrench: CompanyPageContent = translatedPage(
  'fr',
  'Politique de cookies',
  'Les cookies déposés sur votre appareil et leur utilité, les services extérieurs qui fonctionnent dans votre navigateur, et ce que nous n’utilisons pas : ni publicité, ni suivi entre sites.',
  [
    section(
      'En bref',
      text(
        'Nous déposons trois cookies : un pour garder votre session ouverte, un pour mémoriser la langue de l’interface et un pour mémoriser le pays vers lequel vous avez été dirigé. Notre prestataire Cloudflare en dépose un quatrième, qui mémorise que votre navigateur a passé son contrôle anti-robot.',
        '**Nous n’utilisons ni cookies publicitaires ni suivi entre sites, et nous ne constituons aucun profil d’intérêts à des fins marketing.**',
        'Des services extérieurs fonctionnent aussi dans votre navigateur, détaillés plus bas : la mesure d’audience et la détection des robots de Cloudflare, et les cartes de Mapbox sur les pages qui en affichent une.',
        'C’est pourquoi nous n’affichons pas de bannière de consentement au suivi : nous n’avons ni publicité ni suivi entre sites pour lesquels vous demander votre accord, et tout ce qui fonctionne dans votre navigateur figure sur cette page.',
      ),
    ),
    section(
      'Qu’est-ce qu’un cookie ?',
      text(
        'Un cookie est un petit fichier texte enregistré par votre navigateur à la demande d’un site, puis renvoyé lors de vos visites. Il mémorise un élément entre deux pages, comme votre connexion ou votre préférence de langue.',
      ),
    ),
    section('Cookies que nous plaçons', [
      table(
        ['Cookie', 'Type', 'Utilité', 'Durée'],
        [
          [
            '`__Secure-better-auth.session_token`',
            'Nécessaire',
            'Porte l’identifiant de votre session pour que votre connexion reste active entre les pages et les visites. Il est protégé des scripts de page et transmis uniquement par connexion chiffrée.',
            'Durée de la session',
          ],
          [
            '`PARAGLIDE_LOCALE`',
            'Préférence',
            'Mémorise la langue choisie : arabe, français ou anglais.',
            'Un an',
          ],
          [
            '`fc_geo`',
            'Préférence',
            'Mémorise le pays vers lequel vous avez été dirigé lors de votre première visite, afin d’éviter une redirection à chaque visite.',
            'Un an',
          ],
          [
            '`cf_clearance`',
            'Nécessaire',
            'Déposé par notre prestataire Cloudflare lorsque votre navigateur passe le contrôle anti-robot décrit plus bas, pour ne pas le répéter à chaque visite. Il est protégé des scripts de page et ne sert ni à la publicité ni à vous suivre d’un site à l’autre.',
            'Un an',
          ],
        ],
      ),
      ...text(
        'Le service de vérification humaine (Cloudflare Turnstile) peut déposer un cookie technique de courte durée lors de la connexion ou d’une inscription à la liste d’attente d’une ville, pour distinguer un visiteur d’un programme automatisé. Il ne sert pas au suivi et nous n’en lisons aucune donnée personnelle.',
      ),
    ]),
    section(
      'Services extérieurs dans votre navigateur',
      text(
        '**Mesure d’audience (Cloudflare Web Analytics).** Chaque page charge un script de Cloudflare qui lui transmet l’adresse de la page, celle de la page d’où vous venez et des mesures de vitesse de chargement ; comme toute connexion, la requête transmet aussi votre adresse IP et une description de votre navigateur et de votre appareil. Nous n’en voyons que des chiffres agrégés : nombre de visites, pages les plus consultées, vitesse des pages et pays d’origine des visites. Ce script ne dépose aucun cookie, n’enregistre rien sur votre appareil et ne vous reconnaît pas d’une visite à l’autre.',
        '**Détection des robots (Cloudflare).** Les pages chargent aussi un script de Cloudflare qui examine des caractéristiques techniques de votre navigateur pour distinguer un visiteur humain d’un programme automatisé, puis dépose le cookie `cf_clearance` indiqué plus haut. Il sert uniquement à protéger la plateforme contre l’usage automatisé.',
        '**Cartes (Mapbox).** Les pages qui affichent une carte, c’est-à-dire la création d’une rencontre, la modification de son lieu et la page d’une rencontre qui a un lieu, chargent la carte directement depuis Mapbox : Mapbox reçoit donc votre adresse IP, une description de votre navigateur et la zone affichée. La page d’une rencontre affiche la carte sous forme d’image et ne charge pas la bibliothèque de cartes. Lorsque vous créez une rencontre ou modifiez son lieu, la bibliothèque de cartes enregistre aussi dans le stockage local de votre navigateur un identifiant aléatoire et sa date de création, et les envoie à Mapbox avec des données d’utilisation techniques, comme le chargement d’une carte, qui lui servent à comptabiliser l’usage de son service. Ces données ne comprennent ni votre nom ni votre e-mail, et Mapbox les traite selon sa propre politique de confidentialité.',
      ),
    ),
    section(
      'Types que nous n’utilisons pas',
      text(
        '**Marketing et publicité.** Nous n’affichons pas de publicité et ne vendons pas d’espace publicitaire, donc ces cookies n’existent pas ici.',
        '**Suivi entre sites.** Nous ne participons pas à des réseaux de suivi et ne déposons rien qui relie votre visite chez nous à vos visites sur d’autres sites. Ce que Cloudflare et Mapbox reçoivent de votre navigateur est décrit dans la section précédente.',
      ),
    ),
    section(
      'Stockage sur votre appareil hors cookies',
      text(
        'La plateforme est une application web installable. Si vous l’installez sur votre téléphone, le navigateur garde une copie des fichiers de l’interface pour qu’elle fonctionne vite, même avec une connexion faible. Certains de vos choix d’affichage peuvent aussi être conservés localement.',
        'Ce stockage technique reste sur votre appareil, ne nous est pas transmis et disparaît lorsque vous supprimez les données du site ou l’application installée.',
        'Lorsque vous créez une rencontre ou modifiez son lieu, la bibliothèque Mapbox conserve dans le stockage local l’identifiant aléatoire et les données d’utilisation décrits plus haut. Ils sont transmis à Mapbox, pas à nous, et disparaissent aussi lorsque vous supprimez les données du site.',
        'Si vous activez les notifications push, le navigateur crée un jeton d’appareil que nous stockons pour vous envoyer les notifications. Ce n’est pas un cookie ; voir la [Politique de confidentialité](/privacy).',
      ),
    ),
    section(
      'Contrôler les cookies',
      text(
        'Vous pouvez supprimer ou bloquer les cookies dans les réglages de votre navigateur à tout moment.',
        'Tenez compte de l’effet : supprimer le cookie de session vous déconnecte, et bloquer tous les cookies rend la connexion impossible, car la session ne peut pas être conservée autrement.',
        'Supprimer les cookies de langue ou de pays n’empêche rien : le choix vous sera redemandé. Supprimer `cf_clearance` n’empêche rien non plus : le contrôle pourra être refait à votre prochaine visite.',
        'Vous pouvez bloquer le script de mesure d’audience avec un bloqueur de contenu sans gêner le fonctionnement de la plateforme ; bloquer Mapbox empêche l’affichage des cartes.',
      ),
    ),
    section(
      'En cas de changement',
      text(
        'Si nous ajoutons un outil de mesure, un service extérieur ou un cookie non listé ici, nous mettrons cette page à jour avant de le faire et demanderons votre consentement lorsque la loi l’exige.',
        'Questions : **contact@founders.coffee**',
      ),
    ),
  ],
  '6 octobre 2026',
);
