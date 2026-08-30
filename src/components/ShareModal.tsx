import React, { useState } from 'react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  summary: string;
  url: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  title,
  summary,
  url
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const encodedTitle = encodeURIComponent(title);
  const encodedSummary = encodeURIComponent(summary);
  const shareUrl = url || window.location.href;
  const encodedUrl = encodeURIComponent(shareUrl);
  const shareText = encodeURIComponent(`${title} — via AI Intelligence Radar`);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: summary,
          url: shareUrl
        });
      } catch (err) {
        // User cancelled or share failed
      }
    }
  };

  const platforms = [
    {
      name: 'X (Twitter)',
      icon: 'post_add',
      color: 'bg-black text-white hover:bg-neutral-800',
      href: `https://twitter.com/intent/tweet?text=${shareText}&url=${encodedUrl}`
    },
    {
      name: 'LinkedIn',
      icon: 'work',
      color: 'bg-[#0a66c2] text-white hover:bg-[#084e96]',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
    },
    {
      name: 'WhatsApp',
      icon: 'chat',
      color: 'bg-[#25d366] text-white hover:bg-[#1da851]',
      href: `https://api.whatsapp.com/send?text=${shareText}%20${encodedUrl}`
    },
    {
      name: 'Telegram',
      icon: 'send',
      color: 'bg-[#229ed9] text-white hover:bg-[#1a7eb0]',
      href: `https://t.me/share/url?url=${encodedUrl}&text=${shareText}`
    },
    {
      name: 'Reddit',
      icon: 'forum',
      color: 'bg-[#ff4500] text-white hover:bg-[#cc3700]',
      href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`
    },
    {
      name: 'Email',
      icon: 'mail',
      color: 'bg-surface-container-high text-primary hover:bg-surface-container-highest border border-outline-variant',
      href: `mailto:?subject=${encodedTitle}&body=${shareText}%0A%0A${encodedUrl}`
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl max-w-md w-full p-container-margin shadow-2xl space-y-stack-md relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant pb-stack-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">share</span>
            <h3 className="text-headline-sm font-bold text-primary">Share Intelligence</h3>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-primary transition-colors p-1 rounded-full hover:bg-surface-container-low"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Title preview */}
        <div className="p-3 bg-surface-container-low border border-outline-variant rounded-lg">
          <h4 className="text-body-sm font-bold text-primary line-clamp-2">{title}</h4>
          <p className="text-metadata-sm text-on-surface-variant line-clamp-1 mt-0.5">{shareUrl}</p>
        </div>

        {/* Platform Share Buttons */}
        <div className="grid grid-cols-2 gap-2">
          {platforms.map((platform) => (
            <a
              key={platform.name}
              href={platform.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`p-3 rounded-lg flex items-center gap-2 text-body-sm font-medium transition-all shadow-sm ${platform.color}`}
            >
              <span className="material-symbols-outlined text-sm">{platform.icon}</span>
              <span>{platform.name}</span>
            </a>
          ))}
        </div>

        {/* Native Mobile Share & Copy Link */}
        <div className="space-y-2 pt-2 border-t border-outline-variant">
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              onClick={handleNativeShare}
              className="w-full py-2 bg-secondary text-white rounded-lg text-body-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary transition-colors"
            >
              <span className="material-symbols-outlined text-sm">ios_share</span>
              Share via System App
            </button>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm font-mono-label text-on-surface-variant select-all focus:outline-none"
            />
            <button
              onClick={handleCopy}
              className={`px-4 py-2 rounded-lg text-body-sm font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                copied
                  ? 'bg-green-600 text-white'
                  : 'bg-primary text-white hover:bg-inverse-surface'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {copied ? 'check' : 'content_copy'}
              </span>
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
