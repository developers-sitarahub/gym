"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
    Search,
    ArrowLeft,
    Send,
    Phone,
    Globe,
    MessageSquareIcon,
    Image as ImageIcon,
    ShoppingBag,
    Layers,
    Loader2,
} from "lucide-react";

import { toast } from "react-toastify";
import type { Template } from "@/lib/types";

interface TemplatePickerProps {
    templates: Template[];

    selectedTemplate: Template | null;
    setSelectedTemplate: (t: Template | null) => void;

    templateVariables: string[];
    setTemplateVariables: (v: string[]) => void;

    templateSearch: string;
    setTemplateSearch: (v: string) => void;

    isSendingTemplate: boolean;
    handleSendTemplate: () => Promise<void>;
}

export default function TemplatePicker({
    templates,
    selectedTemplate,
    setSelectedTemplate,
    templateVariables,
    setTemplateVariables,
    templateSearch,
    setTemplateSearch,
    isSendingTemplate,
    handleSendTemplate,
}: TemplatePickerProps) {

    const handleSendClick = async () => {
        // Validation: Check if all variables are filled
        // This is especially critical for Catalog templates where params might be required
        if (selectedTemplate) {
            const emptyVars = templateVariables.some(v => !v || v.trim() === "");
            if (emptyVars) {
                toast.error("Please fill all required variable fields", {
                    position: "top-center",
                    autoClose: 3000
                });

                // Highlight empty fields logic could go here (e.g. by setting a 'touched' state), 
                // but toast is a good first step.
                return;
            }
        }

        await handleSendTemplate();
    };
    return (
        <div className="flex flex-col h-125">
            {!selectedTemplate ? (
                <>
                    {/* Search */}
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-zinc-500" />
                        <input
                            type="text"
                            placeholder="Search templates by name..."
                            value={templateSearch}
                            onChange={(e) => setTemplateSearch(e.target.value)}
                            className="w-full bg-zinc-950 pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all"
                        />
                    </div>

                    {/* Template List */}
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                        {templates
                            .filter((t) =>
                                t.displayName
                                    .toLowerCase()
                                    .includes(templateSearch.toLowerCase())
                            )
                            .map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => {
                                        setSelectedTemplate(t);

                                        const body = t.languages[0]?.body || "";
                                        const matches = body.match(/{{\d+}}/g);
                                        const count = matches ? new Set(matches).size : 0;

                                        setTemplateVariables(new Array(count).fill(""));
                                    }}
                                    className="w-full text-left p-4 rounded-xl border border-zinc-800 bg-zinc-950/20 hover:border-accent/50 hover:bg-zinc-850/50 transition-all cursor-pointer"
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <p className="font-bold text-sm text-zinc-100">{t.displayName}</p>
                                        <div className="flex gap-1 items-center">
                                            <span className="text-[10px] px-2.5 py-0.5 rounded-full uppercase bg-zinc-800 text-zinc-300 font-bold tracking-wider">
                                                {t.category}
                                            </span>
                                            {(t.templateType || "").toLowerCase() === "catalog" && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-purple-100 text-purple-600 dark:bg-purple-900/30 flex items-center gap-1">
                                                    <ShoppingBag className="w-3 h-3" /> Catalog
                                                </span>
                                            )}
                                            {(t.templateType || "").toLowerCase() === "carousel" && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-pink-100 text-pink-600 dark:bg-pink-900/30 flex items-center gap-1">
                                                    <Layers className="w-3 h-3" /> Carousel
                                                </span>
                                            )}
                                            {(!t.templateType || (t.templateType || "").toLowerCase() === "standard") && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-zinc-800 text-zinc-200 flex items-center gap-1">
                                                    Standard
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                                        {t.languages[0]?.body}
                                    </p>
                                </button>
                            ))}

                        {templates.length === 0 && (
                            <div className="text-center py-12 opacity-70">
                                <MessageSquareIcon className="w-6 h-6 mx-auto mb-2" />
                                <p className="text-sm font-medium">No approved templates</p>
                                <p className="text-xs text-muted-foreground">
                                    Check your Meta Business Suite
                                </p>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-6 bg-zinc-950/40 p-3 rounded-xl border border-zinc-800/40">
                        <button
                            onClick={() => setSelectedTemplate(null)}
                            className="p-1.5 rounded-xl border border-zinc-800 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-100 transition-all cursor-pointer"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>

                        <div>
                            <p className="font-bold text-sm text-zinc-100">
                                {selectedTemplate.displayName}
                            </p>
                            <div className="flex gap-2 items-center mt-1">
                                <p className="text-[10px] uppercase text-zinc-400 font-bold tracking-widest">
                                    {selectedTemplate.category}
                                </p>
                                {(selectedTemplate.templateType || "").toLowerCase() === "catalog" && (
                                    <span className="text-[10px] text-purple-500 font-bold uppercase tracking-widest flex items-center gap-1">
                                        <ShoppingBag className="w-3.5 h-3.5" /> Catalog
                                    </span>
                                )}
                                {(selectedTemplate.templateType || "").toLowerCase() === "carousel" && (
                                    <span className="text-[10px] text-pink-500 font-bold uppercase tracking-widest flex items-center gap-1">
                                        <Layers className="w-3.5 h-3.5" /> Carousel
                                    </span>
                                )}
                                {(!selectedTemplate.templateType || (selectedTemplate.templateType || "").toLowerCase() === "standard") && (
                                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest flex items-center gap-1">
                                        Standard
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Preview + Variables */}
                    <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                        {/* Live Preview */}
                        <div>
                            <p className="text-xs font-extrabold uppercase mb-2 text-zinc-400 tracking-widest">
                                Live Preview
                            </p>

                            <div className="rounded-2xl border border-zinc-800 overflow-hidden bg-wa-chat-bg relative group transition-colors duration-300">
                                <div className="absolute inset-0 opacity-[0.4] dark:opacity-[0.08] bg-[url('https://camo.githubusercontent.com/857a221f7c706d8847f9723ec083b063878b2772591f463378b879a838be8194/68747470733a2f2f757365722d696d616765732e67697468756275736572636f6e74656e742e636f6d2f31353037353735392f32383731393134342d38366463306637302d373362312d346334382d393630332d3935303237396532373635382e706e67')] bg-repeat bg-size-[400px]"></div>

                                <div className="relative z-10 p-4 min-h-75 flex flex-col items-start justify-center">
                                    <div className="w-full bg-bubble-inbound-bg rounded-lg rounded-tl-none shadow-md relative overflow-hidden border border-zinc-800/40 transition-colors duration-300">
                                        <div className="p-1">
                                            {/* Header Media */}
                                            {(() => {
                                                const mediaItem = selectedTemplate.media?.find(
                                                    (m) => m.language === selectedTemplate.languages[0].language
                                                );
                                                if (mediaItem?.s3Url) {
                                                    return (
                                                        <div className="rounded-xl overflow-hidden bg-black/5 in-[.dark]:bg-black/40 min-h-35 relative group flex items-center justify-center">
                                                            {selectedTemplate.languages[0].headerType === "VIDEO" ? (
                                                                <video
                                                                    src={mediaItem.s3Url}
                                                                    className="w-full h-full object-contain"
                                                                    controls
                                                                />
                                                            ) : (
                                                                <img
                                                                    src={mediaItem.s3Url}
                                                                    alt="Header"
                                                                    className="w-full h-full object-contain"
                                                                />
                                                            )}
                                                        </div>
                                                    );
                                                }
                                                if (
                                                    ["IMAGE", "VIDEO", "DOCUMENT"].includes(
                                                        selectedTemplate.languages[0].headerType
                                                    )
                                                ) {
                                                    return (
                                                        <div className="min-h-35 bg-zinc-900/60 flex flex-col items-center justify-center rounded-xl text-zinc-400 text-[10px] font-bold uppercase tracking-wider border border-zinc-800/40">
                                                            <ImageIcon className="w-6 h-6 mb-2 opacity-35 text-zinc-400" />
                                                            {selectedTemplate.languages[0].headerType} MEDIA
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}

                                            {/* Header Text */}
                                            {selectedTemplate.languages[0]?.headerType === "TEXT" &&
                                                selectedTemplate.languages[0]?.headerText && (
                                                    <p className="font-bold text-[14px] pt-2 px-3 text-bubble-inbound-text leading-tight">
                                                        {selectedTemplate.languages[0].headerText}
                                                    </p>
                                                )}
                                        </div>

                                        <div className="px-3 pt-1 pb-3 text-[13px] leading-snug text-bubble-inbound-text whitespace-pre-wrap font-sans">
                                            {(() => {
                                                let body = selectedTemplate.languages[0]?.body || "";
                                                templateVariables.forEach((val, idx) => {
                                                    body = body.replace(
                                                        `{{${idx + 1}}}`,
                                                        val || `{{${idx + 1}}}`
                                                    );
                                                });
                                                return body;
                                            })()}

                                            {selectedTemplate.languages[0]?.footerText && (
                                                <p className="mt-1.5 text-[11px] text-bubble-inbound-meta font-semibold border-t border-zinc-800/40 pt-1.5">
                                                    {selectedTemplate.languages[0].footerText}
                                                </p>
                                            )}
                                        </div>

                                        {/* Buttons */}
                                        {selectedTemplate.buttons && selectedTemplate.buttons.length > 0 && (
                                            <div className="border-t border-zinc-800/40 flex flex-col divide-y divide-zinc-800/40 bg-zinc-950/25">
                                                {selectedTemplate.buttons.map((btn, idx) => (
                                                    <button
                                                        key={idx}
                                                        className="p-2.5 text-center text-[13px] font-bold text-accent flex items-center justify-center gap-2 hover:bg-zinc-850/50 transition-colors cursor-pointer"
                                                    >
                                                        {btn.type === "URL" ? (
                                                            <Globe className="w-3.5 h-3.5" />
                                                        ) : btn.type === "PHONE_NUMBER" ? (
                                                            <Phone className="w-3.5 h-3.5" />
                                                        ) : (
                                                            <MessageSquareIcon className="w-3.5 h-3.5" />
                                                        )}
                                                        {btn.text}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Carousel Cards Preview */}
                        {(selectedTemplate.templateType === "carousel" || (selectedTemplate.carouselCards && selectedTemplate.carouselCards.length > 0)) && (
                            <div className="flex overflow-x-auto gap-2 py-2 mt-1 snap-x scrollbar-thin scrollbar-thumb-gray-600/50">
                                {(selectedTemplate.carouselCards || []).map((card, idx) => (
                                    <div key={idx} className="shrink-0 w-50 bg-wa-inbound rounded-lg overflow-hidden shadow-sm border border-border/50 snap-center flex flex-col">
                                        {/* Content Area */}
                                        <div className="p-3">
                                            {card.s3Url && (
                                                <div className="h-28 w-full relative mb-3 rounded-lg overflow-hidden bg-muted">
                                                    {card.mimeType?.startsWith('video') ? (
                                                        <video src={card.s3Url} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <img src={card.s3Url} alt="" className="w-full h-full object-cover" />
                                                    )}
                                                </div>
                                            )}
                                            <p className="font-bold text-sm text-foreground line-clamp-1 mb-1">{idx + 1}. {card.title || "No Title"}</p>
                                            <p className="text-xs text-muted-foreground line-clamp-2">{card.subtitle || "No subtitle available"}</p>
                                        </div>

                                        {/* Button */}
                                        {(card.buttonText || card.buttonValue) && (
                                            <div className="border-t border-border/30 py-2.5 text-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">
                                                <span className="text-sm text-[#0084ff] dark:text-[#53bdeb] font-semibold">{card.buttonText || "View Details"}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        {/* Variables */}
                        {templateVariables.length > 0 && (
                            <div className="space-y-4">
                                <p className="text-xs font-extrabold uppercase text-zinc-400 tracking-widest">
                                    Personalize Variables
                                </p>

                                {templateVariables.map((val, idx) => (
                                    <input
                                        key={idx}
                                        type="text"
                                        value={val}
                                        onChange={(e) => {
                                            const next = [...templateVariables];
                                            next[idx] = e.target.value;
                                            setTemplateVariables(next);
                                        }}
                                        placeholder={`Enter value for {{${idx + 1}}}`}
                                        className="w-full px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 placeholder:text-zinc-650 focus:outline-none focus:border-accent/40 text-sm transition-all"
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="mt-4 pt-4 border-t border-zinc-800 flex gap-3">
                        <button
                            onClick={() => setSelectedTemplate(null)}
                            className="flex-1 py-3 rounded-xl btn-secondary text-sm font-bold cursor-pointer"
                        >
                            Cancel
                        </button>

                        <button
                            onClick={handleSendClick}
                            disabled={isSendingTemplate}
                            className="flex-2 py-3 rounded-xl btn-primary text-sm font-bold disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {isSendingTemplate ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    Send Template
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
