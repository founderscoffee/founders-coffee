import { telegram_host_intro, type Locale } from '@founders-coffee/i18n';

export const TelegramBotIntro = ({
  locale,
  botHandle,
}: {
  locale: Locale;
  botHandle: string;
}) => {
  const [beforeBot, afterBot = ''] = telegram_host_intro(
    { bot: botHandle },
    { locale },
  ).split(botHandle);

  return (
    <p className="text-body-sm text-neutral">
      {beforeBot}
      <a
        className="link link-hover"
        href={`https://t.me/${botHandle.replace(/^@/, '')}`}
        target="_blank"
        rel="noopener noreferrer"
        dir="ltr"
      >
        <bdi>{botHandle}</bdi>
      </a>
      {afterBot}
    </p>
  );
};
