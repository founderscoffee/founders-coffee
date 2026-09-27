import {
  list,
  section,
  subheading,
  text,
  translatedPage,
} from './legal-translated';
import type { CompanyPageContent } from './types';

export const communityFrench: CompanyPageContent = translatedPage(
  'fr',
  'Règles de la communauté',
  'Ce que nous attendons de la communauté Founders Coffee, ce qui est interdit et la façon dont nous traitons les violations.',
  [
    section(
      'Pourquoi ce document existe',
      text(
        'Founders Coffee repose sur une idée simple : que des porteurs de projets d’une même ville s’assoient autour d’une table et parlent honnêtement de ce sur quoi ils travaillent. Ces règles interdisent tout ce qui gâche cette conversation.',
        'Ce n’est pas une liste générale d’interdits reprise d’un réseau social. Les problèmes qui touchent une communauté comme celle-ci sont connus et précis : celui qui vient vendre au lieu d’échanger, celui qui publie une rencontre qu’il ne compte pas tenir, celui qui enjolive la description de son entreprise au point qu’elle devient mensongère, celui qui collecte les numéros des participants pour les ajouter à une liste. C’est précisément de cela que nous parlons.',
        'Ces règles font partie des [Conditions d’utilisation](/terms) et s’appliquent à tout ce qui apparaît sur la plateforme : les profils, les pages des rencontres, les avis et les messages qui nous parviennent.',
      ),
    ),
    section(
      'Ce que nous attendons',
      text(
        '**Soyez la personne que vous dites être.** Un vrai nom, et une description honnête de ce sur quoi vous travaillez. Un projet qui débute se présente comme un projet qui débute ; il n’y a aucun mal à cela, et toute la communauté est passée par là.',
        '**Venez si vous êtes inscrit, et annulez si vous ne pouvez pas.** L’organisateur réserve une table en fonction du nombre qu’il voit. Votre absence sans prévenir lui coûte quelque chose de réel.',
        '**Demandez avant de présenter votre offre.** Ce qui distingue une conversation utile d’une sollicitation importune, c’est que l’autre personne l’a demandée.',
      ),
    ),
    section('Ce qui est interdit', [
      subheading('Promotion non sollicitée'),
      ...text(
        'N’envoyez pas d’offres commerciales ou de services à des membres qui ne les ont pas demandés. Ne transformez pas la description de votre rencontre en publicité pour votre entreprise. Ne republiez pas la même rencontre encore et encore pour la maintenir en tête de liste.',
        'Parler de votre projet pendant une rencontre est la raison même d’être de la plateforme. Ce qui est interdit, c’est d’utiliser la plateforme comme canal d’envoi en masse.',
      ),
      subheading('Rencontres fausses ou non sérieuses'),
      ...text(
        'Ne publiez pas une rencontre que vous ne comptez pas tenir, ni une rencontre dont vous savez le lieu ou l’horaire inexacts, ni une rencontre dont le but réel n’est pas celui annoncé dans sa description.',
        'Une rencontre publiée qui n’a pas lieu affaiblit la confiance dans toutes les rencontres suivantes. Et nous le suivons : après chaque rencontre, on demande à l’organisateur si elle a réellement eu lieu, et celui qui publie de manière répétée des rencontres qui n’ont pas lieu perd la possibilité de publier.',
      ),
      subheading('Faux profils et usurpation'),
      ...text(
        'Ne créez pas de compte au nom d’une autre personne ou d’une entreprise que vous ne représentez pas. Ne vous attribuez pas sans fondement une fonction, un partenariat ou un lien avec une organisation connue. Ne créez pas plusieurs comptes pour contourner une décision de modération.',
      ),
      subheading('Allégations financières et d’investissement trompeuses'),
      ...text(
        'Ne prétendez pas avoir levé des fonds que vous n’avez pas levés, être soutenu par un fonds ou un accélérateur si ce n’est pas vrai, ni représenter un investisseur que vous ne représentez pas.',
        'Ne promettez pas de rendement garanti, n’appelez pas à collecter de l’argent auprès des participants d’une rencontre et n’utilisez pas la plateforme pour promouvoir des montages d’investissement, des monnaies ou des occasions de gain rapide. Ce type d’allégation ne nuit pas seulement à la réputation ; il peut coûter à quelqu’un ses économies.',
      ),
      subheading('Fraude au recrutement'),
      ...text(
        'Ne publiez pas d’offres d’emploi qui ne sont pas réelles, ne demandez pas d’argent à un candidat en échange d’une formation, du traitement d’un dossier ou de la garantie d’un emploi, et ne collectez pas de documents personnels sous prétexte de recrutement.',
      ),
      subheading('Collecte ou publication de données'),
      ...text(
        'La liste des inscrits d’une rencontre est remise à l’organisateur dans un seul but : organiser sa rencontre. La copier, l’exporter, l’ajouter à une liste de diffusion ou la vendre est une violation caractérisée.',
        'Il est interdit d’utiliser des programmes automatisés pour extraire les données des membres de la plateforme.',
        'Ne publiez pas d’informations personnelles sur un autre membre (son numéro de téléphone, son adresse, son lieu de travail, sa photo) sans son autorisation, que ce soit sur la plateforme ou en dehors.',
      ),
      subheading('Harcèlement, discrimination et menaces'),
      ...text(
        'Ne harcelez pas, ne menacez pas et n’insultez pas. La discrimination ou les comportements offensants fondés sur le sexe, l’origine, la langue, la religion, le handicap ou tout autre motif ne sont pas acceptés.',
        'Ce qui se passe pendant la rencontre elle-même nous concerne autant que ce qui est écrit sur la plateforme. Si vous avez subi un tel comportement lors d’une rencontre publiée chez nous, signalez-le-nous.',
      ),
      subheading('Contenu et services illégaux'),
      ...text(
        'Rien de contraire au droit algérien ne peut être publié sur la plateforme, ni rien qui concerne la vente de biens ou de services interdits, ni liens malveillants ou pages d’hameçonnage.',
      ),
      subheading('Droits des tiers'),
      ...text(
        'N’importez pas un logo, une image ou un texte que vous n’avez pas le droit d’utiliser. Celui qui a écrit ou photographié a un droit sur ce qu’il a produit, et ce droit est protégé par la loi.',
      ),
    ]),
    section(
      'Organisateurs',
      text(
        'Celui qui publie une rencontre a des responsabilités supplémentaires (exactitude des informations, autorisations si nécessaire, et information des inscrits en cas de changement ou d’annulation), détaillées dans les [Conditions des organisateurs](/organizers).',
      ),
    ),
    section('Application des règles', [
      ...text(
        'Lorsque nous recevons un signalement ou constatons une violation, nous examinons le cas et choisissons la mesure adaptée parmi :',
      ),
      list([
        '**un avertissement** qui explique ce qui s’est passé et ce que nous attendons ;',
        '**la suppression du contenu contraire aux règles** ou son masquage ;',
        '**la dépublication d’une rencontre** ;',
        '**la restriction d’une fonctionnalité** pour une durée déterminée, comme l’interdiction de publier de nouvelles rencontres ;',
        '**la suspension du compte** ;',
        '**la fermeture définitive du compte**.',
      ]),
      ...text(
        '**Nous ne sommes pas tenus à un ordre fixe.** Pour les violations mineures ou qui semblent dues à une inattention, nous commençons par un avertissement, car il suffit le plus souvent. En revanche, pour la fraude, l’usurpation d’identité, les menaces et ce qui touche à la sécurité des personnes, nous agissons immédiatement et sans avertissement préalable. Promettre une gradation fixe dans de tels cas serait une promesse à ne pas faire.',
        'Nous tenons aussi compte du contexte : le comportement s’est-il répété ? A-t-il réellement causé du tort à quelqu’un ? A-t-il été corrigé après l’avertissement ?',
      ),
    ]),
    section(
      'Signaler un problème',
      text(
        'Écrivez-nous à **contact@founders.coffee** en indiquant le lien de la rencontre, du profil ou du contenu, et ce que vous y avez vu. Une description précise raccourcit l’examen.',
        'Les signalements sont traités de manière confidentielle. Nous ne révélons pas l’identité de l’auteur du signalement à la personne signalée.',
        'S’il existe un danger immédiat pour une personne, contactez d’abord les autorités compétentes ; nous sommes une plateforme numérique et n’avons aucun moyen d’intervenir sur le terrain.',
      ),
    ),
    section(
      'Si une décision vous semble erronée',
      text(
        'Écrivez-nous et expliquez. Nous réexaminons les décisions et corrigeons celles qui se révèlent injustifiées. La modération est un travail humain, et il lui arrive de se tromper.',
      ),
    ),
  ],
  '18 septembre 2026',
);
