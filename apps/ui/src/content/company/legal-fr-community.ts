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
        'Founders Coffee repose sur une idée simple : des personnes ayant des projets s’assoient autour d’une table et parlent honnêtement de ce qu’elles construisent. Ces règles interdisent ce qui dégrade cette conversation.',
        'Elles répondent aux risques propres à cette communauté : vendre au lieu d’échanger, publier une rencontre que l’on ne tiendra pas, transformer une description d’entreprise en mensonge ou collecter les coordonnées des participants pour une liste.',
        'Elles font partie des [Conditions d’utilisation](/terms) et s’appliquent aux profils, pages de rencontres, retours et messages qui nous sont envoyés.',
      ),
    ),
    section(
      'Ce que nous attendons',
      text(
        '**Soyez la personne que vous dites être.** Utilisez votre vrai nom et décrivez votre activité honnêtement.',
        '**Venez si vous vous inscrivez ; annulez sinon.** Les hôtes réservent une table selon le nombre affiché et une absence non signalée a un coût réel.',
        '**Demandez avant de présenter votre offre.** Une conversation utile se distingue d’un harcèlement par le consentement de l’autre personne.',
      ),
    ),
    section('Ce qui est interdit', [
      subheading('Promotion non sollicitée'),
      ...text(
        'N’envoyez pas d’offres commerciales à des membres qui ne les ont pas demandées, ne transformez pas une description en publicité et ne republiez pas la même rencontre pour la maintenir en tête. Parler de son projet est bienvenu ; utiliser la plateforme pour du démarchage massif ne l’est pas.',
      ),
      subheading('Rencontres fausses ou non sérieuses'),
      ...text(
        'Ne publiez pas une rencontre que vous ne comptez pas tenir, avec un lieu ou un horaire volontairement faux, ni avec un objectif dissimulé. Les publications répétées de rencontres qui n’ont jamais lieu peuvent entraîner la perte du droit de publier.',
      ),
      subheading('Faux profils et usurpation'),
      ...text(
        'Ne créez pas de compte au nom d’une autre personne, ne revendiquez pas un rôle ou un partenariat sans fondement et ne créez pas plusieurs comptes pour contourner une modération.',
      ),
      subheading('Promesses financières trompeuses'),
      ...text(
        'Ne prétendez pas disposer d’un financement, d’un soutien ou d’une représentation que vous n’avez pas. Ne promettez pas de rendement garanti, ne sollicitez pas d’argent pendant une rencontre et ne faites pas la promotion de montages d’investissement ou de gains rapides.',
      ),
      subheading('Fraude au recrutement'),
      ...text(
        'Ne publiez pas de faux emplois, ne demandez pas aux candidats de payer une formation ou un emploi garanti et ne collectez pas de documents d’identité sous un faux prétexte de recrutement.',
      ),
      subheading('Collecte ou publication de données'),
      ...text(
        'La liste des inscrits est remise à l’hôte uniquement pour organiser la rencontre. Ne la copiez pas, ne l’exportez pas, ne la vendez pas et ne l’ajoutez pas à une base de prospection. Ne publiez pas le téléphone, l’adresse, le lieu de travail ou l’image d’un autre membre sans autorisation.',
      ),
      subheading('Harcèlement, discrimination et menaces'),
      ...text(
        'Ne harcelez pas, ne menacez pas et n’insultez pas. La discrimination fondée sur le genre, l’origine, la langue, la religion, le handicap ou tout autre motif n’est pas acceptée. Le comportement pendant la rencontre compte autant que celui sur la plateforme.',
      ),
      subheading('Contenu et services illégaux'),
      ...text(
        'Ne publiez pas de contenu contraire au droit algérien, ne faites pas la promotion de biens ou services interdits et ne partagez pas de lien malveillant ou de page d’hameçonnage.',
      ),
      subheading('Droits des tiers'),
      ...text(
        'Ne téléversez pas un logo, une image ou un texte que vous n’avez pas le droit d’utiliser. Le droit d’auteur appartient à son créateur et est protégé par la loi.',
      ),
    ]),
    section(
      'Organisateurs',
      text(
        'Les personnes qui publient une rencontre ont des obligations supplémentaires concernant l’exactitude, les autorisations, les échanges avec les inscrits, les changements et l’annulation. Elles sont détaillées dans les [Conditions des organisateurs](/organizers).',
      ),
    ),
    section('Application des règles', [
      ...text(
        'Après un signalement ou la détection d’une violation, nous pouvons choisir parmi les mesures suivantes :',
      ),
      list([
        '**Avertir** en expliquant le problème et ce qui est attendu ;',
        '**Retirer ou masquer le contenu** ;',
        '**Dépublier la rencontre** ;',
        '**Limiter une fonctionnalité** pendant une période ;',
        '**Suspendre le compte** ;',
        '**Fermer définitivement le compte**.',
      ]),
      ...text(
        'Nous ne promettons pas un ordre fixe. Pour une violation mineure ou accidentelle, un avertissement peut suffire ; fraude, usurpation, menaces et risques de sécurité peuvent nécessiter une action immédiate. Nous tenons compte du contexte, de la répétition, du préjudice et de la correction apportée.',
      ),
    ]),
    section(
      'Signaler un problème',
      text(
        'Écrivez à **contact@founders.coffee** avec le lien et une description précise. Les signalements sont confidentiels et nous ne révélons pas l’identité du signalant à la personne visée. En cas de danger immédiat, contactez d’abord les autorités compétentes : nous sommes une plateforme numérique sans intervention sur le terrain.',
      ),
    ),
    section(
      'Si une décision vous semble erronée',
      text(
        'Contactez-nous et expliquez la situation. Nous réexaminons les décisions et corrigeons celles qui ont été prises par erreur. La modération est un travail humain et peut se tromper.',
      ),
    ),
  ],
  '18 septembre 2026',
);
