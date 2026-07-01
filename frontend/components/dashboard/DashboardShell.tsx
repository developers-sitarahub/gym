"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from '@/components/dashboard/ThemeToggle';
import {
  Dumbbell,
  Users,
  CreditCard,
  CheckSquare,
  Bot,
  MessageCircle,
  Settings,
  LogOut,
  UserCheck,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { connectSocket, getSocket } from '@/lib/socket';
import CallModal from '@/components/inbox/callModal';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface DashboardShellProps {
  children: React.ReactNode;
  gym: any;
  activeUser: any;
  gymSlug: string;
}

export default function DashboardShell({ children, gym, activeUser, gymSlug }: DashboardShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const [gymName, setGymName] = useState(gym?.name || 'fit');
  const [gymLogo, setGymLogo] = useState<string | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [tempGymName, setTempGymName] = useState(gym?.name || 'fit');
  const [tempGymLogo, setTempGymLogo] = useState<string | null>(null);

  useEffect(() => {
    const savedName = localStorage.getItem('fitflow_gym_name');
    const savedLogo = localStorage.getItem('fitflow_gym_logo');
    if (savedName !== null) {
      setGymName(savedName);
    } else if (gym?.name) {
      setGymName(gym.name);
    }
    if (savedLogo !== null) setGymLogo(savedLogo);
  }, [gym?.name]);

  const openProfileModal = () => {
    setTempGymName(gymName);
    setTempGymLogo(gymLogo);
    setIsCollapsed(false);
    setIsFlipped(true);
  };

  const handleSaveSettings = (newName: string, newLogo: string | null) => {
    const nameVal = newName.trim() || gym?.name || 'fit';
    setGymName(nameVal);
    setGymLogo(newLogo);
    localStorage.setItem('fitflow_gym_name', nameVal);
    if (newLogo) {
      localStorage.setItem('fitflow_gym_logo', newLogo);
    } else {
      localStorage.removeItem('fitflow_gym_logo');
    }
    setIsFlipped(false);
  };

  // Global Inbound Call State
  const [incomingCall, setIncomingCall] = useState<any>(null);

  useEffect(() => {
    if (!gym?.id) return;
    
    connectSocket();
    const socket = getSocket();

    const handleCallEvent = (eventData: any) => {
      console.log("Global call event:", eventData);
      if (
        eventData.event === "connect" &&
        eventData.direction === "USER_INITIATED" &&
        eventData.sdp
      ) {
        setIncomingCall(eventData);
      } else if (eventData.event === "terminate" && incomingCall?.callId === eventData.callId) {
        setIncomingCall(null);
      }
    };

    socket.on("whatsapp_call_event", handleCallEvent);

    return () => {
      socket.off("whatsapp_call_event", handleCallEvent);
    };
  }, [gym?.id, incomingCall?.callId]);

  const sidebarLinks = [
    { label: 'Members', icon: <Users className="h-4 w-4 shrink-0" />, href: `/dashboard/${gymSlug}/members` },
    { label: 'Plans', icon: <CreditCard className="h-4 w-4 shrink-0" />, href: `/dashboard/${gymSlug}/plans` },
    { label: 'Payments', icon: <CheckSquare className="h-4 w-4 shrink-0" />, href: `/dashboard/${gymSlug}/payments` },
    { label: 'Chatbot', icon: <Bot className="h-4 w-4 shrink-0" />, href: `/dashboard/${gymSlug}/chatbot` },
    { label: 'Inbox', icon: <MessageCircle className="h-4 w-4 shrink-0" />, href: `/dashboard/${gymSlug}/inbox` },
    { label: 'Templates', icon: <FileText className="h-4 w-4 shrink-0" />, href: `/dashboard/${gymSlug}/templates` },
    { label: 'Settings', icon: <Settings className="h-4 w-4 shrink-0" />, href: `/dashboard/${gymSlug}/settings` },
  ];

  return (
    <div className="flex h-screen bg-zinc-950 font-sans text-zinc-100 relative overflow-hidden">
      {/* Background Lights */}
      <div className="absolute left-0 top-0 h-[400px] w-[400px] rounded-full bg-cyan-600/5 blur-[100px]" />
      <div className="absolute right-0 bottom-0 h-[400px] w-[400px] rounded-full bg-violet-600/5 blur-[100px]" />

      {/* Sidebar Panel */}
      <aside 
        className={`hidden border-r border-zinc-805 bg-zinc-950/80 backdrop-blur-md md:flex flex-col z-10 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        {/* Brand Header */}
        <div className={`flex h-16 items-center border-b border-zinc-805 transition-all duration-300 ${isCollapsed ? 'justify-center' : 'justify-between px-4'}`}>
          {!isCollapsed ? (
            <>
              <div className="flex items-center overflow-hidden">
                <Dumbbell className="h-6 w-6 text-cyan-400 shrink-0" />
                <span className={`text-lg font-black tracking-tight text-zinc-100 uppercase whitespace-nowrap overflow-hidden transition-all duration-300 ${isCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[120px] opacity-100 ml-2'}`}>
                  Fit<span className="text-cyan-400">Flow</span>
                </span>
              </div>
              <button 
                onClick={() => setIsCollapsed(true)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors shrink-0"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button 
              onClick={() => setIsCollapsed(false)}
              className="group p-2 rounded-xl text-cyan-400 hover:bg-zinc-800 hover:text-zinc-300 transition-all flex items-center justify-center w-10 h-10"
              title="Expand Sidebar"
            >
              <Dumbbell className="h-6 w-6 group-hover:hidden" />
              <PanelLeftOpen className="h-5 w-5 hidden group-hover:block" />
            </button>
          )}
        </div>

        {/* Navigation Items (with flip card container) */}
        <div className="flex-1 relative sidebar-perspective w-full min-h-[300px]">
          <div className={`sidebar-flipper ${isFlipped ? 'sidebar-flipped' : ''}`}>
            
            {/* FRONT FACE (standard navigation menu) */}
            <nav className="sidebar-front flex flex-col space-y-1 px-3 py-4 overflow-y-auto overflow-x-hidden bg-transparent">
              {sidebarLinks.map((link) => {
                const isActive = pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    title={isCollapsed ? link.label : undefined}
                    className={`flex items-center rounded-xl py-3 text-xs font-semibold transition-all duration-300 ${
                      isCollapsed ? 'justify-center px-0' : 'px-4'
                    } ${
                      isActive 
                        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]' 
                        : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-100 border border-transparent'
                    }`}
                  >
                    {link.icon}
                    <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[150px] opacity-100 ml-3'}`}>
                      {link.label}
                    </span>
                  </Link>
                );
              })}
            </nav>

            {/* BACK FACE (Customize Gym settings form) */}
            <div className="sidebar-back bg-zinc-950 p-5 flex flex-col justify-between overflow-y-auto border-t border-b border-zinc-900">
              <div className="space-y-6">
                <div className="border-b border-zinc-900 pb-3">
                  <h3 className="text-sm font-extrabold text-white">Customize Gym</h3>
                  <p className="text-[10px] text-zinc-500 mt-1">Configure your workspace branding</p>
                </div>

                <div className="space-y-4 text-xs">
                  {/* Gym Name Input */}
                  <div>
                    <label className="block font-bold text-zinc-400 mb-1.5 uppercase tracking-wider text-[10px]">Gym Name</label>
                    <input 
                      type="text"
                      value={tempGymName}
                      onChange={(e) => setTempGymName(e.target.value)}
                      placeholder="e.g. fit"
                      className="w-full rounded-xl border border-zinc-805 bg-zinc-900 px-3 py-2 text-zinc-100 focus:outline-none focus:border-cyan-500 placeholder-zinc-650"
                    />
                  </div>

                  {/* Gym Logo Upload Input */}
                  <div>
                    <label className="block font-bold text-zinc-400 mb-1.5 uppercase tracking-wider text-[10px]">Gym Logo Image</label>
                    
                    {tempGymLogo && (
                      <div className="mb-2.5 flex items-center gap-2 bg-zinc-900/60 p-2 rounded-xl border border-zinc-805">
                        <img src={tempGymLogo} alt="Preview" className="h-8 w-8 object-contain rounded-md" />
                        <span className="text-[10px] text-zinc-500 truncate flex-1">Logo image selected</span>
                        <button 
                          type="button" 
                          onClick={() => setTempGymLogo(null)}
                          className="text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <input 
                        type="file"
                        accept="image/*"
                        id="brand-logo-file-flip-nav"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              if (event.target?.result) {
                                setTempGymLogo(event.target.result as string);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <label 
                        htmlFor="brand-logo-file-flip-nav"
                        className="flex-1 text-center py-2.5 rounded-xl border border-dashed border-zinc-805 bg-zinc-900/30 hover:bg-zinc-900/60 cursor-pointer text-zinc-400 hover:text-zinc-300 transition-colors font-semibold"
                      >
                        Upload Logo
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 text-xs border-t border-zinc-900 pt-4 mt-6">
                <button
                  onClick={() => handleSaveSettings(tempGymName, tempGymLogo)}
                  className="flex-1 rounded-xl bg-cyan-600 hover:bg-cyan-500 py-3 font-bold text-white transition-colors cursor-pointer"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsFlipped(false)}
                  className="flex-1 rounded-xl border border-zinc-805 hover:bg-zinc-900 py-3 font-bold text-zinc-400 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Bottom Profile Details */}
        <div className={`border-t border-zinc-805 transition-all duration-300 bg-zinc-950/40 ${isCollapsed ? 'flex flex-col items-center gap-4 p-2 py-4' : 'p-4'}`}>
          <button
            onClick={openProfileModal}
            className={`flex items-center transition-all duration-300 hover:bg-zinc-800/35 p-1.5 rounded-xl cursor-pointer w-full text-left ${isCollapsed ? 'mb-0 justify-center' : 'mb-4'}`}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400 font-extrabold text-xs shrink-0" title={activeUser.name}>
              {activeUser.name.substring(0, 2).toUpperCase()}
            </div>
            <div className={`overflow-hidden transition-all duration-300 flex-1 ${isCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[150px] opacity-100 ml-3'}`}>
              <span className="block text-xs font-bold text-zinc-100 truncate">{activeUser.name}</span>
              <span className="flex items-center gap-1 text-[9px] font-semibold text-zinc-500 mt-0.5 uppercase tracking-wider">
                <UserCheck className="h-2.5 w-2.5 text-cyan-400 shrink-0" /> {activeUser.role}
              </span>
            </div>
          </button>

          <form action="/api/auth/logout" method="POST" className={isCollapsed ? 'w-full flex justify-center' : 'w-full'}>
            <button
              type="submit"
              title={isCollapsed ? "Sign Out" : undefined}
              className={`flex items-center justify-center rounded-xl border border-zinc-805 bg-zinc-850/30 text-xs font-bold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all duration-300 ${
                isCollapsed ? 'w-10 h-10' : 'w-full px-4 py-2'
              }`}
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" /> 
              <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[100px] opacity-100 ml-2'}`}>
                Sign Out
              </span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex flex-1 flex-col overflow-hidden z-10 min-w-0">
        {/* Top Header */}
        <header className="flex h-16 items-center justify-between border-b border-zinc-805 bg-zinc-950/80 px-6 md:px-8 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {gymLogo ? (
                <img src={gymLogo} alt="Gym Logo" className="h-6 w-6 object-contain rounded border border-zinc-805" />
              ) : null}
              <span className="text-sm font-extrabold text-zinc-100 truncate max-w-[150px] sm:max-w-none">
                {gymName}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 shrink-0">
            <ThemeToggle />
            <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-[10px] font-bold text-cyan-400 border border-cyan-500/20">
              🟢 System Online
            </span>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-zinc-950/20">{children}</main>
      </div>

      {/* Global Inbound Call Modal */}
      {incomingCall && (
        <CallModal
          isOpen={!!incomingCall}
          onClose={() => setIncomingCall(null)}
          gymSlug={gymSlug}
          conversationId={incomingCall.conversationId}
          recipientName={incomingCall.memberName}
          recipientPhone={incomingCall.memberPhone}
          isInbound={true}
          inboundCallId={incomingCall.callId}
          inboundSdp={incomingCall.sdp}
        />
      )}
      <ToastContainer theme="dark" position="bottom-right" />
    </div>
  );
}
