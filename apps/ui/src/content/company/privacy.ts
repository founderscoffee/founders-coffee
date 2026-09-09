import type { Locale } from '@founders-coffee/i18n';

import { CONTACT_EMAIL, PRIVACY_EMAIL } from './contact';
import type { CompanyPageContent } from './types';

export const privacyContent: Record<Locale, CompanyPageContent> = {
  en: {
    title: 'Privacy',
    description:
      'How founders.coffee collects, uses, and protects your personal data.',
    updated: '9 September 2026',
    sections: [
      {
        heading: 'Who we are',
        paragraphs: [
          `This notice describes how founders.coffee (“we”) processes personal data when you use founders.coffee. For privacy requests, contact ${PRIVACY_EMAIL}. General inquiries: ${CONTACT_EMAIL}.`,
          'We are an early-stage product. Legal entity details will be updated here when incorporation paperwork is finalized.',
        ],
      },
      {
        heading: 'Data we collect',
        paragraphs: [
          'Account data: email address or verified phone number, public display name, account role, and profile details you choose to provide. Optional profile details are private unless you choose to publish them. We no longer ask for or use your place of residence; legacy residence fields are awaiting scheduled removal. Meetup locations remain part of meetup records.',
          'Usage data: meetups you host or join, waitlist entries, and basic technical logs needed to run and secure the service.',
          'Device data: session cookies, locale preference, and security signals from bot protection.',
        ],
      },
      {
        heading: 'Why we process data',
        paragraphs: [
          'To create and secure your account (email one-time codes), show relevant meetups, enable hosting, send transactional email, and prevent abuse.',
          'Legal bases typically include performing our contract with you, legitimate interests in securing the service, and consent where required (for example optional push notifications).',
        ],
      },
      {
        heading: 'Processors we use',
        paragraphs: [
          'Cloudflare (Workers hosting, D1 database, email delivery, Turnstile bot protection, security logs).',
          'Mapbox (café map and place search when you host a meetup).',
          'Firebase Cloud Messaging (optional web push, only if you enable notifications).',
          'Better Auth (authentication sessions stored in our database).',
        ],
      },
      {
        heading: 'Retention & your rights',
        paragraphs: [
          `We keep account and meetup data while your account is active and as needed to operate the community. You may request access, correction, deletion, or export by emailing ${PRIVACY_EMAIL}.`,
          'You may also lodge a complaint with your local data-protection authority if applicable.',
        ],
      },
      {
        heading: 'International transfers',
        paragraphs: [
          'Our infrastructure runs on Cloudflare and other cloud providers that may process data in multiple regions. Where required, we rely on appropriate safeguards used by those providers.',
        ],
      },
      {
        heading: 'Children',
        paragraphs: [
          'founders.coffee is intended for adults participating in professional communities. We do not knowingly collect data from children.',
        ],
      },
      {
        heading: 'Updates',
        paragraphs: [
          'We may update this notice as the product evolves. The “Last updated” date at the top of this page will change when we do.',
        ],
      },
    ],
  },
  ar: {
    title: 'الخصوصية',
    description: 'كيف يجمع founders.coffee بياناتك الشخصية ويستخدمها ويحميها.',
    updated: '9 سبتمبر 2026',
    sections: [
      {
        heading: 'من نحن',
        paragraphs: [
          `توضح هذه الصفحة كيف يعالج founders.coffee («نحن») البيانات الشخصية عند استخدامك للمنصة. لطلبات الخصوصية: ${PRIVACY_EMAIL}. للاستفسارات العامة: ${CONTACT_EMAIL}.`,
          'نحن منتج في مرحلة مبكرة. سنحدّث بيانات الكيان القانوني هنا عند اكتمال التأسيس.',
        ],
      },
      {
        heading: 'البيانات التي نجمعها',
        paragraphs: [
          'بيانات الحساب: البريد الإلكتروني أو رقم الهاتف الموثّق، الاسم العلني، دور الحساب، وتفاصيل الملف التي تختار إضافتها. تبقى التفاصيل الاختيارية خاصة ما لم تختر نشرها. لم نعد نطلب مكان إقامتك أو نستخدمه؛ الحقول القديمة تنتظر الحذف المجدول. تبقى مواقع اللقاءات ضمن سجلاتها.',
          'بيانات الاستخدام: اللقاءات التي تستضيفها أو تنضم إليها، قائمة الانتظار، وسجلات تقنية أساسية لتشغيل الخدمة وحمايتها.',
          'بيانات الجهاز: ملفات تعريف جلسة، تفضيل اللغة، وإشارات أمان من حماية البوتات.',
        ],
      },
      {
        heading: 'لماذا نعالج البيانات',
        paragraphs: [
          'لإنشاء حسابك وتأمينه (رمز لمرة واحدة عبر البريد)، وعرض اللقاءات المناسبة، وتمكين الاستضافة، وإرسال بريد معاملاتي، ومنع الإساءة.',
          'الأسس القانونية تشمل عادة تنفيذ العقد معك، والمصلحة المشروعة في تأمين الخدمة، والموافقة عند الاقتضاء (مثل إشعارات الدفع الاختيارية).',
        ],
      },
      {
        heading: 'المعالجون الذين نستخدمهم',
        paragraphs: [
          'Cloudflare (الاستضافة، قاعدة D1، البريد، Turnstile، سجلات الأمان).',
          'Mapbox (خريطة المقاهي والبحث عند استضافة لقاء).',
          'Firebase Cloud Messaging (إشعارات الويب الاختيارية إن فعّلتها).',
          'Better Auth (جلسات المصادقة المخزّنة في قاعدتنا).',
        ],
      },
      {
        heading: 'الاحتفاظ وحقوقك',
        paragraphs: [
          `نحتفظ ببيانات الحساب واللقاءات طالما حسابك نشط وكما يلزم لتشغيل المجتمع. يمكنك طلب الوصول أو التصحيح أو الحذف أو التصدير عبر ${PRIVACY_EMAIL}.`,
          'يمكنك أيضاً تقديم شكوى إلى هيئة حماية البيانات المحلية إن وُجدت.',
        ],
      },
      {
        heading: 'النقل الدولي',
        paragraphs: [
          'بنيتنا التحتية تعمل عبر Cloudflare ومزوّدي سحابة قد يعالجون البيانات في مناطق متعددة. عند الاقتضاء نعتمد على الضمانات المناسبة التي يوفّرها هؤلاء المزوّدون.',
        ],
      },
      {
        heading: 'الأطفال',
        paragraphs: [
          'founders.coffee موجّه للبالغين المشاركين في مجتمعات مهنية. لا نجمع بيانات الأطفال عن علم.',
        ],
      },
      {
        heading: 'التحديثات',
        paragraphs: [
          'قد نحدّث هذه الصفحة مع تطور المنتج. يتغيّر تاريخ «آخر تحديث» في أعلى الصفحة عند كل تعديل.',
        ],
      },
    ],
  },
  fr: {
    title: 'Confidentialité',
    description:
      'Comment founders.coffee collecte, utilise et protège vos données personnelles.',
    updated: '9 septembre 2026',
    sections: [
      {
        heading: 'Qui nous sommes',
        paragraphs: [
          `Cette notice décrit comment founders.coffee (« nous ») traite les données personnelles lorsque vous utilisez le service. Pour les demandes de confidentialité : ${PRIVACY_EMAIL}. Contact général : ${CONTACT_EMAIL}.`,
          'Nous sommes un produit en phase de démarrage. Les détails de l’entité légale seront mis à jour ici une fois l’immatriculation finalisée.',
        ],
      },
      {
        heading: 'Données collectées',
        paragraphs: [
          'Données de compte : e-mail ou téléphone vérifié, nom public, rôle du compte et détails de profil fournis volontairement. Les détails facultatifs restent privés sauf si vous choisissez de les publier. Nous ne demandons ni n’utilisons plus votre lieu de résidence ; les anciens champs attendent leur suppression planifiée. Les lieux des rencontres restent dans leurs dossiers.',
          'Données d’usage : meetups que vous organisez ou rejoignez, listes d’attente, et journaux techniques nécessaires au service.',
          'Données appareil : cookies de session, préférence de langue, et signaux de sécurité anti-bots.',
        ],
      },
      {
        heading: 'Finalités',
        paragraphs: [
          'Créer et sécuriser votre compte (codes e-mail à usage unique), afficher des meetups pertinents, permettre l’organisation, envoyer des e-mails transactionnels, et prévenir les abus.',
          'Les bases légales incluent généralement l’exécution du contrat, l’intérêt légitime à sécuriser le service, et le consentement le cas échéant (notifications push optionnelles).',
        ],
      },
      {
        heading: 'Sous-traitants',
        paragraphs: [
          'Cloudflare (hébergement Workers, base D1, e-mail, Turnstile, journaux de sécurité).',
          'Mapbox (carte et recherche de cafés lors de l’organisation).',
          'Firebase Cloud Messaging (push web optionnel si vous l’activez).',
          'Better Auth (sessions d’authentification stockées dans notre base).',
        ],
      },
      {
        heading: 'Conservation & droits',
        paragraphs: [
          `Nous conservons les données de compte et de meetup tant que votre compte est actif et selon les besoins de la communauté. Vous pouvez demander l’accès, la rectification, la suppression ou l’export via ${PRIVACY_EMAIL}.`,
          'Vous pouvez aussi déposer une plainte auprès de votre autorité locale de protection des données le cas échéant.',
        ],
      },
      {
        heading: 'Transferts internationaux',
        paragraphs: [
          'Notre infrastructure repose sur Cloudflare et d’autres fournisseurs cloud susceptibles de traiter des données dans plusieurs régions. Le cas échéant, nous nous appuyons sur les garanties appropriées de ces fournisseurs.',
        ],
      },
      {
        heading: 'Enfants',
        paragraphs: [
          'founders.coffee s’adresse aux adultes participant à des communautés professionnelles. Nous ne collectons pas sciemment de données d’enfants.',
        ],
      },
      {
        heading: 'Mises à jour',
        paragraphs: [
          'Nous pouvons mettre à jour cette notice. La date « Dernière mise à jour » en haut de page changera alors.',
        ],
      },
    ],
  },
};
