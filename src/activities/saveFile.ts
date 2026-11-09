/**
 * Entrega o conteúdo ao navegador como um download com o nome original. O endereço temporário é
 * liberado logo depois do clique, num adiamento: alguns navegadores cancelam o download se ele
 * for liberado no mesmo instante.
 */
export function saveFile(content: Blob, fileName: string): void {
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
