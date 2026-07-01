"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams, usePathname } from "next/navigation";
import api from "@/lib/api";
import { processMedia } from "@/lib/mediaProcessor";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquareIcon,
  Check,
  CheckCheck,
  AlertCircle,
} from "lucide-react";
import { toast } from "react-toastify";
import type {
  Message,
  Template,
  Conversation,
} from "@/lib/types";
import ChatMessages from "@/components/inbox/chatMessages";
import ConversationList from "@/components/inbox/conversationList";
import ChatHeader from "@/components/inbox/chatHeader";
import SessionBanner from "@/components/inbox/sessionBanner";
import ChatFooter from "@/components/inbox/chatFooter";
import ActionMenu from "@/components/inbox/actionMenu";
import AttachMenu from "@/components/inbox/attachMenu";
import MediaModal from "@/components/inbox/media/modal";
import ImagePreview from "@/components/inbox/imagePreview";
import CallModal from "@/components/inbox/callModal";
import { useChatSocket } from "@/hooks/useChatSocket";
import { useReadReceipts } from "@/hooks/useReadReceipts";
import { useInboxSocket } from "@/hooks/useInboxSocket";

/* =======================
   MAPPERS
   ======================= */
const mapApiConversation = (c: any): Conversation => {
  const unreadCount = c.unreadCount || 0;

  return {
    id: c.id,
    memberName: (() => {
      const name = c.name;
      const whatsapp = c.whatsappName;
      const phone = c.phone;
      if (!name) return whatsapp || phone;
      const cleanName = name.replace(/[+\-\s()]/g, "");
      const isPhoneOnly = /^\d+$/.test(cleanName);
      if (isPhoneOnly && whatsapp) {
        return whatsapp;
      }
      return name;
    })(),
    phone: c.phone,
    lastMessage: c.lastMessage ? c.lastMessage.content : "",
    lastActivity: c.lastMessage
      ? new Date(c.lastMessage.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
      : new Date(c.lastMessageAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    lastMessageDirection: c.lastMessage?.direction,
    lastMessageStatus: c.lastMessage?.status,
    unreadCount,
    hasUnread: unreadCount > 0,
    sessionStarted: c.sessionStarted ?? false,
    sessionActive: c.sessionActive ?? false,
    sessionExpiresAt: c.sessionExpiresAt ?? null,
    templateRequired: c.sessionActive === false,
    isBlocked: !!c.isBlocked,
    isMember: c.isMember ?? false,
    planName: c.planName ?? null,
    callPermissionStatus: c.callPermissionStatus || "UNKNOWN",
    callPermissionUpdatedAt: c.callPermissionUpdatedAt || null,
    callPermissionVerifiedAt: c.callPermissionVerifiedAt || null,
  };
};

// Map template DB data structure to frontend representation
const mapDbTemplateToFrontend = (dbTpl: any): Template => {
  const components = Array.isArray(dbTpl.components) ? dbTpl.components : [];
  const headerComp = components.find((c: any) => c.type === "HEADER");
  const bodyComp = components.find((c: any) => c.type === "BODY");
  const footerComp = components.find((c: any) => c.type === "FOOTER");
  const buttonsComp = components.find((c: any) => c.type === "BUTTONS");

  let buttons: any[] = [];
  if (buttonsComp && Array.isArray(buttonsComp.buttons)) {
    buttons = buttonsComp.buttons.map((b: any) => ({
      type: b.type, // URL, PHONE_NUMBER, QUICK_REPLY
      text: b.text,
      value: b.url || b.phone_number || undefined,
    }));
  }

  let mediaList: any[] = [];
  if (headerComp && ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerComp.format)) {
    const fileInfo = headerComp.example;
    if (fileInfo) {
      if (fileInfo.local_filename) {
        mediaList.push({
          id: dbTpl.id,
          mediaType: headerComp.format,
          s3Url: `/uploads/templates/${fileInfo.local_filename}`,
          language: dbTpl.language,
        });
      } else if (Array.isArray(fileInfo.header_handle) && fileInfo.header_handle[0]) {
        mediaList.push({
          id: dbTpl.id,
          mediaType: headerComp.format,
          s3Url: fileInfo.header_handle[0],
          language: dbTpl.language,
        });
      }
    }
  }

  return {
    id: dbTpl.id,
    metaTemplateName: dbTpl.templateName,
    displayName: dbTpl.templateName.replace(/_/g, " "),
    category: dbTpl.category,
    templateType: "standard",
    status: dbTpl.status.toLowerCase(),
    languages: [
      {
        language: dbTpl.language,
        body: bodyComp ? bodyComp.text : "",
        headerType: headerComp ? headerComp.format : "NONE",
        headerText: headerComp && headerComp.format === "TEXT" ? headerComp.text : undefined,
        footerText: footerComp ? footerComp.text : undefined,
      }
    ],
    buttons,
    media: mediaList,
  };
};

function ChatArea({
  conversation,
  messages,
  setMessages,
  readSentRef,
  onBack,
  onUpdateConversationStatus,
  onMarkAsRead,
  onToggleBlock,
  onBlockedStatusChange,
}: {
  conversation: Conversation;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  readSentRef: React.MutableRefObject<Set<string>>;
  onBack?: () => void;
  onUpdateConversationStatus?: (
    conversationId: string,
    status: Message["status"],
  ) => void;
  onMarkAsRead?: (conversationId: string) => void;
  onToggleBlock?: (conversationId: string, isBlocked: boolean) => Promise<void>;
  onBlockedStatusChange?: (isBlocked: boolean) => void;
}) {
  const { gymSlug } = useParams() as { gymSlug: string };
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [actionMenu, setActionMenu] = useState<{
    message: Message;
    rect: DOMRect;
  } | null>(null);
  const [remainingTime, setRemainingTime] = useState<string | null>(null);

  // Membership plan assignment states
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  const fetchPlans = async () => {
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/plans`);
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
        if (data.plans?.length > 0) {
          setSelectedPlanId(data.plans[0].id);
        }
      }
    } catch (err) {
      console.error("Error fetching plans:", err);
    }
  };

  useEffect(() => {
    if (isAddMemberOpen) {
      fetchPlans();
    }
  }, [isAddMemberOpen]);

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId) {
      setModalError("Please select a membership plan.");
      return;
    }
    setIsSubmitting(true);
    setModalError("");
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/members/${conversation.id}/memberships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlanId,
          startDate
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Membership assigned successfully!");
        setIsAddMemberOpen(false);
      } else {
        setModalError(data.error || "Failed to assign membership.");
      }
    } catch (err) {
      console.error("Error creating membership:", err);
      setModalError("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const [imagePreview, setImagePreview] = useState<{
    files: File[];
    urls: string[];
    caption: string;
  } | null>(null);
  const [sendingPreview, setSendingPreview] = useState(false);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;

    try {
      const processed = await Promise.all(
        Array.from(e.target.files).map((f) => processMedia(f)),
      );

      const files = processed.map((p) => p.file);
      const urls = files.map((f) => URL.createObjectURL(f));

      setImagePreview({
        files,
        urls,
        caption: "",
      });

      setMediaModal(null);
      e.target.value = "";
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
    }
  };

  const [copied, setCopied] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  type ImageMode = "single" | "bulk";
  const [imageMode, setImageMode] = useState<ImageMode>("single");

  const [mediaModal, setMediaModal] = useState<{
    type: "image" | "video" | "audio" | "document" | "template";
  } | null>(null);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null,
  );
  const [templateVariables, setTemplateVariables] = useState<string[]>([]);
  const [isSendingTemplate, setIsSendingTemplate] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const genericInputRef = useRef<HTMLInputElement | null>(null);
  const isSessionActive = !!conversation.sessionActive;

  useChatSocket({
    conversationId: conversation.id,
    setMessages,
    onUpdateConversationStatus,
    onCustomerMessage: () => {
      if (onMarkAsRead) onMarkAsRead(conversation.id);
      if (document.visibilityState === "visible") {
        readSentRef.current.delete(conversation.id);
      }
    },
    onBlockedStatusChange,
  });

  useReadReceipts({
    conversationId: conversation.id,
    readSentRef,
    onMarkAsRead,
    messagesLength: messages.length,
  });

  useEffect(() => {
    if (mediaModal?.type === "template") {
      api
        .get(`/api/dashboard/${gymSlug}/whatsapp/templates`)
        .then((res) => {
          const approved = res.data.filter(
            (t: any) => t.status === "APPROVED" || t.status === "approved",
          );
          setTemplates(approved.map(mapDbTemplateToFrontend));
        })
        .catch((err) => console.error("Failed to load templates", err));
    }
  }, [mediaModal?.type, gymSlug]);

  const handleSendTemplate = async () => {
    if (!selectedTemplate || isSendingTemplate) return;

    setIsSendingTemplate(true);
    try {
      await api.post(`/api/dashboard/${gymSlug}/inbox/${conversation.id}/send-template`, {
        templateId: selectedTemplate.id,
        bodyVariables: templateVariables.map(
          (v) => v.trim() || "Valued Member",
        ),
      });
      setMediaModal(null);
      setSelectedTemplate(null);
      setTemplateVariables([]);
      toast.success("Template sent successfully!");
    } catch (err: any) {
      console.warn("Failed to send template:", err);
      toast.error(err.message || "Failed to send template");
    } finally {
      setIsSendingTemplate(false);
    }
  };

  const copyMessage = async (message: Message): Promise<boolean> => {
    try {
      if (message.text) {
        await navigator.clipboard.writeText(message.text);
        return true;
      }
      if (message.caption) {
        await navigator.clipboard.writeText(message.caption);
        return true;
      }
      if (message.mediaUrl) {
        await navigator.clipboard.writeText(message.mediaUrl);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const calculateRemainingTime = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return null;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const sendImageFromPreview = async () => {
    if (!imagePreview || sendingPreview) return;

    setSendingPreview(true);
    try {
      for (const file of imagePreview.files) {
        const form = new FormData();
        form.append("file", file);
        if (imagePreview.caption) {
          form.append("caption", imagePreview.caption);
        }

        const res = await fetch(`/api/dashboard/${gymSlug}/inbox/${conversation.id}/send-media`, {
          method: "POST",
          body: form,
        });

        if (!res.ok) {
          let errMsg = "Failed to send media";
          try {
            const errData = await res.json();
            errMsg = errData.error || errData.message || errMsg;
          } catch (e) { }
          throw new Error(errMsg);
        }
      }
      setImagePreview(null);
      toast.success("Media message sent successfully!");
    } catch (err) {
      console.error("Media send failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to send media");
    } finally {
      setSendingPreview(false);
    }
  };

  useEffect(() => {
    if (!conversation.sessionActive || !conversation.sessionExpiresAt) {
      setRemainingTime(null);
      return;
    }
    const update = () =>
      setRemainingTime(calculateRemainingTime(conversation.sessionExpiresAt!));
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [conversation.sessionActive, conversation.sessionExpiresAt]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages]);

  const sendMessage = async () => {
    if (!inputValue.trim() || sending) return;

    const text = inputValue.trim();
    setInputValue("");
    setSending(true);
    setReplyTo(null);
    setMediaModal(null);
    setShowAttachMenu(false);
    setImagePreview(null);

    try {
      await api.post(`/api/dashboard/${gymSlug}/inbox/${conversation.id}/send`, {
        text,
      });
      requestAnimationFrame(() => inputRef.current?.focus());
    } catch (err) {
      console.error("Failed to send message", err);
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (message: Message) => {
    try {
      await api.delete(`/api/dashboard/${gymSlug}/inbox/messages/${message.id}`);
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
      toast.success("Message deleted");
    } catch (err) {
      console.error("Failed to delete message", err);
      toast.error("Failed to delete message");
    }
  };

  const [isCallModalOpen, setIsCallModalOpen] = useState(false);

  return (
    <div className="flex-1 flex flex-col relative h-full overflow-hidden">
      <ChatHeader
        conversation={conversation}
        onBack={onBack}
        onToggleBlock={() => onToggleBlock?.(conversation.id, !!conversation.isBlocked)}
        onAddAsMember={() => setIsAddMemberOpen(true)}
        onCallClick={() => setIsCallModalOpen(true)}
        onRequestCallPermission={async () => {
          try {
            const res = await fetch(`/api/dashboard/${gymSlug}/whatsapp/call/request-permission`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ memberId: conversation.id }),
            });
            if (!res.ok) {
              const data = await res.json();
              throw new Error(data.error || "Failed to request call permission");
            }
            toast.success("Call permission requested!");
          } catch (err: any) {
            console.error("Call permission request error:", err);
            toast.error(err.message || "Failed to request call permission");
          }
        }}
      />

      <SessionBanner
        isSessionActive={isSessionActive}
        remainingTime={remainingTime}
      />

      {/* CALL MODAL */}
      <CallModal
        isOpen={isCallModalOpen}
        onClose={() => setIsCallModalOpen(false)}
        conversationId={conversation.id}
        recipientName={conversation.memberName}
        recipientPhone={conversation.phone}
        gymSlug={gymSlug}
      />

      {/* MESSAGES WRAPPER */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {/* FIXED WHATSAPP BACKGROUND */}
        <div
          className="
            absolute inset-0
            bg-wa-chat-bg
            pointer-events-none
          "
        >
          <div className="absolute inset-0 bg-[url('/chat-bg.png')] bg-repeat bg-center opacity-30 dark:opacity-[0.5]" />
        </div>

        {/* SCROLLABLE MESSAGES */}
        <ChatMessages
          messages={messages}
          conversation={conversation}
          messagesEndRef={messagesEndRef}
          onOpenMenu={(message, rect) => setActionMenu({ message, rect })}
          onReply={(m) => setReplyTo(m)}
          setInputValue={setInputValue}
          inputRef={inputRef}
        />
      </div>

      <ChatFooter
        conversation={conversation}
        inputValue={inputValue}
        setInputValue={setInputValue}
        inputRef={inputRef}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onSend={sendMessage}
        onToggleAttach={() => setShowAttachMenu((v) => !v)}
        onSendTemplate={() => setMediaModal({ type: "template" })}
        isSessionActive={isSessionActive}
      />

      <AttachMenu
        open={showAttachMenu}
        onClose={() => setShowAttachMenu(false)}
        onSelect={(type) => {
          setShowAttachMenu(false);
          setMediaModal({ type });
        }}
      />

      <MediaModal
        mediaModal={mediaModal}
        onClose={() => setMediaModal(null)}
        setMediaModal={setMediaModal}
        /* IMAGE */
        imageMode={imageMode}
        setImageMode={setImageMode}
        imageInputRef={imageInputRef}
        handleImageSelect={handleImageSelect}
        /* FILE */
        genericInputRef={genericInputRef}
        handleGenericFiles={async (files) => {
          try {
            for (const rawFile of Array.from(files)) {
              const { file } = await processMedia(rawFile);
              const form = new FormData();
              form.append("file", file);

              const res = await fetch(`/api/dashboard/${gymSlug}/inbox/${conversation.id}/send-media`, {
                method: "POST",
                body: form,
              });

              if (!res.ok) {
                let errMsg = "Failed to send media";
                try {
                  const errData = await res.json();
                  errMsg = errData.error || errData.message || errMsg;
                } catch (e) { }
                throw new Error(errMsg);
              }
            }
            setMediaModal(null);
            toast.success("Media message sent successfully!");
            genericInputRef.current && (genericInputRef.current.value = "");
          } catch (err) {
            console.error("Failed to send media:", err);
            toast.error(err instanceof Error ? err.message : "Failed to send media");
          }
        }}
        /* TEMPLATE */
        templates={templates}
        selectedTemplate={selectedTemplate}
        setSelectedTemplate={setSelectedTemplate}
        templateVariables={templateVariables}
        setTemplateVariables={setTemplateVariables}
        templateSearch={templateSearch}
        setTemplateSearch={setTemplateSearch}
        isSendingTemplate={isSendingTemplate}
        handleSendTemplate={handleSendTemplate}
      />

      <ActionMenu
        actionMenu={actionMenu}
        onClose={() => setActionMenu(null)}
        onReply={(message) => {
          setReplyTo(message);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        onCopy={async (message) => {
          const success = await copyMessage(message);
          if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }
        }}
        onDelete={handleDeleteMessage}
      />

      {copied && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-black/85 text-white text-sm px-4 py-2 rounded-full shadow-md"
        >
          Copied
        </motion.div>
      )}

      <ImagePreview
        preview={imagePreview}
        sending={sendingPreview}
        onClose={() => setImagePreview(null)}
        onChangeCaption={(caption) =>
          setImagePreview((p) => (p ? { ...p, caption } : p))
        }
        onSend={sendImageFromPreview}
      />

      {isAddMemberOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/65 backdrop-blur-md p-4"
          onClick={() => setIsAddMemberOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-5 text-white"
          >
            <div className="border-b border-zinc-900 pb-3">
              <h3 className="text-base font-extrabold tracking-tight text-zinc-100">
                Activate Gym Membership
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Assign a membership plan for <span className="text-cyan-400 font-bold">{conversation.memberName}</span>
              </p>
            </div>

            {modalError && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-semibold text-rose-400">
                {modalError}
              </div>
            )}

            <form onSubmit={handleAddMemberSubmit} className="space-y-4 text-xs">
              <div>
                <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">
                  Select Plan
                </label>
                {plans.length === 0 ? (
                  <div className="text-zinc-500 py-2.5">
                    Loading plans... (Create plans in the Membership Plans section if none exist)
                  </div>
                ) : (
                  <select
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    className="w-full rounded-xl border border-zinc-805 bg-zinc-900 px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500 cursor-pointer animate-none"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} - ₹{p.price} ({p.durationDays} Days)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full rounded-xl border border-zinc-805 bg-zinc-900 px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="submit"
                  disabled={isSubmitting || plans.length === 0}
                  className="flex-1 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white py-3 font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Activating..." : "Activate Membership"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="flex-1 rounded-xl border border-zinc-800 hover:bg-zinc-900 text-zinc-400 py-3 font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InboxPage() {
  const { gymSlug } = useParams() as { gymSlug: string };
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const chatId = searchParams.get("chatId");

  const [selectedConversation, setSelectedConversation] = useState<string>(
    chatId || "",
  );
  const [showChat, setShowChat] = useState(!!chatId);
  const readSentRef = useRef<Set<string>>(new Set());
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  const loadInbox = async () => {
    try {
      const res = await api.get(`/api/dashboard/${gymSlug}/inbox`);
      setConversations(res.data.map(mapApiConversation));
    } catch (err) {
      console.error("❌ Failed to load inbox", err);
    }
  };

  useInboxSocket({
    selectedConversation,
    readSentRef,
    setConversations,
    mapApiConversation,
  });

  const handleSelectConversation = async (id: string, updateUrl = true) => {
    if (updateUrl) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("chatId", id);
      router.replace(`${pathname}?${params.toString()}`);
    }

    readSentRef.current.delete(id);
    setMessages([]);
    setSelectedConversation(id);
    setShowChat(true);

    try {
      const res = await api.get(`/api/dashboard/${gymSlug}/inbox/${id}`);

      const mappedMessages: Message[] = res.data.messages.map((m: any) => ({
        id: m.id,
        whatsappMessageId: m.whatsappMessageId,
        content: m.content,
        text: m.text,
        mediaUrl: m.mediaUrl,
        mimeType: m.mimeType,
        caption: m.caption,
        sender: m.direction === "outbound" ? "executive" : "customer",
        timestamp: m.createdAt,
        status: m.status ?? "delivered",
      }));

      setMessages(mappedMessages);

      setConversations((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
              ...c,
              memberName: (() => {
                const name = res.data.member?.name;
                const whatsapp = res.data.member?.whatsappName;
                const phone = res.data.member?.phone;
                if (!name) return whatsapp || phone;
                const cleanName = name.replace(/[+\-\s()]/g, "");
                const isPhoneOnly = /^\d+$/.test(cleanName);
                if (isPhoneOnly && whatsapp) {
                  return whatsapp;
                }
                return name;
              })(),
              sessionStarted: res.data.sessionStarted,
              sessionActive: res.data.sessionActive,
              sessionExpiresAt: res.data.sessionExpiresAt,
              isBlocked: !!res.data.member?.blockedAt,
              isMember: res.data.member?.isMember ?? false,
              planName: res.data.member?.planName ?? null,
              callPermissionStatus: res.data.member?.callPermissionStatus ?? c.callPermissionStatus,
            }
            : c,
        ),
      );
    } catch (err) {
      console.error("Failed to load conversation details", err);
      setMessages([]);
    }
  };

  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    const init = async () => {
      await loadInbox();
      if (chatId) {
        handleSelectConversation(chatId, false);
      }
    };
    init();
  }, [gymSlug, chatId]);

  const handleUpdateConversationStatus = (
    conversationId: string,
    status: Message["status"],
  ) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId && c.lastMessageDirection === "outbound"
          ? { ...c, lastMessageStatus: status }
          : c,
      ),
    );
  };

  const handleMarkAsRead = (conversationId: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? { ...c, unreadCount: 0, hasUnread: false }
          : c,
      ),
    );
  };

  const handleToggleBlock = async (conversationId: string, isBlocked: boolean) => {
    try {
      const endpoint = `/api/dashboard/${gymSlug}/inbox/${conversationId}/${isBlocked ? "unblock" : "block"}`;
      await api.post(endpoint);

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, isBlocked: !isBlocked } : c
        )
      );
      toast.success(`Contact ${isBlocked ? "unblocked" : "blocked"} successfully`);
    } catch (err: any) {
      console.error("Failed to toggle block", err);
      toast.error(err?.message || "Failed to toggle block");
    }
  };

  const currentConversation = conversations.find(
    (c) => c.id === selectedConversation,
  );

  return (
    <div className="flex flex-col md:flex-row -m-6 md:-m-8 h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div
        className={`${showChat ? "hidden md:block" : "block"} w-full md:w-auto h-full flex-shrink-0`}
      >
        <ConversationList
          conversations={conversations}
          selected={selectedConversation}
          onSelect={handleSelectConversation}
          onReload={loadInbox}
        />
      </div>
      <div
        className={`${showChat ? "block" : "hidden md:block"} flex-1 h-full min-w-0`}
      >
        {currentConversation ? (
          <ChatArea
            conversation={currentConversation}
            messages={messages}
            setMessages={setMessages}
            readSentRef={readSentRef}
            onBack={() => {
              setShowChat(false);
              const params = new URLSearchParams(searchParams.toString());
              params.delete("chatId");
              router.replace(`${pathname}?${params.toString()}`);
            }}
            onUpdateConversationStatus={handleUpdateConversationStatus}
            onMarkAsRead={handleMarkAsRead}
            onToggleBlock={handleToggleBlock}
            onBlockedStatusChange={(isBlocked) => {
              setConversations((prev) =>
                prev.map((c) =>
                  c.id === currentConversation.id ? { ...c, isBlocked } : c
                )
              );
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center bg-zinc-950 relative overflow-hidden">
            {/* Soft decorative glow behind the placeholder */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-cyan-500/5 blur-[80px] pointer-events-none" />

            <div className="text-center px-4 max-w-sm z-10 relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-xl">
                <MessageSquareIcon className="w-10 h-10 sm:w-12 sm:h-12 text-cyan-400" />
              </div>
              <h3 className="text-lg sm:text-xl font-extrabold text-zinc-100 mb-2">
                Select a conversation
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-[280px] mx-auto leading-relaxed">
                Choose a customer chat from the list on the left to start real-time messaging.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
