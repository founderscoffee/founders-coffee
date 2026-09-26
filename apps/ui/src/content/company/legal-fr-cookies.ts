import { page, section, table, text } from './legal-translated';
import type { CompanyPageContent } from './types';

export const cookiesFrench: CompanyPageContent = page(
  'Politique de cookies',
  'Les trois cookies utilisés par Founders Coffee, leur utilité et ce que nous n’utilisons pas : ni analyse, ni publicité, ni suivi.',
  [
    section(
      'En bref',
      text(
        'Nous utilisons trois cookies : un pour garder votre session ouverte, un pour mémoriser la langue de l’interface et un pour mémoriser le pays choisi lors de votre première visite.',
        '**Nous n’utilisons ni cookies d’analyse, ni cookies publicitaires, ni suivi entre sites.** Aucun script tiers ne surveille votre navigation et aucun profil publicitaire n’est créé.',
        'C’est pourquoi nous n’affichons pas de bannière de consentement au suivi : il n’y a pas de suivi auquel consentir.',
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
            'Maintient votre session entre les pages et les visites. Il est protégé des scripts de page et transmis uniquement par connexion chiffrée.',
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
            'Mémorise le pays choisi lors de la première visite afin d’éviter une redirection à chaque visite.',
            'Un an',
          ],
        ],
      ),
      ...text(
        'Le service de protection anti-robot peut placer un cookie technique de courte durée lors de la connexion ou d’une inscription à une liste d’attente. Il ne sert pas au suivi et nous n’en lisons aucune donnée personnelle.',
      ),
    ]),
    section(
      'Types que nous n’utilisons pas',
      text(
        '**Analyse.** Nous utilisons des compteurs agrégés côté serveur, sans outil de mesure dans le navigateur et sans lien avec une personne.',
        '**Marketing et publicité.** Nous n’affichons pas de publicité et ne vendons pas d’espace publicitaire.',
        '**Suivi entre sites.** Nous ne participons pas à des réseaux de suivi et ne permettons pas à un tiers de savoir que vous nous avez visités.',
      ),
    ),
    section(
      'Stockage sur votre appareil hors cookies',
      text(
        'La plateforme est une application web installable. Après installation, votre navigateur peut mettre en cache des fichiers d’interface et conserver des préférences locales. Ce stockage technique ne nous est pas transmis et disparaît lorsque vous supprimez les données du site ou l’application installée.',
        'Si vous activez les notifications push, le navigateur crée un jeton d’appareil que nous stockons pour envoyer les notifications. Ce n’est pas un cookie ; voir la [Politique de confidentialité](/privacy).',
      ),
    ),
    section(
      'Contrôler les cookies',
      text(
        'Vous pouvez supprimer ou bloquer les cookies dans les réglages de votre navigateur. La suppression du cookie de session vous déconnecte ; le blocage des cookies empêche la connexion. Supprimer les cookies de langue ou de pays signifie seulement que le choix vous sera redemandé.',
      ),
    ),
    section(
      'En cas de changement',
      text(
        'Si nous ajoutons des outils d’analyse ou un cookie non listé ici, nous mettrons cette page à jour avant son ajout et demanderons votre consentement lorsque la loi l’exige. Questions : **contact@founders.coffee**',
      ),
    ),
  ],
  '18 septembre 2026',
);
