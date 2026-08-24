import { supabase } from '../lib/supabase';

export class RooServStorageService {
  private static readonly PRIVATE_PREFIX = 'private:';

  private static validateImage(file: File) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) throw new Error('Use uma imagem JPG, PNG ou WebP.');
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
    const bucket = folder === 'avatars' ? 'rooserv-public-media' : 'rooserv-private-media';
    const { error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, { cacheControl: '3600', upsert: false });
    if (error) throw new Error(`Não foi possível enviar a imagem: ${error.message}`);

    if (bucket === 'rooserv-private-media') {
      return `${this.PRIVATE_PREFIX}${fileName}`;
    }

    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(fileName);
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

  public static async removeKycDocuments(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const { error } = await supabase.storage.from('rooserv-kyc').remove(paths);
    if (error) console.error('[RooServStorageService] Falha ao limpar documentos incompletos:', error.message);
  }

  public static async removePrivateImages(references: string[]): Promise<void> {
    if (references.length === 0) return;
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error('Faça login para remover imagens.');

    const ownerPattern = new RegExp(`^(requests|proofs)/${authData.user.id}/`, 'i');
    const paths = references.map((reference) => {
      if (!reference.startsWith(this.PRIVATE_PREFIX)) throw new Error('Referência de imagem inválida.');
      const path = reference.slice(this.PRIVATE_PREFIX.length);
      if (!ownerPattern.test(path) || path.includes('..')) throw new Error('Você não pode remover esta imagem.');
      return path;
    });

    const { error } = await supabase.storage.from('rooserv-private-media').remove(paths);
    if (error) throw new Error(`Não foi possível remover a imagem: ${error.message}`);
  }

  public static async resolveImageUrl(reference: string): Promise<string> {
    if (!reference.startsWith(this.PRIVATE_PREFIX)) return reference;

    const path = reference.slice(this.PRIVATE_PREFIX.length);
    if (!path || path.includes('..') || !/^(requests|proofs)\/[0-9a-f-]{36}\//i.test(path)) {
      throw new Error('Referência de imagem privada inválida.');
    }

    const { data, error } = await supabase.storage
      .from('rooserv-private-media')
      .createSignedUrl(path, 300);
    if (error || !data?.signedUrl) throw new Error('Imagem privada indisponível.');
    return data.signedUrl;
  }
}
