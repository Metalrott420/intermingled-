import { useState, useEffect } from "react";
import { Sparkles, HelpCircle, X, Check, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface TutorialStep {
  icon: any;
  headline: string;
  description: string;
}

export interface FeatureTutorialModalProps {
  featureId: string;
  featureTitle: string;
  badgeLabel?: string;
  steps: TutorialStep[];
  isOpen?: boolean;
  onClose?: () => void;
}

export default function FeatureTutorialModal({
  featureId,
  featureTitle,
  badgeLabel = "FEATURE TUTORIAL 💡",
  steps,
  isOpen: externalIsOpen,
  onClose: externalOnClose,
}: FeatureTutorialModalProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    if (externalIsOpen !== undefined) {
      setInternalIsOpen(externalIsOpen);
      return;
    }

    // Check if onboarding tutorials master toggle is enabled (defaults to true)
    const tutorialsEnabled = localStorage.getItem("intermingled_tutorials_enabled") !== "false";
    const hasSeenTutorial = localStorage.getItem(`intermingled_tutorial_seen_${featureId}`) === "true";

    if (tutorialsEnabled && !hasSeenTutorial) {
      setInternalIsOpen(true);
    }
  }, [featureId, externalIsOpen]);

  const handleClose = (disableAll = false) => {
    if (disableAll) {
      localStorage.setItem("intermingled_tutorials_enabled", "false");
    }
    localStorage.setItem(`intermingled_tutorial_seen_${featureId}`, "true");

    setInternalIsOpen(false);
    if (externalOnClose) externalOnClose();
  };

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      handleClose(false);
    }
  };

  if (!internalIsOpen) return null;

  const currentStep = steps[currentStepIndex] || steps[0];
  const StepIcon = currentStep.icon || Sparkles;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4">
      <div className="bg-[#111218] border-2 border-[#d4af37] rounded-3xl max-w-md w-full p-6 text-center space-y-5 shadow-[0_0_60px_rgba(212,175,55,0.4)] relative overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#d4af37] via-[#f59e0b] to-[#e5c158]" />

        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-[#d4af37]/30 pb-3">
          <div className="flex items-center gap-2">
            <Badge className="bg-[#d4af37] text-black font-black uppercase text-[10px]">
              {badgeLabel}
            </Badge>
            <span className="text-xs font-mono text-slate-300 font-bold">
              STEP {currentStepIndex + 1} OF {steps.length}
            </span>
          </div>
          <button onClick={() => handleClose(false)} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Feature Title */}
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider">
            {featureTitle}
          </h2>
          <div className="w-16 h-1 bg-[#d4af37] rounded-full mx-auto" />
        </div>

        {/* Step Visual Card */}
        <div className="bg-[#181a24] border border-[#d4af37]/40 rounded-2xl p-5 space-y-3 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-[#d4af37]/15 border border-[#d4af37] flex items-center justify-center mx-auto text-[#d4af37] shadow-lg">
            <StepIcon size={28} />
          </div>
          <h3 className="text-base font-bold text-white uppercase">
            {currentStep.headline}
          </h3>
          <p className="text-xs text-slate-200 leading-relaxed font-sans">
            {currentStep.description}
          </p>
        </div>

        {/* Progress indicators */}
        <div className="flex justify-center gap-1.5 pt-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentStepIndex ? "w-8 bg-[#d4af37]" : "w-2 bg-[#222538]"
              }`}
            />
          ))}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          <Button
            onClick={handleNext}
            className="w-full py-3.5 bg-gradient-to-r from-[#d4af37] via-[#f59e0b] to-[#e5c158] hover:from-[#b5952f] hover:to-[#d97706] text-black font-black uppercase text-xs tracking-wider shadow-lg shadow-[#d4af37]/25"
          >
            {currentStepIndex < steps.length - 1 ? (
              <><span>Next Step</span> <ArrowRight size={14} className="ml-1" /></>
            ) : (
              <><span>Got It! Start Exploring 🚀</span> <Check size={14} className="ml-1" /></>
            )}
          </Button>

          <button
            onClick={() => handleClose(true)}
            className="text-[10px] font-mono text-slate-400 hover:text-[#d4af37] transition-colors py-1 block mx-auto"
          >
            Don't show onboarding tutorials again
          </button>
        </div>
      </div>
    </div>
  );
}
