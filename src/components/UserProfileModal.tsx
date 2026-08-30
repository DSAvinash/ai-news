import React, { useEffect, useState } from 'react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  onProfileUpdated
}) => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [savingSkillId, setSavingSkillId] = useState<number | null>(null);

  const fetchProfile = () => {
    setLoading(true);
    fetch('/api/google-skills/users/me/skill-profile?user_id=default_user')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setProfile(json.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOpen) fetchProfile();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpdateProficiency = async (skillId: number, level: string) => {
    setSavingSkillId(skillId);
    try {
      await fetch('/api/google-skills/users/me/skill-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'default_user',
          skill_id: skillId,
          proficiency_level: level,
          followed: 1
        })
      });
      fetchProfile();
      if (onProfileUpdated) onProfileUpdated();
    } catch (e) {
      console.error(e);
    } finally {
      setSavingSkillId(null);
    }
  };

  const levels = ['BEGINNER', 'ELEMENTARY', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">psychology</span>
            <h2 className="text-base font-bold text-on-surface">
              My AI Skills Profile & Gap Targeting
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <p className="text-xs text-on-surface-variant">
            Set your current proficiency level for key AI domains. The Google Skills recommendation engine will automatically detect your skill gaps and curate relevant Google courses to accelerate your mastery.
          </p>

          {loading || !profile ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-16 bg-surface-container-low rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {profile.skills.map((skill: any) => (
                <div
                  key={skill.id}
                  className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-on-surface">{skill.name}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                        Momentum: {skill.momentum_score}/100
                      </span>
                    </div>
                    <div className="text-[11px] text-on-surface-variant mt-0.5">{skill.category}</div>
                  </div>

                  <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                    {levels.map((lvl) => {
                      const isCurrent = (skill.proficiency_level || 'BEGINNER') === lvl;
                      return (
                        <button
                          key={lvl}
                          disabled={savingSkillId === skill.id}
                          onClick={() => handleUpdateProficiency(skill.id, lvl)}
                          className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all capitalize ${
                            isCurrent
                              ? 'bg-primary text-on-primary font-bold shadow-xs'
                              : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                          }`}
                        >
                          {lvl.toLowerCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-outline-variant bg-surface-container-low flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-inverse-surface transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
