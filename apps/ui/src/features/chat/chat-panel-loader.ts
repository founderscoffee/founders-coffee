/**
 * The chat panel's conversation, as its own chunk: the meetup page does not carry the code of a
 * panel most of its readers never open.
 */
export const loadChatConversation = () =>
  import('./components/ChatConversation');

/** Fetch the conversation's code ahead of a click; a failure is left for the click to meet. */
export const preloadChatConversation = (): void => {
  loadChatConversation().catch(() => undefined);
};
