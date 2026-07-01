"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Smile, Paperclip, Mic, Send } from "lucide-react";
import type { Message, Conversation } from "@/lib/types";

interface Props {
  conversation: Conversation;
  inputValue: string;
  setInputValue: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  replyTo: Message | null;
  onCancelReply: () => void;
  onSend: () => void;
  onToggleAttach: () => void;
  onSendTemplate: () => void;
  isSessionActive: boolean;
}

export default function ChatFooter({
  conversation,
  inputValue,
  setInputValue,
  inputRef,
  replyTo,
  onCancelReply,
  onSend,
  onToggleAttach,
  onSendTemplate,
  isSessionActive,
}: Props) {
  if (conversation.isBlocked) {
    return (
      <div className="relative z-20 flex-shrink-0 bg-zinc-900 border-t border-zinc-800 px-4 py-4.5 text-center text-sm text-zinc-400 font-bold flex items-center justify-center gap-2 select-none">
        <span>This contact is blocked. Unblock them to resume conversation.</span>
      </div>
    );
  }

  useEffect(() => {
    if (inputValue === "" && inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  }, [inputValue, inputRef]);

  return (
    <div className="relative z-20 flex-shrink-0 bg-zinc-900 border-t border-zinc-800">
      {/* REPLY PREVIEW */}
      {replyTo && (
        <div className="px-4 py-2 bg-zinc-850 border-l-4 border-cyan-600 flex items-center justify-between text-zinc-100">
          <div className="text-xs min-w-0">
            <div className="font-bold">
              {replyTo.sender === "executive"
                ? "You"
                : conversation.memberName}
            </div>
            <div className="truncate max-w-xs text-zinc-400">
              {replyTo.text || "Media message"}
            </div>
          </div>
 
          <button
            onClick={onCancelReply}
            className="text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
 
      {/* INPUT ROW */}
      <div className="px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          {/* LEFT ICONS */}
          <div className="flex items-center gap-1">
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              className="p-2 rounded-xl hover:bg-zinc-850 text-zinc-400 hover:text-zinc-100 transition-all cursor-pointer"
            >
              <Smile className="w-5 h-5" />
            </motion.button>
 
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={onToggleAttach}
              className="p-2 rounded-xl hover:bg-zinc-850 text-zinc-400 hover:text-zinc-100 transition-all cursor-pointer"
            >
              <Paperclip className="w-5 h-5" />
            </motion.button>
          </div>

          {/* TEXT INPUT */}
          <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 transition-all focus-within:border-cyan-500/40 focus-within:ring-1 focus-within:ring-cyan-500/20 flex items-center">
            <textarea
              ref={inputRef as any}
              disabled={!isSessionActive}
              placeholder={
                isSessionActive ? "Type a message (Shift+Enter for newline)" : "Template message required"
              }
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
              }}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing &&
                  isSessionActive
                ) {
                  e.preventDefault();
                  onSend();
                  e.currentTarget.style.height = 'auto'; // Reset height on send
                }
              }}
              className="bg-transparent text-sm outline-none w-full placeholder:text-zinc-600 text-zinc-100 resize-none overflow-y-auto"
              rows={1}
              style={{ minHeight: '24px', maxHeight: '150px' }}
            />
          </div>
 
          {/* RIGHT ACTION */}
          {!isSessionActive ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={onSendTemplate}
              className="bg-cyan-600 hover:bg-cyan-500 transition-all text-white px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap cursor-pointer"
            >
              <span className="hidden sm:inline">Send Template</span>
              <span className="sm:hidden">Template</span>
            </motion.button>
          ) : inputValue.trim() ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={onSend}
              className="bg-cyan-600 hover:bg-cyan-500 transition-all text-white p-2.5 rounded-xl cursor-pointer flex items-center justify-center"
            >
              <Send className="w-5 h-5" />
            </motion.button>
          ) : (
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              className="p-2 rounded-xl hover:bg-zinc-850 text-zinc-400 hover:text-zinc-100 transition-all cursor-pointer"
            >
              <Mic className="w-5 h-5" />
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
