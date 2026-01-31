import { useEffect, useRef } from 'react';
import type { UIMessage } from '@ai-sdk/react';

export function useAutoResume({
  autoResume,
  initialMessages,
  resumeStream,
  setMessages,
}: {
  autoResume: boolean;
  initialMessages: UIMessage[];
  resumeStream: () => void;
  setMessages: (messages: UIMessage[]) => void;
}) {
  const hasResumed = useRef(false);

  useEffect(() => {
    if (!autoResume || hasResumed.current) return;
    if (initialMessages.length === 0) return;

    const lastMessage = initialMessages.at(-1);
    if (!lastMessage) return;

    // If the last message is from the user, the assistant hasn't responded yet
    // Try to resume the stream
    if (lastMessage.role === 'user') {
      hasResumed.current = true;
      setMessages(initialMessages);
      resumeStream();
    }
  }, [autoResume, initialMessages, resumeStream, setMessages]);
}
