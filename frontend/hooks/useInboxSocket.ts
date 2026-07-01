"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import api from "@/lib/api";
import { connectSocket, getSocket } from "@/lib/socket";
import type { Conversation } from "@/lib/types";

interface UseInboxSocketProps {
  selectedConversation?: string;
  readSentRef: React.MutableRefObject<Set<string>>;
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  mapApiConversation: (c: any) => Conversation;
}

export function useInboxSocket({
  selectedConversation,
  readSentRef,
  setConversations,
  mapApiConversation,
}: UseInboxSocketProps) {
  const { gymSlug } = useParams() as { gymSlug: string };

  useEffect(() => {
    connectSocket();
    const socket = getSocket();

    const refreshInbox = async () => {
      try {
        if (!gymSlug) return;
        const res = await api.get(`/api/dashboard/${gymSlug}/inbox`);
        const mapped = res.data.map(mapApiConversation);

        setConversations(() =>
          mapped.map((conv: Conversation) => {
            // Keep unread = 0 for open conversation
            if (
              conv.id === selectedConversation &&
              readSentRef.current.has(conv.id)
            ) {
              return { ...conv, unreadCount: 0, hasUnread: false };
            }
            return conv;
          })
        );
      } catch (err) {
        console.error("Inbox refresh failed", err);
      }
    };

    const handleMemberUpdate = (member: any) => {
      if (!member?.id) return;
      setConversations((prev) =>
        prev.map((c) =>
          c.id === member.id
            ? {
              ...c,
              callPermissionStatus: member.callPermissionStatus || c.callPermissionStatus,
              isBlocked: member.blockedAt ? true : false,
            }
            : c
        )
      );
    };

    socket.on("inbox:update", refreshInbox);
    socket.on("connect", refreshInbox);
    socket.on("member:updated", handleMemberUpdate);

    return () => {
      socket.off("inbox:update", refreshInbox);
      socket.off("connect", refreshInbox);
      socket.off("member:updated", handleMemberUpdate);
    };
  }, [selectedConversation, readSentRef, setConversations, mapApiConversation, gymSlug]);
}
