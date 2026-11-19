import React, { useState } from "react";
import { GeminiChatView, ChatMessage } from "./GeminiChatView";

export function ChatPageExample() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const handleSendMessage = (text: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
  };

  return (
    <div className="h-screen w-full bg-black flex items-center justify-center">
      <GeminiChatView
        title="Daj znać czy to spoko"
        messages={messages.length > 0 ? messages : undefined}
        onSendMessage={handleSendMessage}
        onClose={() => console.log("Close clicked")}
        onMenuClick={() => console.log("Menu clicked")}
      />
    </div>
  );
}
