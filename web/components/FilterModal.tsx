"use client";

import React from "react";
import { X, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Community {
  id: string;
  name: string;
}

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  communities: Community[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export const FilterModal = ({
  isOpen,
  onClose,
  communities,
  selectedIds,
  onToggle,
  onSelectAll,
  onDeselectAll,
}: FilterModalProps) => {
  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            className="relative w-full max-w-md z-[10000]"
          >
            <div className="bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">커뮤니티 필터</h2>
                  <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Community Filter</p>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-white/5 rounded-full text-zinc-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6">
                <div className="flex gap-2 mb-6">
                  <button 
                    onClick={onSelectAll}
                    className="flex-1 py-2 text-xs font-bold bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all"
                  >
                    모두 선택
                  </button>
                  <button 
                    onClick={onDeselectAll}
                    className="flex-1 py-2 text-xs font-bold bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all"
                  >
                    모두 해제
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                  {communities.map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => onToggle(item.id)}
                        className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                          isSelected 
                            ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400" 
                            : "bg-white/5 border-white/5 text-zinc-400 hover:border-white/10 hover:text-zinc-200"
                        }`}
                      >
                        <span className="text-sm font-medium">{item.name}</span>
                        {isSelected && (
                          <div className="bg-indigo-500 rounded-full p-0.5">
                            <Check size={12} className="text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-6 bg-white/5 border-t border-white/5">
                <button 
                  onClick={onClose}
                  className="w-full py-3.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98]"
                >
                  적용하기
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
