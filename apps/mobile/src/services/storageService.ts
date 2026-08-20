import { supabase } from '../lib/supabase';

export class RooServStorageService {
  /**
   * Faz upload de uma imagem para o Supabase Storage ou retorna Base64 em caso de indisponibilidade
   */
  public static async uploadImage(
    file: File,
    folder: 'avatars' | 'requests' | 'proofs' = 'requests'
  ): Promise<string> {
    const fileName = `${folder}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    try {
      // 1. Tenta upload no Supabase Storage
      const { error } = await supabase.storage
        .from('rooserv-media')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (!error) {
        const { data: publicData } = supabase.storage
          .from('rooserv-media')
          .getPublicUrl(fileName);

        if (publicData?.publicUrl) {
          return publicData.publicUrl;
        }
      }
    } catch {
      // Fallback silencioso
    }

    // 2. Fallback resiliente para Base64 Data URL
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          resolve('');
        }
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }
}
