import React from 'react';

interface UserAvatarProps {
  src?: string;
  name?: string;
  className: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ src, name, className }) => {
  const label = name?.trim() || 'Usuário';
  if (src) {
    return <img src={src} alt={label} className={className} referrerPolicy="no-referrer" />;
  }

  return (
    <div
      role="img"
      aria-label={`Avatar de ${label}`}
      className={`bg-brand-100 text-brand-800 flex items-center justify-center font-black ${className}`}
    >
      {label.charAt(0).toUpperCase()}
    </div>
  );
};
