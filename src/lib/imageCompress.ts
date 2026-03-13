/**
 * 이미지 파일을 압축합니다. PDF는 그대로 반환합니다.
 * @param file 원본 파일
 * @param maxWidth 최대 너비 (px)
 * @param quality JPEG 품질 (0~1)
 */
export async function compressImage(file: File, maxWidth = 1200, quality = 0.75): Promise<File> {
  if (file.type === 'application/pdf') return file;
  if (!file.type.startsWith('image/')) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
          resolve(compressed);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
