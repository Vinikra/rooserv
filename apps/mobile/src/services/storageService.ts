import { supabase } from '../lib/supabase';

export class RooServStorageService {
  private static validateImage(file: File) {
    if (!file.type.startsWith('image/')) throw new Error('Selecione um arquivo de imagem válido.');
    if (file.size > 8 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 8 MB.');
  }

  /** Faz upload autenticado. Falhas nunca viram Data URL ou sucesso local. */
  public static async uploadImage(
    file: File,
    folder: 'avatars' | 'requests' | 'proofs' = 'requests'
  ): Promise<string> {
    this.validateImage(file);

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error('Faça login antes de enviar imagens.');

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${folder}/${authData.user.id}/${crypto.randomUUID()}_${safeName}`;
    const { error } = await supabase.storage
      .from('rooserv-media')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });
    if (error) throw new Error(`Não foi possível enviar a imagem: ${error.message}`);

    const { data: publicData } = supabase.storage.from('rooserv-media').getPublicUrl(fileName);
    if (!publicData?.publicUrl) throw new Error('O armazenamento não retornou a URL da imagem.');

    return publicData.publicUrl;
  }

  public static async uploadKycDocument(
    file: File,
    kind: 'id-front' | 'id-back' | 'selfie'
  ): Promise<string> {
    this.validateImage(file);
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error('Confirme seu e-mail e faça login antes de enviar documentos.');

    const extension = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
    const path = `${authData.user.id}/${kind}-${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage
      .from('rooserv-kyc')
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) throw new Error(`Não foi possível enviar o documento: ${error.message}`);
    return path;
  }
}
