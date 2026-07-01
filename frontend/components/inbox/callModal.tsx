"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, PhoneIncoming, Mic, MicOff, Loader2 } from "lucide-react";
import { Socket } from "socket.io-client";
import { getSocket } from "@/lib/socket";
import { toast } from "react-toastify";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  gymSlug: string;
  conversationId: string;
  recipientName: string;
  recipientPhone: string;

  // Inbound call specifics
  isInbound?: boolean;
  inboundCallId?: string;
  inboundSdp?: string;
}

export default function CallModal({
  isOpen,
  onClose,
  conversationId,
  recipientName,
  recipientPhone,
  gymSlug,
  isInbound = false,
  inboundCallId,
  inboundSdp,
}: Props) {
  const [callStatus, setCallStatus] = useState<
    "INCOMING_RINGING" | "INITIATING" | "RINGING" | "CONNECTED" | "ENDED" | "FAILED"
  >(isInbound ? "INCOMING_RINGING" : "INITIATING");
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [callId, setCallId] = useState<string | null>(inboundCallId || null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const settingRemoteDescriptionRef = useRef(false);

  // Effect to reset state when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setCallStatus(isInbound ? "INCOMING_RINGING" : "INITIATING");
    setCallId(inboundCallId || null);
    setIsMuted(false);
    settingRemoteDescriptionRef.current = false;
    setErrorMessage(null);

    if (!isInbound) {
      initOutboundCall();
    } else {
      // For inbound, we just connect socket to listen for termination
      connectSocket(inboundCallId!);
    }

    // Cleanup when closing
    return () => {
      endCallUI();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Effect for the call timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callStatus === "CONNECTED") {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  const connectSocket = (currentCallId: string) => {
    const socket = getSocket();

    // We don't need to emit join-conversation here, since useChatSocket already does it, 
    // but doing it again is harmless.
    socket.emit("join-conversation", conversationId);

    const handleCallEvent = async (eventData: any) => {
      console.log("Received whatsapp call event:", eventData);
      if (eventData.callId !== currentCallId) return;

      switch (eventData.event) {
        case "connect":
          if (!isInbound && eventData.sdp) { // Only outbound needs to set answer from webhook
            try {
              const pc = pcRef.current;
              if (pc && pc.signalingState !== "stable" && !settingRemoteDescriptionRef.current) {
                settingRemoteDescriptionRef.current = true;
                await pc.setRemoteDescription({
                  type: "answer",
                  sdp: eventData.sdp,
                });
                console.log("Remote description set successfully");
              }
            } catch (err: any) {
              console.warn("Failed to set remote description:", err.message || err);
              settingRemoteDescriptionRef.current = false;
            }
          }
          break;
        case "status":
          if (eventData.status === "RINGING") setCallStatus("RINGING");
          else if (eventData.status === "ACCEPTED") setCallStatus("CONNECTED");
          else if (eventData.status === "REJECTED") {
            setCallStatus("FAILED");
            setErrorMessage("Call was rejected by the recipient.");
            endCallUI();
            setTimeout(onClose, 3000);
          }
          break;
        case "terminate":
          setCallStatus("ENDED");
          endCallUI();
          setTimeout(onClose, 1000);
          break;
      }
    };

    socket.on("whatsapp_call_event", handleCallEvent);

    // Save the handler so we can remove it on cleanup
    socketRef.current = socket as any;
    (socketRef.current as any)._callEventHandler = handleCallEvent;
  }

  const getMediaAndSetupPC = async () => {
    // 1. Get Microphone
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone access is not supported by your browser or connection context. Please use a secure (HTTPS) connection.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      localStreamRef.current = stream;

      // 2. Setup RTCPeerConnection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      // Add local tracks
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Handle remote tracks
      pc.ontrack = (event) => {
        if (remoteAudioRef.current && event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0];
        }
      };
      return pc;
    } catch (err: any) {
      if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        throw new Error("Microphone device not found. Please connect a microphone and try again.");
      }
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        throw new Error("Microphone access is not allowed. Please grant microphone permissions in your browser settings to make calls.");
      }
      if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        throw new Error("Microphone is already in use by another application.");
      }
      throw err;
    }
  }

  const waitForICE = async (pc: RTCPeerConnection) => {
    await new Promise<void>((resolve) => {
      if (pc.iceGatheringState === "complete") {
        resolve();
      } else {
        const checkState = () => {
          if (pc.iceGatheringState === "complete") {
            pc.removeEventListener("icegatheringstatechange", checkState);
            resolve();
          }
        };
        pc.addEventListener("icegatheringstatechange", checkState);
        setTimeout(() => {
          pc.removeEventListener("icegatheringstatechange", checkState);
          resolve();
        }, 2000);
      }
    });
  }

  const initOutboundCall = async () => {
    try {
      const pc = await getMediaAndSetupPC();

      // 3. Create Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForICE(pc);

      const finalSdp = pc.localDescription?.sdp;
      if (!finalSdp) throw new Error("Failed to generate SDP offer");

      // 4. Send API request
      const res = await fetch(`/api/dashboard/${gymSlug}/whatsapp/call/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: recipientPhone, sdp: finalSdp }),
      });

      if (!res.ok) {
        const errData = await res.json();
        if (errData?.details?.error?.code === 138006) {
          throw new Error("No approved call permission from the recipient. Please ask them to call you first or send a call permission request template.");
        }
        throw new Error(errData.error || "Failed to initiate call");
      }

      const data = await res.json();
      setCallId(data.callId);

      // 5. Connect Socket
      connectSocket(data.callId);
    } catch (err: any) {
      console.warn("Call initialization failed:", err.message || err);
      setCallStatus("FAILED");
      setErrorMessage(err.message || "Failed to access microphone or initiate call");
      setTimeout(onClose, 3000);
    }
  };

  const handleAcceptInbound = async () => {
    if (callStatus !== "INCOMING_RINGING") return;
    try {
      setCallStatus("INITIATING"); // Temporary loading state while getting mic

      const pc = await getMediaAndSetupPC();

      // 3. Set Remote Offer
      await pc.setRemoteDescription({ type: "offer", sdp: inboundSdp! });

      // 4. Create Answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitForICE(pc);

      const finalSdp = pc.localDescription?.sdp;
      if (!finalSdp) throw new Error("Failed to generate SDP answer");

      // 5. Send API request to accept
      const res = await fetch(`/api/dashboard/${gymSlug}/whatsapp/call/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId: inboundCallId, sdp: finalSdp }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to accept call");
      }

      setCallStatus("CONNECTED");
    } catch (err: any) {
      console.warn("Accept call failed:", err.message || err);
      setCallStatus("FAILED");
      setErrorMessage(err.message || "Failed to accept call");
      setTimeout(onClose, 3000);
    }
  }

  const endCallUI = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (socketRef.current) {
      if ((socketRef.current as any)._callEventHandler) {
        socketRef.current.off("whatsapp_call_event", (socketRef.current as any)._callEventHandler);
      }
      socketRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  };

  const handleHangUp = async () => {
    setCallStatus("ENDED");
    if (callId) {
      try {
        await fetch(`/api/dashboard/${gymSlug}/whatsapp/call/terminate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callId }),
        });
      } catch (err) {
        console.error("Failed to terminate call", err);
      }
    }
    endCallUI();
    setTimeout(onClose, 1000);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm flex flex-col items-center shadow-2xl relative overflow-hidden"
        >
          {callStatus === "CONNECTED" && (
            <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 to-transparent pointer-events-none animate-pulse" />
          )}

          <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mb-4 border border-zinc-700 shadow-inner relative">
            {callStatus === "INCOMING_RINGING" ? (
              <PhoneIncoming className="w-10 h-10 text-cyan-400 animate-pulse" />
            ) : (
              <Phone
                className={`w-10 h-10 ${callStatus === "CONNECTED"
                    ? "text-cyan-400"
                    : callStatus === "FAILED" || callStatus === "ENDED"
                      ? "text-red-500"
                      : "text-zinc-400"
                  }`}
              />
            )}

            {(callStatus === "RINGING" || callStatus === "INCOMING_RINGING") && (
              <span className="absolute w-full h-full rounded-full border-2 border-cyan-400/50 animate-ping" />
            )}
          </div>

          <h2 className="text-xl font-bold text-white mb-1">
            {recipientName || recipientPhone}
          </h2>
          <div className="text-sm text-zinc-400 mb-8 min-h-5 text-center px-4 flex flex-col items-center justify-center">
            {callStatus === "INCOMING_RINGING" && <span>Incoming Call...</span>}
            {callStatus === "INITIATING" && (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Connecting...
              </span>
            )}
            {callStatus === "RINGING" && <span>Ringing...</span>}
            {callStatus === "CONNECTED" && (
              <span className="text-cyan-400 font-medium">
                {Math.floor(callDuration / 60).toString().padStart(2, '0')}:
                {(callDuration % 60).toString().padStart(2, '0')}
              </span>
            )}
            {callStatus === "FAILED" && (
              <span className="text-red-400 flex flex-col items-center gap-1">
                <span className="font-semibold text-red-500">Call Failed</span>
                {errorMessage && <span className="text-xs text-zinc-500 max-w-[280px] mt-1">{errorMessage}</span>}
              </span>
            )}
            {callStatus === "ENDED" && <span>Call Ended</span>}
          </div>

          <div className="flex items-center gap-6 z-10">
            {callStatus === "INCOMING_RINGING" ? (
              <>
                <button
                  onClick={handleHangUp}
                  className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors shadow-lg"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>
                <button
                  onClick={handleAcceptInbound}
                  className="p-4 rounded-full bg-green-500 hover:bg-green-600 text-white transition-colors shadow-lg animate-bounce"
                >
                  <Phone className="w-6 h-6" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={toggleMute}
                  disabled={callStatus !== "CONNECTED" && callStatus !== "RINGING"}
                  className={`p-4 rounded-full transition-colors ${isMuted
                      ? "bg-zinc-800 text-red-400"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                    } disabled:opacity-50`}
                >
                  {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>

                <button
                  onClick={handleHangUp}
                  className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors shadow-lg"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          <audio ref={remoteAudioRef} autoPlay />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
