"use client";

import { motion } from "framer-motion";
import {
  MoreVertical,
  Check,
  CheckCheck,
  AlertCircle,
  ShoppingBag,
  SquareArrowOutUpRight,
  Phone,
  Reply,
  Loader2,
} from "lucide-react";
import type { Message, Conversation } from "@/lib/types";
import { useState, useRef } from "react";

interface Props {
  message: Message;
  conversation: Conversation;
  allMessages: Message[];
  onOpenMenu: (message: Message, rect: DOMRect) => void;
  onReply: (message: Message) => void;
  setInputValue: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

// Audio Player Component
function AudioPlayer({
  mediaUrl,
  isDownloaded,
  isDownloading,
  onDownload,
  mockSize,
  downloadProgress,
}: {
  mediaUrl: string;
  isDownloaded: boolean;
  isDownloading: boolean;
  onDownload: () => void;
  mockSize: string;
  downloadProgress: number;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const togglePlay = () => {
    if (!isDownloaded) {
      onDownload();
      return;
    }
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const remainingTime = duration - currentTime;
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDownloaded || !audioRef.current || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 min-w-62.5">
      <button
        onClick={togglePlay}
        disabled={isDownloading || (isDownloaded && isLoading && isPlaying)}
        className="shrink-0 w-10 h-10 rounded-full bg-cyan-600/10 hover:bg-cyan-600/20 flex items-center justify-center transition-colors disabled:opacity-80"
      >
        {!isDownloaded ? (
          isDownloading ? (
            <MiniCircularProgress progress={downloadProgress} />
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="text-cyan-400"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <polyline points="19 12 12 19 5 12"></polyline>
            </svg>
          )
        ) : isLoading && isPlaying ? (
          <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
        ) : isPlaying ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="text-cyan-400"
          >
            <rect x="4" y="3" width="3" height="10" />
            <rect x="9" y="3" width="3" height="10" />
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="text-cyan-400 ml-0.5"
          >
            <path d="M11.596 8.697l-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z" />
          </svg>
        )}
      </button>

      <div className="flex-1 flex items-center gap-2">
        <div
          className={`flex-1 h-8 flex items-center gap-0.5 ${isDownloaded ? "cursor-pointer" : "cursor-default opacity-50"}`}
          onClick={handleSeek}
        >
          {[3, 5, 4, 6, 3, 7, 4, 5, 3, 6, 4, 5, 3, 4, 6, 3, 5, 4].map(
            (height, i) => {
              const barPercentage = ((i + 1) / 18) * 100;
              const isFilled = isDownloaded && barPercentage <= progressPercentage;

              return (
                <div
                  key={i}
                  className={`flex-1 rounded-full transition-all ${
                    isFilled
                      ? "bg-cyan-600"
                      : "bg-cyan-600/30"
                  }`}
                  style={{ height: `${height * 3}px`, minWidth: "2px" }}
                />
              );
            },
          )}
        </div>

        {isDownloaded && (
          <audio
            ref={audioRef}
            src={mediaUrl}
            onEnded={() => setIsPlaying(false)}
            onLoadedMetadata={(e) => {
              const audio = e.currentTarget;
              setDuration(audio.duration);
              setIsLoading(false);
            }}
            onCanPlay={() => setIsLoading(false)}
            onWaiting={() => setIsLoading(true)}
            onPlaying={() => setIsLoading(false)}
            onError={() => setIsLoading(false)}
            onTimeUpdate={(e) => {
              const audio = e.currentTarget;
              setCurrentTime(audio.currentTime);
            }}
            autoPlay={isPlaying}
          />
        )}
      </div>

      <span className="text-xs text-zinc-400 shrink-0 select-none">
        {isDownloaded ? formatTime(remainingTime) : mockSize}
      </span>
    </div>
  );
}

function CircularProgress({ progress }: { progress: number }) {
  const radius = 20;
  const stroke = 3;
  const normalizedRadius = radius - stroke;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center w-12 h-12">
      <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 48 48">
        <circle
          fill="transparent"
          stroke="rgba(255, 255, 255, 0.15)"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx="24"
          cy="24"
        />
        <circle
          fill="transparent"
          stroke="#00ed64"
          strokeWidth={stroke}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          r={normalizedRadius}
          cx="24"
          cy="24"
          className="transition-all duration-75 ease-out"
        />
      </svg>
      <span className="absolute text-[9px] font-bold text-white select-none leading-none">
        {Math.round(progress)}%
      </span>
    </div>
  );
}

function MiniCircularProgress({ progress }: { progress: number }) {
  const radius = 16;
  const stroke = 2.5;
  const normalizedRadius = radius - stroke;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center w-8 h-8">
      <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 32 32">
        <circle
          fill="transparent"
          stroke="rgba(6, 182, 212, 0.15)"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx="16"
          cy="16"
        />
        <circle
          fill="transparent"
          stroke="#00ed64"
          strokeWidth={stroke}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          r={normalizedRadius}
          cx="16"
          cy="16"
          className="transition-all duration-75 ease-out"
        />
      </svg>
      <span className="absolute text-[8px] font-bold text-[#00ed64] select-none leading-none">
        {Math.round(progress)}
      </span>
    </div>
  );
}

function getStableMockSize(messageId: string, type: string) {
  let hash = 0;
  for (let i = 0; i < messageId.length; i++) {
    hash = messageId.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);
  
  if (type === "image") {
    const sizeKb = 100 + (hash % 1400);
    return sizeKb > 1024 
      ? `${(sizeKb / 1024).toFixed(1)} MB` 
      : `${sizeKb} KB`;
  } else if (type === "video") {
    const sizeMb = 1.0 + (hash % 70) / 10;
    return `${sizeMb.toFixed(1)} MB`;
  } else if (type === "audio") {
    const sizeKb = 50 + (hash % 450);
    return `${sizeKb} KB`;
  } else {
    const sizeKb = 100 + (hash % 14900);
    return sizeKb > 1024 
      ? `${(sizeKb / 1024).toFixed(1)} MB` 
      : `${sizeKb} KB`;
  }
}

export default function MessageBubble({
  message: msg,
  conversation,
  allMessages,
  onOpenMenu,
  onReply,
}: Props) {
  const [imageError, setImageError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  
  const storageKey = `downloaded_${msg.whatsappMessageId || msg.id}`;
  const [isDownloaded, setIsDownloaded] = useState(() => {
    if (msg.sender === "executive") return true;
    if (typeof window !== "undefined") {
      return !!localStorage.getItem(storageKey);
    }
    return false;
  });
  const [isDownloadingMedia, setIsDownloadingMedia] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);



  const repliedMessage: Message | undefined =
    allMessages.find((m) => m.whatsappMessageId === msg.replyToMessageId) ??
    (msg.replyTo
      ? ({
          ...msg.replyTo,
          id: msg.replyToMessageId || "unknown",
          whatsappMessageId: msg.replyToMessageId,
          timestamp: "",
        } as Message)
      : undefined);

  const cleanText =
    (msg.text || "")
      .replace(/^\[(image|video|audio|document|media)(?:\s+message)?\]\s*/i, "")
      .trim() ||
    (msg.caption || "").trim() ||
    (msg.template?.body?.text || "").trim();

  const outboundMedia =
    msg.outboundPayload?.image ||
    msg.outboundPayload?.video ||
    msg.outboundPayload?.audio ||
    msg.outboundPayload?.document;

  const effectiveMediaUrl =
    msg.mediaUrl || outboundMedia?.link || outboundMedia?.url;
  const effectiveCaption = msg.caption || outboundMedia?.caption;
  let effectiveMimeType = msg.mimeType;

  if (!effectiveMimeType && outboundMedia) {
    if (msg.outboundPayload?.image) effectiveMimeType = "image/jpeg";
    else if (msg.outboundPayload?.video) effectiveMimeType = "video/mp4";
    else if (msg.outboundPayload?.audio) effectiveMimeType = "audio/mpeg";
    else if (msg.outboundPayload?.document)
      effectiveMimeType = "application/pdf";
  }

  const isImage = !!(
    effectiveMediaUrl &&
    effectiveMimeType?.startsWith("image/") &&
    msg.template?.header?.type !== "IMAGE"
  );
  const isVideo = !!(
    effectiveMediaUrl &&
    effectiveMimeType?.startsWith("video/") &&
    msg.template?.header?.type !== "VIDEO"
  );
  const isAudio = !!(
    effectiveMediaUrl && effectiveMimeType?.startsWith("audio/")
  );
  const isDocument = !!(
    effectiveMediaUrl &&
    (effectiveMimeType?.startsWith("application/") ||
      effectiveMimeType?.includes("document")) &&
    msg.template?.header?.type !== "DOCUMENT"
  );

  const handleDownloadMedia = async () => {
    if (isDownloadingMedia) return;
    setIsDownloadingMedia(true);
    setDownloadProgress(0);

    let currentProgress = 0;
    let targetProgress = 0;
    let animationFrameId: number;

    const animate = () => {
      if (currentProgress < targetProgress) {
        const diff = targetProgress - currentProgress;
        const step = Math.max(1.5, diff * 0.12);
        currentProgress = Math.min(targetProgress, currentProgress + step);
        setDownloadProgress(currentProgress);
      }
      if (currentProgress < 100) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    try {
      const response = await fetch(effectiveMediaUrl!);
      if (!response.ok) throw new Error("Failed to fetch media");
      
      const contentLength = +(
        response.headers.get("content-length") || 
        response.headers.get("Content-Length") || 
        0
      );
      
      if (contentLength > 0 && response.body) {
        const reader = response.body.getReader();
        let receivedLength = 0;
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            targetProgress = 100;
            break;
          }
          receivedLength += value.length;
          targetProgress = Math.min(98, (receivedLength / contentLength) * 100);
        }
      } else {
        targetProgress = 100;
      }

      while (currentProgress < 100) {
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      
      localStorage.setItem(storageKey, "true");
      setIsDownloaded(true);
    } catch (err) {
      console.error("Failed to load media:", err);
      localStorage.setItem(storageKey, "true");
      setIsDownloaded(true);
    } finally {
      cancelAnimationFrame(animationFrameId);
      setIsDownloadingMedia(false);
      setDownloadProgress(0);
    }
  };

  const handleDocumentAction = () => {
    if (!isDownloaded) {
      handleDownloadMedia();
    } else {
      window.open(effectiveMediaUrl!, "_blank");
    }
  };



  const formattedTime = msg.timestamp
    ? new Date(msg.timestamp).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).toLowerCase()
    : "";

  const getMessageStatusIcon = (status?: Message["status"]) => {
    if (!status) return null;
    if (status === "sent") return <Check className="w-4 h-4 text-zinc-400" />;
    if (status === "delivered") return <CheckCheck className="w-4 h-4 text-zinc-400" />;
    if (status === "read")
      return <CheckCheck className="w-4 h-4 text-cyan-400" />;
    if (status === "failed")
      return <AlertCircle className="w-4 h-4 text-rose-500" />;
    return null;
  };

  const renderTimestamp = ({
    isOverlay = false,
    customClass = "",
  }: {
    isOverlay?: boolean;
    customClass?: string;
  } = {}) => (
    <div className={`flex items-center gap-0.5 select-none ${customClass}`}>
      <span
        className={`text-[10px] lowercase leading-none ${
          isOverlay
            ? "text-white drop-shadow-sm font-medium"
            : msg.sender === "executive"
              ? "text-bubble-outbound-meta"
              : "text-bubble-inbound-meta"
        }`}
      >
        {formattedTime}
      </span>
      {msg.sender === "executive" && (
        <span
          className={
            msg.status === "read"
              ? "text-cyan-400"
              : isOverlay
                ? "text-white drop-shadow-sm"
                : "text-bubble-outbound-meta"
          }
        >
          {getMessageStatusIcon(msg.status)}
        </span>
      )}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`flex items-end gap-2 ${
        msg.sender === "executive" ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`flex flex-col gap-1
        ${
          isImage || isVideo
            ? "w-fit"
            : msg.template?.header?.type === "IMAGE" ||
                msg.template?.header?.type === "VIDEO"
              ? "w-fit max-w-70"
              : "max-w-[70%]"
        }
        ${
          msg.outboundPayload?.interactive || msg.template?.buttons
            ? "min-w-[200px]"
            : isImage || isVideo
              ? ""
              : "min-w-[120px]"
        }
        `}
      >
        <div
          className={`group relative shadow-sm overflow-hidden flex flex-col p-0
          ${
            msg.sender === "executive"
              ? "bg-bubble-outbound-bg text-bubble-outbound-text rounded-tr-none rounded-lg rounded-br-lg"
              : "bg-bubble-inbound-bg text-bubble-inbound-text rounded-tl-none rounded-lg rounded-bl-lg border border-zinc-200/50 dark:border-zinc-800/50"
          }
          max-w-full`}
        >
          {/* TEMPLATE HEADER (Rich Media) */}
          {msg.template?.header && (
            <div className="relative">
              {msg.template.header.type === "IMAGE" &&
                msg.template.header.mediaUrl && (
                  <div className="relative">
                    <img
                      src={msg.template.header.mediaUrl}
                      alt="Header"
                      className="w-full h-auto object-cover"
                    />
                    {!cleanText &&
                      renderTimestamp({
                        isOverlay: true,
                        customClass:
                          "absolute bottom-1.5 right-2 bg-black/20 rounded px-1 py-0.5 backdrop-blur-[2px]",
                      })}
                  </div>
                )}

              {msg.template.header.type === "VIDEO" &&
                msg.template.header.mediaUrl && (
                  <video
                    src={msg.template.header.mediaUrl}
                    controls
                    className="w-full h-45 object-cover"
                  />
                )}
              {msg.template.header.type === "DOCUMENT" &&
                msg.template.header.mediaUrl && (
                  <div className="flex items-center gap-2 p-3 bg-zinc-800 border-b border-zinc-700">
                    <div className="p-2 bg-rose-500/10 rounded text-rose-500">
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                      </svg>
                    </div>
                    <a
                      href={msg.template.header.mediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium underline truncate text-zinc-200"
                    >
                      View Document
                    </a>
                  </div>
                )}
              {msg.template.header.type === "TEXT" &&
                msg.template.header.text && (
                  <div className="px-3 pt-3 pb-1 font-bold text-sm text-white">
                    {msg.template.header.text}
                  </div>
                )}
            </div>
          )}

          <div
            className={`flex flex-col ${!isImage && !isVideo ? "px-1.5 py-2 gap-1.5" : ""}`}
          >
            {/* IMAGE MESSAGE */}
            {isImage && effectiveMediaUrl && (
              <div className="w-fit max-w-75 relative">
                {!isDownloaded ? (
                  <div className="p-1 relative w-64 h-48 flex flex-col items-center justify-center bg-zinc-800 dark:bg-zinc-900 rounded-md overflow-hidden border border-zinc-700/50">
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-700/20 to-zinc-900/40 backdrop-blur-md opacity-70" />
                    <button
                      onClick={handleDownloadMedia}
                      disabled={isDownloadingMedia}
                      className="z-10 flex flex-col items-center gap-2 group cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-full bg-black/50 hover:bg-black/70 border border-white/25 flex items-center justify-center shadow-lg transition-all active:scale-95">
                        {isDownloadingMedia ? (
                          <CircularProgress progress={downloadProgress} />
                        ) : (
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            className="text-white transform group-hover:translate-y-0.5 transition-transform"
                          >
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <polyline points="19 12 12 19 5 12"></polyline>
                          </svg>
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-white/90 bg-black/30 px-2 py-0.5 rounded-full backdrop-blur-[2px] select-none">
                        {getStableMockSize(msg.whatsappMessageId || msg.id, "image")}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="p-1 relative min-w-[200px] min-h-[150px] flex items-center justify-center bg-black/5 dark:bg-black/25 rounded-md overflow-hidden">
                    {imageError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-rose-950/10 text-rose-400 gap-1.5 p-3 text-center z-10">
                        <AlertCircle className="w-5 h-5" />
                        <span className="text-[10px] font-semibold">Failed to load image</span>
                      </div>
                    )}
                    <img
                      src={effectiveMediaUrl}
                      alt="Image"
                      className={`w-full h-auto object-cover cursor-pointer rounded-md`}
                      onError={() => setImageError(true)}
                      onClick={() => window.open(effectiveMediaUrl!, "_blank")}
                    />
                  </div>
                )}

                {cleanText && (
                  <div className="relative px-2 pb-2 mt-1">
                    <p className="text-[13px] break-words whitespace-pre-wrap leading-[18px] pr-14">
                      {cleanText}
                    </p>
                    {!msg.template?.footer && (
                      <div className="absolute bottom-0 right-1.5 flex items-center gap-1">
                        {renderTimestamp()}
                      </div>
                    )}
                  </div>
                )}

                {!cleanText && isDownloaded && (
                  <div className="absolute bottom-2 right-2">
                    {renderTimestamp({ isOverlay: true })}
                  </div>
                )}
              </div>
            )}

            {/* VIDEO MESSAGE */}
            {isVideo && effectiveMediaUrl && (
              <div className="w-fit max-w-75 relative">
                {!isDownloaded ? (
                  <div className="p-1 relative w-64 h-48 flex flex-col items-center justify-center bg-zinc-800 dark:bg-zinc-900 rounded-md overflow-hidden border border-zinc-700/50">
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-700/20 to-zinc-900/40 backdrop-blur-md opacity-70" />
                    <div className="absolute top-2.5 left-2.5 z-10 p-1 bg-black/40 rounded backdrop-blur-[2px]">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-white"
                      >
                        <polygon points="23 7 16 12 23 17 23 7"></polygon>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                      </svg>
                    </div>
                    <button
                      onClick={handleDownloadMedia}
                      disabled={isDownloadingMedia}
                      className="z-10 flex flex-col items-center gap-2 group cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-full bg-black/50 hover:bg-black/70 border border-white/25 flex items-center justify-center shadow-lg transition-all active:scale-95">
                        {isDownloadingMedia ? (
                          <CircularProgress progress={downloadProgress} />
                        ) : (
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            className="text-white transform group-hover:translate-y-0.5 transition-transform"
                          >
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <polyline points="19 12 12 19 5 12"></polyline>
                          </svg>
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-white/90 bg-black/30 px-2 py-0.5 rounded-full backdrop-blur-[2px] select-none">
                        {getStableMockSize(msg.whatsappMessageId || msg.id, "video")}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="p-1 relative min-w-[200px] min-h-[150px] flex items-center justify-center bg-black/5 dark:bg-black/25 rounded-md overflow-hidden">
                    {videoError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-rose-950/10 text-rose-400 gap-1.5 p-3 text-center z-10">
                        <AlertCircle className="w-5 h-5" />
                        <span className="text-[10px] font-semibold">Failed to load video</span>
                      </div>
                    )}
                    <video
                      src={effectiveMediaUrl}
                      controls
                      className="w-full h-auto object-cover rounded-md"
                      onError={() => setVideoError(true)}
                    />
                  </div>
                )}

                {cleanText && (
                  <div className="relative px-2 pb-2 mt-1">
                    <p className="text-[13px] break-words whitespace-pre-wrap leading-[18px] pr-14">
                      {cleanText}
                    </p>
                    {!msg.template?.footer && (
                      <div className="absolute bottom-0 right-1.5 flex items-center gap-1">
                        {renderTimestamp()}
                      </div>
                    )}
                  </div>
                )}

                {!cleanText && isDownloaded && (
                  <div className="absolute bottom-8 right-2">
                    {renderTimestamp({ isOverlay: true })}
                  </div>
                )}
              </div>
            )}

            {isAudio && effectiveMediaUrl && (
              <div className="relative p-1">
                <AudioPlayer 
                  mediaUrl={effectiveMediaUrl} 
                  isDownloaded={isDownloaded}
                  isDownloading={isDownloadingMedia}
                  onDownload={handleDownloadMedia}
                  mockSize={getStableMockSize(msg.whatsappMessageId || msg.id, "audio")}
                  downloadProgress={downloadProgress}
                />
                {!cleanText &&
                  renderTimestamp({ customClass: "absolute bottom-1 right-2" })}
              </div>
            )}

            {isDocument && effectiveMediaUrl && (
              <div className="relative flex items-center gap-3 px-3 py-3 bg-black/5 dark:bg-black/25 rounded-lg pb-5 m-1">
                <div className="shrink-0 w-12 h-12 rounded-lg bg-cyan-600/10 flex items-center justify-center">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-cyan-400"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {effectiveCaption || "Document"}
                  </p>
                  <p className="text-xs opacity-70 select-none">
                    {effectiveMimeType?.split("/")[1]?.toUpperCase() || "FILE"} • {
                      !isDownloaded 
                        ? getStableMockSize(msg.whatsappMessageId || msg.id, "document")
                        : "Loaded in App"
                    }
                  </p>
                </div>
                <button
                  onClick={handleDocumentAction}
                  disabled={isDownloadingMedia}
                  className="shrink-0 w-10 h-10 rounded-full bg-cyan-600/10 hover:bg-cyan-600/20 flex items-center justify-center transition-colors text-cyan-400 disabled:opacity-80"
                >
                  {isDownloadingMedia ? (
                    <MiniCircularProgress progress={downloadProgress} />
                  ) : !isDownloaded ? (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <polyline points="19 12 12 19 5 12"></polyline>
                    </svg>
                  ) : (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                      <polyline points="15 3 21 3 21 9"></polyline>
                      <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                  )}
                </button>
                {!cleanText &&
                  renderTimestamp({ customClass: "absolute bottom-1 right-2" })}
              </div>
            )}

            {/* REPLY MESSAGE */}
            {msg.replyToMessageId && repliedMessage && (
              <div
                className="mx-1 px-3 py-2 bg-zinc-950/60 border-l-4 border-cyan-500 rounded flex gap-2 cursor-pointer"
                onClick={() => {
                  if (repliedMessage.id && repliedMessage.timestamp) {
                    onReply?.(repliedMessage);
                  }
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-cyan-400 mb-1">
                    {repliedMessage.sender === "executive"
                      ? "You"
                      : conversation.memberName}
                  </div>
                  <div className="text-xs text-zinc-400 line-clamp-2">
                    {repliedMessage.text ||
                      repliedMessage.caption ||
                      "Media Message"}
                  </div>
                </div>
              </div>
            )}

            {/* TEXT CONTENT */}
            {cleanText && !isImage && !isVideo && (
              <div className="px-2 py-0.5 text-sm break-words whitespace-pre-wrap">
                {cleanText}
                {!msg.template?.footer && (
                  <span className="float-right ml-2 mt-1 -mb-1">
                    {renderTimestamp()}
                  </span>
                )}
              </div>
            )}

            {/* TEMPLATE FOOTER */}
            {msg.template?.footer && (
              <div className="relative px-2 pb-2">
                <div className="text-xs text-zinc-400 italic opacity-85 pr-14 pb-1">
                  {msg.template.footer}
                </div>
                <div className="absolute bottom-0 right-1.5 flex items-center gap-1">
                  {renderTimestamp()}
                </div>
              </div>
            )}
          </div>

          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                onOpenMenu(msg, rect);
              }}
              className="p-1 rounded-full bg-zinc-800 shadow hover:bg-zinc-700"
            >
              <MoreVertical className="w-3.5 h-3.5 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* TEMPLATE BUTTONS */}
        {msg.template?.buttons && msg.template.buttons.length > 0 && (
          <div className="w-full flex flex-col gap-1">
            <div
              className={`flex gap-1.5 w-full ${
                msg.template.buttons.length === 2 ? "flex-row" : "flex-col"
              }`}
            >
              {msg.template.buttons.map((btn, idx) => (
                <button
                  key={idx}
                  className={`flex-1 w-full hover:brightness-95 shadow-sm rounded-lg py-2 px-3 text-[#53bdeb] font-semibold text-center text-sm transition-all active:scale-[0.98] border border-zinc-850 bg-zinc-900`}
                  onClick={() => {
                    if (btn.type === "URL" && btn.value) {
                      window.open(btn.value, "_blank");
                    }
                  }}
                >
                  {btn.text}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
