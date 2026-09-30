import { SendHorizontal } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import {
  chat_composer_label,
  chat_composer_placeholder,
  chat_send,
  type Locale,
} from '@founders-coffee/i18n';

import { CHAT_MESSAGE_MAX_LENGTH, sendableBody } from '../chat-items';

type ChatComposerProps = {
  locale: Locale;
  isSending: boolean;
  onSend: (draft: string) => boolean;
};

export const ChatComposer = ({
  locale,
  isSending,
  onSend,
}: ChatComposerProps) => {
  const [draft, setDraft] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (onSend(draft)) setDraft('');
  };

  return (
    <form
      onSubmit={submit}
      className="border-t border-base-300 bg-base-100 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex items-center gap-2 rounded-full border border-base-300 bg-base-200 p-1.5">
        <input
          type="text"
          dir="auto"
          value={draft}
          maxLength={CHAT_MESSAGE_MAX_LENGTH}
          autoComplete="off"
          enterKeyHint="send"
          aria-label={chat_composer_label({}, { locale })}
          placeholder={chat_composer_placeholder({}, { locale })}
          className="input input-sm md:input-md min-w-0 flex-1 border-0 bg-transparent shadow-none focus:outline-none"
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          type="submit"
          className="btn btn-primary btn-xs sm:btn-sm md:btn-md shrink-0 rounded-full"
          disabled={isSending || sendableBody(draft) === null}
          onPointerDown={(event) => event.preventDefault()}
        >
          {isSending ? (
            <span
              className="loading loading-spinner loading-xs"
              aria-hidden="true"
            />
          ) : (
            <SendHorizontal
              className="size-4 rtl:-scale-x-100"
              aria-hidden="true"
            />
          )}
          {chat_send({}, { locale })}
        </button>
      </div>
    </form>
  );
};
