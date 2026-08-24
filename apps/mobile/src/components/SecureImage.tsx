import React, { useEffect, useState } from 'react';
import { RooServStorageService } from '../services/storageService';

interface SecureImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string;
  fallbackClassName?: string;
}

export const SecureImage: React.FC<SecureImageProps> = ({ src, alt, fallbackClassName, ...props }) => {
  const [resolvedUrl, setResolvedUrl] = useState(src.startsWith('private:') ? '' : src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);
    setResolvedUrl(src.startsWith('private:') ? '' : src);

    if (src.startsWith('private:')) {
      RooServStorageService.resolveImageUrl(src)
        .then((url) => {
          if (active) setResolvedUrl(url);
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    }

    return () => {
      active = false;
    };
  }, [src]);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt || 'Imagem privada indisponível'}
        className={fallbackClassName || props.className}
      />
    );
  }

  if (!resolvedUrl) {
    return <div aria-hidden="true" className={`${props.className || ''} animate-pulse bg-slate-200`} />;
  }

  return <img {...props} src={resolvedUrl} alt={alt} referrerPolicy="no-referrer" />;
};
