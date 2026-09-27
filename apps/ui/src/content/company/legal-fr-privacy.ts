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
        'Cette politique explique quelles données personnelles Founders Coffee collecte, pourquoi, qui peut y accéder, combien de temps nous les conservons et ce que vous pouvez faire à leur sujet.',
        '**Le responsable du traitement** est **Amine Yagoub**, une personne physique. Aucune société n’a encore été constituée pour exploiter ce pilote gratuit. La définition légale du responsable du traitement couvre les personnes physiques comme les personnes morales, et ses obligations envers vos données sont les mêmes dans les deux cas. Contact pour tout ce qui concerne vos données : **contact@founders.coffee**.',
        'Si une société est constituée plus tard, la qualité de responsable du traitement lui sera transférée. C’est un changement de la personne qui détient vos données, pas un détail administratif : nous vous en informerons avant qu’il prenne effet, comme indiqué à la section 12.',
        'Les traitements sont effectués conformément à la loi algérienne 18-07 du 10 juin 2018 relative à la protection des personnes physiques dans le traitement des données à caractère personnel, modifiée et complétée par la loi 25-11 du 24 juillet 2025.',
      ),
    ),
    section('Ce que nous collectons et pourquoi', [
      ...text(
        'Nous ne collectons pas de données vaguement « pour améliorer votre expérience ». Chaque catégorie de données ci-dessous a une raison précise, que l’on peut rattacher à une fonctionnalité existante de la plateforme.',
      ),
      subheading('Données du compte'),
      ...text(
        'Votre nom, votre e-mail et son statut de vérification, la photo du compte s’il y en a une, la langue de l’interface et la date de création. Nous les utilisons pour créer le compte, vous envoyer un code de connexion à chaque connexion, afficher votre nom sur votre profil public et aux personnes que vous rencontrez, et vous écrire au sujet des rencontres auxquelles vous êtes inscrit. Nous n’utilisons pas de mot de passe et n’en conservons aucun : la connexion se fait par un code temporaire envoyé à votre e-mail.',
        'Avec Google ou GitHub, nous recevons votre identifiant auprès du fournisseur et votre e-mail, pas votre mot de passe.',
        '**Obligatoire et facultatif.** L’e-mail et le nom sont nécessaires pour créer un compte, car sans eux nous ne pouvons ni vous envoyer de code de connexion ni vous présenter aux personnes que vous rencontrez ; si vous ne les fournissez pas, le compte ne peut pas être créé. Tout le reste de cette politique est facultatif, et ne pas le fournir désactive seulement la fonctionnalité correspondante.',
        '**Le numéro de téléphone** est facultatif. Nous ne le demandons pas à l’inscription et ne l’utilisons que si vous activez vous-même les alertes SMS ; nous enregistrons alors la date de votre accord.',
      ),
      subheading('Profil'),
      ...text(
        'Votre profil peut comprendre une présentation, ce que vous construisez et son étape, vos centres d’intérêt, vos langues, votre lien professionnel et votre photo.',
        'Votre nom, votre photo, votre présentation, votre mois d’inscription et le nombre de rencontres organisées apparaissent sur votre profil public. Ce que vous construisez et son étape, vos centres d’intérêt, vos langues, votre lien professionnel et le nombre de rencontres auxquelles vous avez participé n’apparaissent que si vous les publiez.',
        'Chaque champ facultatif a son propre réglage de visibilité et commence masqué. Vous pouvez supprimer votre photo et votre présentation à tout moment. Votre profil public est accessible à toute personne qui en a le lien, et les pages de profil demandent aux moteurs de recherche de ne pas les indexer.',
      ),
      subheading('Rencontres et inscriptions'),
      ...text(
        'Pour une rencontre que vous publiez, nous conservons le titre, la description, le nom du lieu, son adresse, ses coordonnées, l’horaire et la langue ; ces informations sont publiques par nature, puisqu’une rencontre est publiée pour être découverte.',
        'Pour une inscription, nous conservons l’inscription, son statut et sa date. L’organisateur voit **uniquement votre nom** dans la liste des inscrits, car il doit savoir qui attendre et réserver le lieu en conséquence. **Il ne voit ni votre e-mail ni votre numéro de téléphone**, et la plateforme ne lui donne aucun moyen de vous écrire directement. En revanche, s’il relie un groupe Telegram à sa rencontre et que vous choisissez de le rejoindre, il vous y voit et peut vous y écrire comme les autres membres, comme expliqué ci-dessous.',
      ),
      subheading('Groupes Telegram'),
      ...text(
        'L’organisateur peut relier son propre groupe Telegram à la rencontre, et les personnes inscrites peuvent le rejoindre. La liaison et l’adhésion sont facultatives ; ne pas utiliser cette option n’affecte ni votre inscription ni vos rappels.',
        'Lorsqu’un groupe est relié, nous conservons **son identifiant et son nom Telegram**. Si vous demandez à le rejoindre, nous créons **un lien d’invitation unique** pour vous. Lorsque Telegram transmet votre demande via ce lien, nous conservons **l’identifiant de votre compte Telegram** afin de vérifier votre inscription, d’approuver la demande et de vous retirer si vous annulez votre inscription. Telegram transmet d’autres données avec la demande, mais nous ne les conservons pas et ne demandons pas votre numéro de téléphone.',
        'Comme le bot est administrateur du groupe, Telegram lui transmet les messages du groupe. Nous ne les conservons ni ne les enregistrons ; nous vérifions seulement la commande de liaison de l’organisateur et ignorons le reste. Le bot publie uniquement les informations publiques de la rencontre et leurs changements, un rappel la veille, un avis d’annulation le cas échéant, les prochaines rencontres de la ville à la fin de la rencontre et un avis à l’organisateur si la liaison échoue.',
        '**Dans le groupe, votre compte apparaît aux membres et à l’organisateur comme Telegram l’affiche, et ils peuvent vous écrire.** La visibilité de votre numéro dépend de vos réglages de confidentialité Telegram, pas de la plateforme ; nous vous le rappelons avant votre demande de lien d’invitation. Telegram est un service indépendant : votre compte et vos conversations sont traités selon ses propres conditions et sa politique de confidentialité.',
        'Le lien avec le groupe prend fin un jour après la rencontre, ou lorsque l’organisateur supprime la liaison ou annule la rencontre. Le bot révoque alors les liens d’invitation qu’il a créés et quitte le groupe, sauf si l’organisateur le relie à une autre rencontre. Si l’organisateur retire le bot plus tôt, le lien prend fin immédiatement. Dans tous les cas, le groupe reste à l’organisateur et à ses membres, et aucun message ne nous parvient après le départ du bot.',
      ),
      subheading('Présence et retour après la rencontre'),
      ...text(
        'Après la rencontre, l’organisateur indique qui était réellement présent et qui ne l’était pas, le nombre de personnes venues sans inscription préalable, ainsi qu’une note privée sur le déroulement de la rencontre.',
        'Si vous étiez présent, vous pouvez laisser un avis : la valeur de la rencontre pour vous, votre intention de revenir et, si vous le souhaitez, un commentaire écrit. Nous conservons la langue du commentaire, car nous l’affichons tel que vous l’avez écrit, sans le traduire.',
        'Nous utilisons ces données pour savoir si les rencontres ont réellement lieu et profitent à ceux qui y assistent, et pour repérer les rencontres fictives et les organisateurs qui ne se présentent pas à leurs propres rencontres.',
        'Votre avis est confidentiel. L’organisateur voit un résultat agrégé pour sa rencontre, sans noms ni commentaires. **Les commentaires sont volontairement exclus de ce résultat** : dans une rencontre de quatre personnes, afficher trois commentaires révélerait leurs auteurs même sans leurs noms. Aucun avis n’apparaît sur la page publique de la rencontre.',
      ),
      subheading('Préférences et notifications'),
      ...text(
        'Vos choix sur ce que vous voulez recevoir (rappels des rencontres, changements, alertes d’inscription pour les organisateurs) et le canal voulu pour chaque type.',
        'Si vous activez les notifications push, nous conservons le jeton d’appareil qui permet de les envoyer et le type de plateforme. Ce jeton est un identifiant technique de l’appareil, dont on ne peut lire ni contenu ni localisation.',
      ),
      subheading('Données techniques et sécurité'),
      ...text(
        'Pour chaque session de connexion, nous conservons **l’adresse IP**, la description du navigateur et la durée de validité de la session. Nous conservons aussi des journaux techniques des requêtes reçues par le serveur.',
        'Leur finalité se limite à trois choses : vous garder connecté, détecter les tentatives de connexion illégitimes et les abus, et diagnostiquer les pannes.',
        'Nous utilisons aussi un service de vérification humaine lors de la connexion et de l’inscription à la liste d’attente d’une ville ; il reçoit votre adresse IP à cette seule fin.',
        'Chaque page exécute en outre un script de Cloudflare qui détecte les programmes automatisés : il examine des caractéristiques techniques de votre navigateur et dépose un cookie de sécurité, comme le détaille la [Politique de cookies](/cookies).',
        'Nous mesurons l’usage de la plateforme par des compteurs agrégés côté serveur (nombre de requêtes, de rencontres publiées, taux d’échec), qui ne sont attribués à personne.',
        'Nous utilisons aussi **Cloudflare Web Analytics** pour mesurer l’audience : chaque page charge un script qui transmet à Cloudflare l’adresse de la page, celle de la page d’où vous venez et des mesures de vitesse de chargement, avec votre adresse IP et une description de votre navigateur et de votre appareil, comme toute connexion. Nous n’en voyons que des chiffres agrégés ; il ne dépose aucun cookie et ne vous reconnaît pas d’une visite à l’autre. **Nous n’utilisons aucun outil de suivi publicitaire et ne vendons de données à personne.**',
      ),
      subheading('Cartes et recherche de lieux'),
      ...text(
        'La plateforme affiche des cartes grâce à **Mapbox** lors de la création d’une rencontre ou de la modification de son lieu, et sur la page d’une rencontre qui a un lieu. Votre navigateur charge la carte directement depuis Mapbox, qui reçoit donc votre adresse IP, une description de votre navigateur et la zone affichée. La bibliothèque de cartes enregistre aussi dans votre navigateur un identifiant aléatoire qu’elle envoie à Mapbox avec des données d’utilisation techniques, qui lui servent à comptabiliser l’usage de son service ; Mapbox traite ces données selon sa propre politique de confidentialité.',
        'Lorsque vous cherchez un lieu ou choisissez un point sur la carte, notre serveur envoie à Mapbox votre texte de recherche ou la position du point, avec la zone affichée, pour trouver les lieux correspondants. Nous n’y joignons ni votre nom ni votre e-mail.',
      ),
      subheading('Messages et signalements'),
      ...text(
        'Ce que vous nous envoyez comme demandes d’aide, réclamations ou signalements de contenu, et nos réponses. Nous les conservons pour suivre la demande et documenter les décisions de modération.',
      ),
      subheading('Listes d’attente de villes'),
      ...text(
        'Si vous cherchez une ville sans rencontre pour l’instant, vous pouvez laisser votre e-mail pour être prévenu du lancement de sa première rencontre. Nous conservons l’e-mail, la ville, la langue et la date de la demande, sans exiger de compte.',
        'Cet e-mail ne sert qu’à cela : une seule notification au lancement de la ville. Il n’est ajouté à aucune liste marketing et n’est utilisé pour rien d’autre que ce que vous avez demandé.',
      ),
    ]),
    section('Base juridique du traitement', [
      ...text(
        'Chaque traitement repose sur un fondement prévu par l’article 7 de la loi 18-07 :',
      ),
      list([
        '**Exécution du contrat qui nous lie :** le compte, votre profil public (votre nom, votre photo et votre présentation si vous les ajoutez, votre mois d’inscription et le nombre de rencontres organisées), la publication des rencontres, les inscriptions, et les rappels et alertes liés à une rencontre à laquelle vous êtes inscrit. Ce ne sont pas des services en plus, mais l’essentiel de ce pour quoi vous vous êtes inscrit.',
        '**Votre consentement explicite :** la publication des champs facultatifs du profil, qui ont chacun un réglage de visibilité, l’activation des notifications push ou SMS, l’inscription à la liste d’attente d’une ville, et la liaison d’un groupe Telegram à une rencontre ou l’adhésion à ce groupe. Vous pouvez retirer votre consentement à tout moment, sans remettre en cause la licéité de ce qui a été fait auparavant.',
        '**Intérêt légitime :** la sécurité de la plateforme, la prévention des abus, la mesure de l’usage par des chiffres agrégés qui ne sont attribués à personne, et les registres de présence comme moyen de protéger la communauté contre les rencontres fictives. Nous avons mis cet intérêt en balance avec vos droits : c’est pourquoi les registres de présence ne sont pas publics et vous pouvez les faire corriger.',
        '**Obligation légale :** lorsqu’un texte nous impose de conserver ou de transmettre une donnée.',
      ]),
      ...text(
        '**Nous ne pratiquons pas de marketing direct.** Tous les messages que vous recevez aujourd’hui concernent une rencontre ou votre compte. Si nous décidions un jour d’envoyer une newsletter ou des messages promotionnels, ce serait uniquement avec votre accord préalable et un moyen gratuit de vous désabonner dans chaque message, et nous traiterions la demande de désabonnement **sous vingt-quatre (24) heures**, comme l’exige l’article 32 de la loi 18-05.',
      ),
    ]),
    section(
      'Qui peut accéder à vos données',
      text(
        '**Tout visiteur de la plateforme**, même sans compte, voit votre profil public : votre nom, votre photo, votre présentation, votre mois d’inscription, le nombre de rencontres organisées et les champs facultatifs que vous avez publiés.',
        '**Les autres membres** vous voient aussi dans la liste des inscrits d’une rencontre que vous partagez avec eux.',
        '**L’organisateur** voit votre nom dans la liste des inscrits et indique si vous étiez présent. Les [Conditions des organisateurs](/organizers) l’obligent à n’utiliser cette liste que pour organiser sa rencontre ; l’utiliser pour envoyer des offres ou constituer une base de données est une infraction qui entraîne la suspension du compte.',
        '**Les membres du groupe Telegram** de la rencontre, si vous le rejoignez, vous voient comme Telegram vous affiche et peuvent vous y écrire. **Telegram** lui-même est une entité indépendante qui n’agit pas pour notre compte ; il reçoit de nous ce que le bot publie sur la rencontre, l’approbation de votre demande d’adhésion et votre retrait si vous annulez votre inscription.',
        '**Les prestataires techniques** auxquels nous faisons appel, chacun dans les limites de sa mission : **Cloudflare** pour l’hébergement de l’application et de la base de données, l’envoi des e-mails, la mesure d’audience et la protection anti-robot ; **Mapbox** pour l’affichage des cartes et la recherche de lieux ; et d’autres prestataires pour l’envoi des notifications push et des SMS si nécessaire. Ils traitent les données sur nos instructions et pour notre compte, sans pouvoir les utiliser à leurs propres fins, à l’exception des données d’utilisation envoyées par les cartes Mapbox, que Mapbox traite aussi selon sa propre politique de confidentialité.',
        '**Les autorités compétentes**, lorsque la loi nous impose de leur transmettre des données. Nous vérifions la qualité du demandeur et que la demande reste dans les limites de ce que le texte l’autorise à demander, et nous nous en tenons à ce qui est demandé.',
        '**Nous ne vendons, ne louons et n’échangeons pas vos données avec des annonceurs.**',
      ),
    ),
    section(
      'Transferts hors d’Algérie',
      text(
        'Nous le mentionnons explicitement parce que l’article 32 de la loi 18-07 l’exige, et parce que cela vous concerne.',
        'La plateforme fonctionne sur une infrastructure cloud distribuée, et les prestataires cités dans la section précédente sont situés hors d’Algérie. **Vos données sont donc traitées et stockées hors du territoire national.** Lorsqu’un groupe Telegram est relié à une rencontre, ce qui parvient à Telegram de notre part à son sujet et au sujet de ses membres est lui aussi traité hors d’Algérie, sur les serveurs de Telegram et selon ses conditions.',
        'Nous nous appuyons sur l’article 45 de la loi 18-07, qui autorise le transfert vers un pays étranger dans deux cas qui s’appliquent ici : **votre consentement explicite** et **la nécessité du transfert pour exécuter le contrat qui nous lie**, puisque votre compte ne peut pas fonctionner ni aucune notification vous parvenir sans que les données passent par cette infrastructure. En contrepartie, nous faisons appel à des prestataires engagés sur des standards de protection reconnus, nous chiffrons les connexions et nous limitons ce que reçoit chaque prestataire à ce qu’exige sa mission.',
        'C’est le fondement sur lequel nous nous appuyons aujourd’hui : l’article 45, et non l’autorisation préalable prévue à l’article 44. Si l’Autorité nationale de protection des données à caractère personnel délivre plus tard une autorisation pour ce transfert, nous mettrons cette section à jour pour y faire référence.',
        'Si ce transfert ne vous convient pas, vous pouvez retirer votre consentement et demander la fermeture de votre compte, et nous le ferons.',
      ),
    ),
    section('Durée de conservation', [
      ...text(
        'Nous conservons les données le temps nécessaire à la finalité pour laquelle elles ont été collectées, puis nous les supprimons ou les dépouillons de tout ce qui permet d’identifier leur titulaire.',
      ),
      table(
        ['Catégorie', 'Durée'],
        [
          [
            'Compte et profil',
            'Pendant toute la durée du compte, puis suppression sous **30 jours** après sa fermeture',
          ],
          [
            'Journaux de session (IP, navigateur)',
            'Suppression sous **90 jours** après la fin de la session',
          ],
          [
            'Rencontres publiées',
            'Restent dans l’historique public de la ville ; leur lien avec le nom de l’organisateur est supprimé à la fermeture de son compte',
          ],
          ['Inscriptions et présence', '**24 mois** après la rencontre'],
          [
            'Retours après rencontre',
            'Le commentaire reste associé à son auteur **12 mois**, puis l’avis est conservé sans identité',
          ],
          [
            'Lien d’invitation Telegram et identifiant de compte',
            'Jusqu’à l’annulation de votre inscription ou la fin de la liaison du groupe, soit environ un jour après la rencontre, puis suppression. Si l’identifiant est nécessaire pour vous retirer du groupe, il est conservé jusqu’à ce que le retrait soit fait ou devienne définitivement impossible',
          ],
          [
            'Identifiant et nom du groupe Telegram',
            'Avec l’historique de la rencontre',
          ],
          [
            'Jetons push',
            'Jusqu’à la désactivation des notifications ou l’invalidité du jeton',
          ],
          [
            'E-mail de liste d’attente',
            'Jusqu’à la notification de lancement, puis **12 mois**, ou suppression immédiate sur demande',
          ],
          [
            'Messages et signalements de modération',
            '**24 mois** après la clôture de la demande',
          ],
          ['Données imposées par la loi', 'La durée prévue par le texte'],
        ],
      ),
    ]),
    section('Vos droits et leur exercice', [
      ...text('La loi 18-07 vous accorde des droits que nous respectons :'),
      list([
        '**Information** (article 32) : savoir qui traite vos données, dans quel but, qui les reçoit et si elles sont transférées à l’étranger. Ce document est notre façon de respecter ce droit.',
        '**Accès** (article 34) : obtenir la confirmation que vos données sont traitées, leurs finalités, les catégories de données et les destinataires, une copie sous une forme compréhensible et les informations disponibles sur leur origine. La loi nous permet de refuser les demandes manifestement abusives (par leur nombre ou leur répétition), et c’est à nous, non à vous, d’en apporter la preuve.',
        '**Rectification** (article 35) : faire mettre à jour, corriger, effacer ou verrouiller vos données si elles sont incomplètes, inexactes ou traitées illégalement. **Nous le faisons gratuitement et sous dix (10) jours** à compter de votre demande. Si nous avons communiqué vos données à d’autres, nous les informons de la rectification.',
        '**Opposition** (article 36) : vous opposer, pour des motifs légitimes, à un traitement qui vous concerne, et vous opposer sans justification à l’utilisation de vos données à des fins de prospection.',
        '**Retrait du consentement** (article 7) : à tout moment, pour tout ce qui repose sur votre consentement.',
      ]),
      ...text(
        '**Comment les exercer.** Certains de ces droits sont disponibles directement sur la plateforme : modifier votre profil et vos réglages de visibilité depuis la page de profil, et vos préférences de notification depuis la page des préférences. Pour le reste (notamment obtenir une copie de vos données, faire corriger un registre de présence ou fermer votre compte), écrivez à **contact@founders.coffee** depuis l’e-mail associé à votre compte en précisant clairement votre demande.',
        '**La correction d’un registre de présence** mérite une mention particulière : si un organisateur a indiqué que vous étiez absent d’une rencontre à laquelle vous avez assisté, ou l’inverse, c’est une donnée personnelle qui vous concerne, et vous avez le droit de la faire corriger dans le même délai. Écrivez-nous et nous examinerons le registre.',
      ),
    ]),
    section(
      'Sécurité des données',
      text(
        'La connexion à la plateforme est entièrement chiffrée. L’identification se fait par un code temporaire qui expire vite : il n’y a donc pas de mot de passe à divulguer. L’accès administratif aux données de production est limité à un petit nombre de personnes derrière une couche d’authentification indépendante, et les opérations de modération sont journalisées.',
        'Toute personne ayant accès aux données du fait de ses fonctions est tenue au secret professionnel, même après la fin de sa relation avec nous, conformément à l’article 40 de la loi 18-07.',
        'Aucun système n’est toutefois sans risque. Si vous remarquez une faille ou un comportement suspect, écrivez-nous : nous traiterons votre signalement avec sérieux et reconnaissance.',
      ),
    ),
    section(
      'En cas de violation',
      text(
        'Si une violation touche vos données personnelles, nous en informons l’Autorité nationale de protection des données à caractère personnel sans délai, comme l’exige l’article 43 de la loi 18-07, et au plus tard dans les cinq (5) jours après en avoir eu connaissance.',
        'Nous vous informons directement si la violation peut porter atteinte à votre vie privée, en termes clairs, en expliquant ce qui s’est passé, ce qui peut en découler et les mesures que nous avons prises.',
        'Nous tenons un registre interne de chaque violation et des mesures prises.',
      ),
    ),
    section(
      'Cookies',
      text(
        'Nous utilisons un nombre limité de cookies, aucun pour la publicité ou le suivi entre sites. Des services extérieurs de mesure d’audience, de détection des robots et d’affichage de cartes fonctionnent aussi dans votre navigateur. Voir la [Politique de cookies](/cookies).',
      ),
    ),
    section(
      'Mineurs',
      text(
        'La plateforme est destinée aux personnes âgées d’au moins **dix-neuf (19) ans**, l’âge de la majorité civile en Algérie. Nous ne collectons pas sciemment de données de mineurs. S’il apparaît qu’un compte appartient à un mineur, nous le suspendons et supprimons les données qui s’y rattachent.',
        'Si vous êtes responsable légal et pensez qu’un mineur dont vous avez la charge a créé un compte, écrivez-nous et nous agirons.',
      ),
    ),
    section(
      'Modification de cette politique',
      text(
        'Nous pouvons modifier cette politique si la plateforme ou la loi change. Nous mettons à jour la date de « dernière mise à jour » à chaque fois, et nous vous prévenons à l’avance de toute modification substantielle de ce que nous collectons, de sa finalité ou de ses destinataires.',
        'Le changement de responsable du traitement, c’est-à-dire le passage de la plateforme de l’exploitant actuel à la société une fois constituée, est une modification substantielle en ce sens. Nous vous en informerons par e-mail avant son entrée en vigueur, avec l’identité de la société, et vous resterez libre de fermer votre compte avant cette date si ce transfert ne vous convient pas.',
      ),
    ),
    section(
      'Contact et réclamations',
      text(
        'Pour les questions et les demandes d’exercice de vos droits : **contact@founders.coffee**',
        'Si notre réponse ne vous satisfait pas, vous avez le droit d’adresser une réclamation à l’**Autorité nationale de protection des données à caractère personnel (ANPDP)**, l’autorité de contrôle compétente en Algérie.',
      ),
    ),
  ],
  '27 septembre 2026',
);
