import {
  list,
  section,
  subheading,
  table,
  text,
  translatedPage,
} from './legal-translated';
import type { CompanyPageContent } from './types';

export const privacyFrench: CompanyPageContent = translatedPage(
  'fr',
  'Politique de confidentialité',
  'Les données personnelles collectées par Founders Coffee, leurs usages, leurs destinataires, leur durée de conservation et vos droits.',
  [
    section(
      'Champ de la politique',
      text(
        'Cette politique explique quelles données personnelles Founders Coffee collecte, pourquoi, qui peut y accéder, combien de temps nous les conservons et ce que vous pouvez faire.',
        '**Le responsable du traitement** est **Amine Yagoub**, une personne physique. Aucune société n’a encore été constituée pour exploiter ce pilote gratuit. Contact : **contact@founders.coffee**. Si une société est créée, nous vous préviendrons avant le changement de responsable.',
        'Les traitements sont effectués conformément à la loi algérienne 18-07 du 10 juin 2018, modifiée par la loi 25-11 du 24 juillet 2025.',
      ),
    ),
    section('Ce que nous collectons et pourquoi', [
      ...text(
        'Nous ne collectons pas de données vaguement « pour améliorer votre expérience ». Chaque catégorie répond à une fonctionnalité précise.',
      ),
      subheading('Données du compte'),
      ...text(
        'Nom, e-mail et statut de vérification, photo facultative, langue de l’interface et date de création. Nous les utilisons pour créer le compte, envoyer les codes de connexion, afficher votre nom aux personnes rencontrées et vous contacter au sujet de vos rencontres. Nous ne demandons ni ne conservons de mot de passe.',
        'Avec Google ou GitHub, nous recevons votre identifiant auprès du fournisseur et votre e-mail, pas votre mot de passe. Le nom et l’e-mail sont nécessaires ; le téléphone est facultatif et n’est collecté que si vous activez les alertes SMS.',
      ),
      subheading('Profil'),
      ...text(
        'Votre profil peut comprendre une présentation, un titre, l’étape du projet, des centres d’intérêt, des langues, un lien professionnel et une photo.',
        'Votre nom, votre photo, votre présentation, votre mois d’inscription et le nombre de rencontres organisées apparaissent sur votre profil public. Le titre, l’étape du projet, les centres d’intérêt, les langues, le lien professionnel et le nombre de rencontres auxquelles vous avez participé n’apparaissent que si vous les publiez.',
        'Chaque champ facultatif a son propre réglage de visibilité et commence masqué. Les champs publiés peuvent être accessibles aux moteurs de recherche, même si les profils publics ne sont pas indexés.',
      ),
      subheading('Rencontres et inscriptions'),
      ...text(
        'Pour une rencontre publiée, nous conservons le titre, la description, le lieu, l’adresse, les coordonnées, l’horaire et la langue ; ces informations sont publiques pour permettre la découverte. Pour une inscription, nous conservons l’inscription, son statut et sa date. L’organisateur ne voit que votre nom, pas votre e-mail ni votre téléphone. Si vous rejoignez volontairement un groupe Telegram lié à la rencontre, les membres Telegram peuvent vous voir et vous écrire sur Telegram.',
      ),
      subheading('Groupes Telegram'),
      ...text(
        'L’organisateur peut relier son propre groupe Telegram à la rencontre, et les personnes inscrites peuvent le rejoindre. La liaison et l’adhésion sont facultatives ; ne pas utiliser cette option n’affecte ni votre inscription ni vos rappels.',
        'Lorsqu’un groupe est relié, nous conservons **son identifiant et son nom Telegram**. Si vous demandez à le rejoindre, nous créons **un lien d’invitation unique** pour vous. Lorsque Telegram transmet votre demande via ce lien, nous conservons **l’identifiant de votre compte Telegram** afin de vérifier votre inscription, d’approuver la demande et de vous retirer si vous annulez. Telegram transmet d’autres données avec la demande, mais nous ne les conservons pas et ne demandons pas votre numéro de téléphone.',
        'Comme le bot est administrateur du groupe, Telegram lui transmet les messages du groupe. Nous ne les conservons ni ne les enregistrons ; nous vérifions seulement la commande de liaison de l’organisateur et ignorons le reste. Le bot publie uniquement les informations publiques de la rencontre et leurs changements, un rappel la veille, un avis d’annulation le cas échéant, les prochaines rencontres de la ville à la fin de la rencontre et un avis à l’organisateur si la liaison échoue.',
        '**Dans le groupe, votre compte apparaît aux membres et à l’organisateur comme Telegram l’affiche, et ils peuvent vous écrire.** La visibilité de votre numéro dépend de vos réglages de confidentialité Telegram, pas de la plateforme ; nous vous le rappelons avant votre demande de lien d’invitation. Telegram est un service indépendant : votre compte et vos conversations sont traités selon ses propres conditions et sa politique de confidentialité.',
        'Le lien avec le groupe prend fin un jour après la rencontre, ou lorsque l’organisateur supprime la liaison ou annule la rencontre. Le bot révoque alors les liens d’invitation qu’il a créés et quitte le groupe, sauf si l’organisateur le relie à une autre rencontre. Si l’organisateur retire le bot plus tôt, le lien prend fin immédiatement. Dans tous les cas, le groupe reste à l’organisateur et à ses membres, et aucun message ne nous parvient après le départ du bot.',
      ),
      subheading('Présence et retour après la rencontre'),
      ...text(
        'Après la rencontre, l’organisateur indique les présents, les absents, les arrivées sans inscription et ajoute une note privée. Si vous étiez présent, vous pouvez noter la valeur de la rencontre, votre intention de revenir et laisser un commentaire. Nous conservons la langue du commentaire et l’affichons sans le traduire.',
        'Nous utilisons ces données pour vérifier que les rencontres ont lieu et protéger la communauté. Votre retour est privé : l’organisateur reçoit un résultat agrégé sans noms ni commentaires, et aucune note n’apparaît sur la page publique.',
      ),
      subheading('Préférences et notifications'),
      ...text(
        'Vos choix de rappels, changements, alertes d’inscription pour les organisateurs et canaux de réception. Si vous activez les notifications push, nous conservons un jeton d’appareil et son type de plateforme. Il s’agit d’un identifiant technique, sans contenu ni localisation.',
      ),
      subheading('Données techniques et sécurité'),
      ...text(
        'Pour chaque session, nous conservons l’adresse IP, la description du navigateur et l’expiration, ainsi que des journaux techniques. Ils servent à maintenir la connexion, détecter les accès non autorisés et diagnostiquer les pannes. Le service de vérification humaine reçoit votre IP uniquement lors de la connexion ou d’une inscription à une liste d’attente.',
        'Nous mesurons l’usage par des compteurs agrégés côté serveur, sans les attribuer à une personne. **Nous n’utilisons ni analytics dans le navigateur, ni suivi publicitaire, et ne vendons pas vos données.**',
      ),
      subheading('Messages et signalements'),
      ...text(
        'Nous conservons les demandes d’aide, réclamations, signalements de contenu et nos réponses pour suivre la demande et documenter la modération.',
      ),
      subheading('Listes d’attente de villes'),
      ...text(
        'Pour une ville sans rencontre, vous pouvez laisser votre e-mail afin de recevoir une notification au lancement de la première. Nous conservons l’e-mail, la ville, la langue et la date pour cette seule notification ; ce n’est pas une liste marketing.',
      ),
    ]),
    section('Base juridique du traitement', [
      ...text(
        'Chaque traitement repose sur un fondement prévu par l’article 7 de la loi 18-07 :',
      ),
      list([
        '**Exécution du contrat :** compte, publication, inscriptions et rappels liés à une rencontre.',
        '**Votre consentement explicite :** champs publics du profil, notifications push ou SMS, listes d’attente et groupes Telegram. Vous pouvez le retirer à tout moment.',
        '**Intérêt légitime :** sécurité, prévention des abus et registre de présence pour protéger la communauté ; les registres restent privés et corrigeables.',
        '**Obligation légale :** lorsqu’un texte nous impose de conserver ou transmettre une donnée.',
      ]),
      ...text(
        '**Nous ne pratiquons pas de marketing direct aujourd’hui.** Toute future newsletter ou communication promotionnelle nécessitera votre accord préalable, un désabonnement gratuit et un traitement de la demande sous 24 heures conformément à l’article 32 de la loi 18-05.',
      ),
    ]),
    section(
      'Qui peut accéder à vos données',
      text(
        '**Les autres membres** voient votre nom, votre photo et les éléments publiés, ainsi que votre présence dans une liste partagée.',
        '**L’organisateur** voit votre nom et enregistre la présence. Les [Conditions des organisateurs](/organizers) interdisent tout usage commercial ou toute base séparée.',
        '**Les membres d’un groupe Telegram**, si vous le rejoignez, vous voient comme Telegram vous présente. Telegram est indépendant et reçoit les messages du bot liés à la rencontre.',
        '**Les prestataires techniques** traitent uniquement les données nécessaires à leur tâche : hébergement, e-mail, push, cartes, protection anti-robot ou SMS. Ils agissent pour nous et sur instructions.',
        '**Les autorités** peuvent recevoir les données lorsqu’un texte l’exige ; nous vérifions la demande et limitons la transmission. **Nous ne vendons, ne louons et n’échangeons pas vos données avec des annonceurs.**',
      ),
    ),
    section(
      'Transferts hors d’Algérie',
      text(
        'Notre infrastructure cloud distribuée et les prestataires mentionnés sont situés hors d’Algérie : vos données y sont donc traitées et stockées. Telegram traite également les données de groupe hors d’Algérie selon ses propres conditions. Nous nous appuyons sur l’article 45 de la loi 18-07 : votre consentement explicite et la nécessité du transfert pour exécuter le contrat. Nous utilisons des prestataires offrant des garanties reconnues, des connexions chiffrées et un accès limité. Vous pouvez retirer votre consentement et demander la fermeture du compte si ce transfert vous est inacceptable.',
      ),
    ),
    section('Durée de conservation', [
      ...text(
        'Nous conservons les données le temps nécessaire à leur finalité, puis nous les supprimons ou les anonymisons.',
      ),
      table(
        ['Catégorie', 'Durée'],
        [
          [
            'Compte et profil',
            'Pendant le compte, puis suppression sous **30 jours** après fermeture',
          ],
          [
            'Journaux de session (IP, navigateur)',
            'Suppression sous **90 jours** après la fin de la session',
          ],
          [
            'Rencontres publiées',
            'Dans l’historique public ; séparation du nom de l’organisateur à la fermeture',
          ],
          ['Inscriptions et présence', '**24 mois** après la rencontre'],
          [
            'Retours après rencontre',
            'Commentaire associé à son auteur **12 mois**, puis anonymisé',
          ],
          [
            'Lien Telegram et identifiant de compte',
            'Jusqu’à annulation ou fin du lien, plus longtemps seulement pour permettre le retrait',
          ],
          [
            'Identifiant et nom du groupe Telegram',
            'Avec l’historique de la rencontre',
          ],
          ['Jetons push', 'Jusqu’à désactivation ou invalidité'],
          [
            'E-mail de liste d’attente',
            'Jusqu’à la notification, puis **12 mois**, ou suppression sur demande',
          ],
          ['Messages et signalements', '**24 mois** après la clôture'],
          ['Données imposées par la loi', 'La durée prévue par le texte'],
        ],
      ),
    ]),
    section('Vos droits et leur exercice', [
      ...text('La loi 18-07 vous donne notamment :'),
      list([
        '**Information** (article 32) : connaître le responsable, les finalités, les destinataires et les transferts.',
        '**Accès** (article 34) : obtenir confirmation, finalités, catégories, destinataires et une copie compréhensible.',
        '**Rectification** (article 35) : corriger, supprimer ou verrouiller les données incomplètes, inexactes ou illicites, gratuitement sous **10 jours**.',
        '**Opposition** (article 36) : vous opposer pour des raisons légitimes et au démarchage sans justification.',
        '**Retrait du consentement** (article 7) : à tout moment pour les traitements fondés sur votre accord.',
      ]),
      ...text(
        'Vous pouvez modifier votre profil et vos préférences directement. Pour une copie, une correction de présence ou la fermeture du compte, écrivez depuis l’e-mail du compte à **contact@founders.coffee** en précisant votre demande.',
      ),
    ]),
    section(
      'Sécurité des données',
      text(
        'Les connexions sont chiffrées et la connexion utilise un code temporaire, sans mot de passe à divulguer. L’accès de production est limité et les actions de modération sont journalisées. Toute personne ayant accès aux données est tenue au secret professionnel selon l’article 40. Aucun système n’est sans risque : signalez-nous toute faille ou comportement suspect.',
      ),
    ),
    section(
      'En cas de violation',
      text(
        'Si une violation touche des données personnelles, nous informons sans délai l’Autorité nationale de protection des données personnelles et au plus tard sous cinq jours selon l’article 43 de la loi 18-07. Nous vous informons directement si votre vie privée peut être affectée, expliquons les faits et les mesures prises, et conservons un registre interne.',
      ),
    ),
    section(
      'Cookies',
      text(
        'Nous utilisons un nombre limité de cookies, jamais pour la publicité ou le suivi. Voir la [Politique de cookies](/cookies).',
      ),
    ),
    section(
      'Mineurs',
      text(
        'La plateforme est destinée aux personnes âgées de **dix-neuf (19) ans**. Nous ne collectons pas sciemment les données de mineurs ; si nous découvrons un compte, nous le suspendons et supprimons les données associées. Un responsable légal peut nous contacter.',
      ),
    ),
    section(
      'Modification de cette politique',
      text(
        'Nous pouvons modifier cette politique lorsque la plateforme ou la loi change et mettons à jour la date. Nous vous prévenons de toute modification substantielle. Le changement de responsable lors de la création d’une société est substantiel : nous vous communiquons son identité et vous pouvez fermer votre compte avant son entrée en vigueur.',
      ),
    ),
    section(
      'Contact et réclamations',
      text(
        'Questions et demandes de droits : **contact@founders.coffee**. Si notre réponse ne vous satisfait pas, vous pouvez saisir l’**Autorité nationale de protection des données personnelles (ANPDP)**, autorité compétente en Algérie.',
      ),
    ),
  ],
  '18 septembre 2026',
);
