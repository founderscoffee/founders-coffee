import { list, section, table, text, translatedPage } from './legal-translated';
import type { CompanyPageContent } from './types';

export const legalFrench: CompanyPageContent = translatedPage(
  'fr',
  'Mentions légales',
  'Qui exploite Founders Coffee, comment nous contacter, où les données sont traitées et quel est le statut juridique actuel de la plateforme.',
  [
    section('Qui exploite la plateforme', [
      ...text(
        'Founders Coffee est actuellement un **pilote gratuit** destiné à tester le marché. Aucune société n’a été constituée et rien n’est vendu. La plateforme est exploitée par une personne physique en son nom personnel :',
      ),
      table(
        ['Élément', 'Information'],
        [
          ['Exploitant', '**Amine Yagoub**'],
          [
            'Statut',
            'Personne physique ; aucune société constituée à la dernière mise à jour',
          ],
          [
            'Adresse postale',
            'Communiquée sur demande à l’adresse e-mail ci-dessous',
          ],
          [
            'Registre de commerce',
            'Non applicable : aucun registre commercial et aucune transaction payante',
          ],
          [
            'Numéro d’identification fiscale (NIF)',
            'Non applicable pour la même raison',
          ],
          [
            'Numéro d’identification statistique (NIS)',
            'Non applicable pour la même raison',
          ],
          ['Éditeur', 'L’exploitant'],
        ],
      ),
      ...text(
        'Vous avez le droit de savoir avec qui vous contractez en créant un compte. Les obligations des [Conditions d’utilisation](/terms) et de la [Politique de confidentialité](/privacy) restent celles de l’exploitant.',
      ),
    ]),
    section('Si une société est créée plus tard', [
      ...text(
        'Si le pilote réussit, nous constituerons la société qui exploitera la plateforme et ses espaces Founders Coffee. Alors :',
      ),
      list([
        'cette page sera mise à jour avec les informations complètes de la société ;',
        'la relation contractuelle existante lui sera transférée selon la section 16 des [Conditions d’utilisation](/terms) ;',
        'les informations du responsable du traitement de la [Politique de confidentialité](/privacy) changeront.',
      ]),
      ...text(
        'Nous vous préviendrons avant l’entrée en vigueur du changement, car il modifie l’identité qui détient vos données.',
      ),
    ]),
    section('Contact', [
      table(
        ['Objet', 'Canal'],
        [
          ['Questions générales et assistance', '**contact@founders.coffee**'],
          [
            'Demandes de confidentialité et droits',
            '**contact@founders.coffee**',
          ],
          [
            'Signalements de contenu et modération',
            '**contact@founders.coffee**',
          ],
        ],
      ),
    ]),
    section(
      'Protection des données personnelles',
      text(
        'Le responsable du traitement est la personne physique indiquée ci-dessus, et non une société. La loi 18-07 s’applique aussi à un responsable personne physique. Pour demander l’accès, la correction, l’opposition ou la suppression, écrivez à **contact@founders.coffee**. Les données sont traitées sur une infrastructure située hors d’Algérie ; la [Politique de confidentialité](/privacy) en explique le fondement et les détails.',
      ),
    ),
    section(
      'Hébergement technique',
      text(
        'La plateforme et ses données sont hébergées sur une infrastructure cloud distribuée opérée par des prestataires situés hors d’Algérie. La [Politique de confidentialité](/privacy) décrit chaque catégorie de prestataire, les données reçues et les garanties appliquées.',
      ),
    ),
    section(
      'Propriété intellectuelle',
      text(
        'Le nom « Founders Coffee », le logo, le design et le logiciel de la plateforme sont protégés par l’ordonnance 03-05 relative aux droits d’auteur et droits voisins et ne peuvent être utilisés sans autorisation écrite préalable. Les textes et images des membres restent les leurs selon les [Conditions d’utilisation](/terms).',
      ),
    ),
  ],
  '18 septembre 2026',
);
