import { describe, expect, it } from 'vitest';
import { formatFileSize } from './fileSize';

describe('formatFileSize', () => {
  it('escreve bytes, KB, MB e GB com uma casa e vírgula', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(1023)).toBe('1023 B');
    expect(formatFileSize(1024)).toBe('1,0 KB');
    expect(formatFileSize(1536)).toBe('1,5 KB');
    expect(formatFileSize(3 * 1024 * 1024)).toBe('3,0 MB');
    expect(formatFileSize(5 * 1024 ** 3)).toBe('5,0 GB');
  });

  it('não derruba a tela diante de um valor inválido', () => {
    expect(formatFileSize(-1)).toBe('tamanho indisponível');
    expect(formatFileSize(Number.NaN)).toBe('tamanho indisponível');
  });
});
