import { Fragment } from 'react';

import type { chat } from '@founders-coffee/domain';

type ChatTextProps = {
  segments: readonly chat.ChatBodySegment[];
};

export const ChatText = ({ segments }: ChatTextProps) => (
  <bdi className="wrap-anywhere">
    {segments.map((segment, index) =>
      segment.kind === 'link' ? (
        <a
          key={index}
          href={segment.href}
          target="_blank"
          rel="noopener noreferrer nofollow ugc"
          className="link"
        >
          {segment.text}
        </a>
      ) : (
        <Fragment key={index}>{segment.text}</Fragment>
      ),
    )}
  </bdi>
);
