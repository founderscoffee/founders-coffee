import { list, section, table, text, translatedPage } from './legal-translated';
import type { CompanyPageContent } from './types';

export const legalFrench: CompanyPageContent = translatedPage(
  'fr',
  'Mentions légales',
  'Qui exploite Founders Coffee, comment nous contacter, où les données sont traitées et quel est le statut juridique actuel de la plateforme.',
  [
    section('Qui exploite la plateforme', [
      ...text(
        'Founders Coffee est aujourd’hui une **version pilote gratuite** en phase de test du marché. Aucune société n’a été constituée derrière elle, et rien n’y est vendu. Elle est exploitée par une personne physique en son nom personnel, dont voici les coordonnées :',
      ),
      table(
        ['Élément', 'Information'],
        [
          ['Exploitant', '**Amine Yagoub**'],
          [
            'Statut',
            'Personne physique (aucune entité juridique constituée à la date de dernière mise à jour de cette page)',
          ],
          [
            'Adresse postale',
            'Communiquée sur demande à l’adresse e-mail ci-dessous',
          ],
          [
            'Registre du commerce',
            'Non applicable : aucune immatriculation commerciale, et aucune transaction payante n’a lieu sur la plateforme',
          ],
          [
            'Numéro d’identification fiscale (NIF)',
            'Non applicable pour la même raison',
          ],
          [
            'Numéro d’identification statistique (NIS)',
            'Non applicable pour la même raison',
          ],
          ['Directeur de la publication', 'L’exploitant lui-même'],
        ],
      ),
      ...text(
        'Nous le précisons délibérément, et non après coup : vous avez le droit de savoir avec qui vous contractez lorsque vous créez un compte. Nos obligations envers vous au titre des [Conditions d’utilisation](/terms) et de la [Politique de confidentialité](/privacy) restent entières, et l’exploitant les assume personnellement.',
      ),
    ]),
    section('Si une société est créée plus tard', [
      ...text(
        'Si le pilote réussit, nous constituerons l’entité juridique qui exploitera la plateforme et ouvrira des espaces Founders Coffee. À ce moment-là :',
      ),
      list([
        'cette page sera mise à jour avec les informations complètes de la société ;',
        'la relation contractuelle entre vous et l’exploitant sera transférée à la société, conformément à la section 15 des [Conditions d’utilisation](/terms) ;',
        'la désignation du **responsable du traitement** dans la [Politique de confidentialité](/privacy) changera en conséquence, et nous vous en informerons avant sa prise d’effet, car il s’agit d’un changement substantiel de l’identité de la personne qui détient vos données.',
      ]),
    ]),
    section('Contact', [
      table(
        ['Objet', 'Canal'],
        [
          ['Questions générales et assistance', '**contact@founders.coffee**'],
          [
            'Demandes relatives à la confidentialité et exercice des droits',
            '**contact@founders.coffee**',
          ],
          [
            'Signalements de contenus et de violations',
            '**contact@founders.coffee**',
          ],
        ],
      ),
    ]),
    section(
      'Protection des données personnelles',
      text(
        'Le responsable du traitement de vos données est l’exploitant indiqué ci-dessus, en son nom personnel, et non une société. L’absence de société ne retire rien à ses obligations au titre de la loi n° 18-07 : la définition légale du responsable du traitement couvre la personne physique comme la personne morale.',
        'Pour tout ce qui concerne vos données personnelles, et pour exercer vos droits d’accès, de rectification, d’opposition et de suppression : **contact@founders.coffee**.',
        'Vos données sont traitées sur une infrastructure technique située hors d’Algérie. Le détail, et le fondement juridique sur lequel nous nous appuyons, figurent dans la [Politique de confidentialité](/privacy).',
      ),
    ),
    section(
      'Hébergement technique',
      text(
        'La plateforme est hébergée, et ses données traitées, sur une infrastructure cloud distribuée exploitée par des prestataires situés hors d’Algérie. La Politique de confidentialité décrit le rôle de chaque catégorie de prestataires et les données qu’elle reçoit.',
        'Ce que cela implique pour la protection des données, et le fondement juridique sur lequel nous nous appuyons, est exposé dans la [Politique de confidentialité](/privacy).',
      ),
    ),
    section(
      'Propriété intellectuelle',
      text(
        'Le nom « Founders Coffee », son logo, ainsi que le design et le logiciel de la plateforme sont protégés par l’ordonnance n° 03-05 relative aux droits d’auteur et aux droits voisins, et ne peuvent être utilisés sans autorisation écrite préalable.',
        'Les textes et images publiés par les membres restent la propriété de leurs auteurs, comme le prévoient les [Conditions d’utilisation](/terms).',
      ),
    ),
  ],
  '27 septembre 2026',
);
