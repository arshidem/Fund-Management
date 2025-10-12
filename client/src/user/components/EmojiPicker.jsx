import React from 'react';
import { Picker } from 'emoji-mart';
import 'emoji-mart/css/emoji-mart.css';

export const EmojiPicker = ({ onEmojiSelect, onClose }) => {
  return (
    <div className="relative">
      <div className="absolute bottom-2">
        <Picker
          onSelect={onEmojiSelect}
          showPreview={false}
          showSkinTones={false}
          theme="light"
        />
      </div>
      <div
        className="fixed inset-0 z-10"
        onClick={onClose}
      />
    </div>
  );
};