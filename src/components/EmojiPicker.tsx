import EmojiPickerReact, { EmojiClickData, Theme } from 'emoji-picker-react';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onEmojiSelect, onClose }: EmojiPickerProps) {
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiSelect(emojiData.emoji);
    onClose();
  };

  return (
    <div className="absolute bottom-full right-0 mb-2 z-50">
      <div
        className="fixed inset-0"
        onClick={onClose}
      />
      <div className="relative">
        <EmojiPickerReact
          onEmojiClick={handleEmojiClick}
          theme={Theme.DARK}
          searchPlaceHolder="Search emoji..."
          width={350}
          height={400}
          previewConfig={{ showPreview: false }}
        />
      </div>
    </div>
  );
}
