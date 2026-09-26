import { list, page, section, text } from './legal-translated';
import type { CompanyPageContent } from './types';

export const organizersFrench: CompanyPageContent = page(
  'Conditions des organisateurs',
  'Vos responsabilités pour publier une rencontre : informations exactes, lieu, sécurité, liste des inscrits et annulation.',
  [
    section(
      'Quand ces conditions s’appliquent',
      text(
        'Elles s’appliquent lorsque vous publiez une rencontre sur Founders Coffee et complètent les [Conditions d’utilisation](/terms) et les [Règles de la communauté](/community). Organiser ici est simple : choisir un café, une heure et un sujet. Cela implique toutefois les responsabilités ci-dessous.',
      ),
    ),
    section(
      'Vous êtes l’organisateur',
      text(
        'En publiant, vous ou l’organisation que vous représentez devenez l’**organisateur**. Nous fournissons la plateforme, mais nous n’organisons pas la rencontre, ne vous représentons pas auprès des inscrits et ne répondons pas de vos promesses. La relation avec les personnes inscrites vous revient.',
      ),
    ),
    section(
      'Informations exactes',
      text(
        'Le titre, le sujet, le nom et l’adresse du lieu, la date, l’heure et la langue de discussion doivent être exacts dès la publication. Mettez la page à jour rapidement en cas de changement. Si la rencontre vise un public précis, dites-le clairement ; une sélection transparente est acceptable, dissimuler le véritable objectif ne l’est pas.',
      ),
    ),
    section(
      'Lieu et autorisations',
      text(
        'Le choix du lieu et l’accord de son propriétaire sont votre responsabilité. Vérifiez que vous pouvez l’utiliser à cette heure et que la fréquentation prévue est acceptable. Respectez les règles du lieu et indiquez aux inscrits ce qu’ils doivent savoir. Si la réglementation algérienne exige une autorisation ou une déclaration, obtenez-la.',
      ),
    ),
    section(
      'Sécurité des participants',
      text(
        'Vous dirigez la séance. En cas de comportement abusif ou dangereux, avertissez la personne, demandez-lui de partir ou mettez fin à la rencontre si nécessaire. Contactez les autorités pour les incidents graves, puis informez-nous afin que nous puissions agir sur le compte.',
      ),
    ),
    section(
      'Liste des inscrits',
      text(
        'Nous vous montrons les noms des personnes inscrites pour vous permettre de savoir qui attendre. **La liste sert uniquement à organiser cette rencontre.** Ne la copiez pas, ne l’exportez pas, ne la partagez pas, ne l’ajoutez pas à une base et ne l’utilisez pas pour un contact sans rapport. Si vous collectez d’autres informations sur place, dites aux personnes quoi et pourquoi ; vous devenez alors responsable de ces données selon la loi 18-07.',
      ),
    ),
    section(
      'Enregistrer la présence',
      text(
        'Après la rencontre, indiquez-nous si elle a eu lieu, qui était présent, qui était absent et combien de personnes sont venues sans inscription. Enregistrez ce qui s’est réellement passé. Les personnes peuvent corriger une présence inexacte et votre note privée n’est pas montrée aux membres.',
      ),
    ),
    section(
      'Contacter les participants',
      text(
        'Nous envoyons les confirmations, rappels, changements et annulations via les messages standards de la plateforme. Vous ne pouvez pas envoyer de diffusion personnalisée depuis la plateforme. Placez l’information dans la description et n’utilisez jamais la liste pour commercialiser un produit ou un service sans consentement préalable.',
      ),
    ),
    section(
      'Changement, report et annulation',
      text(
        '**Changement :** mettez la page à jour immédiatement et nous prévenons les inscrits. **Report :** publiez la nouvelle date ; sans remplacement, annulez et publiez plus tard une nouvelle rencontre. **Annulation :** annulez sur la plateforme dès que vous le savez et indiquez brièvement pourquoi. Les rencontres gratuites ne créent pas d’obligation financière, mais des annulations tardives répétées nuisent à la confiance et peuvent limiter votre droit de publier.',
      ),
    ),
    section(
      'Contenu téléversé',
      text(
        'Les textes, images et logos de la page doivent vous appartenir ou être utilisables sous licence. En utilisant la plateforme, vous nous accordez une licence limitée pour les afficher sur la page de la rencontre et les pages de découverte nécessaires au fonctionnement du service.',
      ),
    ),
    section(
      'Photos pendant une rencontre',
      text(
        'Si vous prévoyez de photographier ou filmer, indiquez-le dans la description et au début de la rencontre, et respectez toute personne qui ne souhaite pas apparaître. Publier l’image d’une personne sans son accord est une question de droits.',
      ),
    ),
    section('Rencontres refusées', [
      ...text(
        'Nous ne publions pas les rencontres contraires au droit algérien ou dont le but est :',
      ),
      list([
        'collecter de l’argent ou promouvoir des placements, monnaies ou rendements garantis ;',
        'vendre des biens ou services dont la promotion est interdite ;',
        'faire payer les candidats pour un recrutement ;',
        'dissimuler une offre commerciale sous une rencontre communautaire ;',
        'porter atteinte à l’ordre public ou aux bonnes mœurs.',
      ]),
    ]),
    section(
      'Rencontres payantes',
      text(
        'Toutes les rencontres sont actuellement gratuites et la plateforme ne collecte aucun paiement. Ne demandez pas aux inscrits de payer en dehors de la plateforme. Si des rencontres payantes sont introduites plus tard, les règles de billetterie, d’annulation et de remboursement s’appliqueront après leur annonce.',
      ),
    ),
    section(
      'En cas de problème',
      text(
        'Écrivez à **contact@founders.coffee** pour un membre abusif, une rencontre suspecte, un litige avec un lieu ou toute situation nécessitant notre intervention. Nous prenons les signalements des organisateurs au sérieux.',
      ),
    ),
    section(
      'Nos mesures possibles',
      text(
        'Nous pouvons dépublier une rencontre, limiter la publication ou suspendre un compte qui viole ces conditions, les Règles de la communauté ou la loi. Les décisions sont liées au marché où la violation a eu lieu ; une restriction dans une ville ou un pays ne s’étend pas automatiquement ailleurs. Contactez-nous si vous pensez qu’une décision est erronée et nous la réexaminerons.',
      ),
    ),
  ],
  '18 septembre 2026',
);
