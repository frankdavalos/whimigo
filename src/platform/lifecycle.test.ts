import { describe, expect, it } from 'vitest';
import { onPageShown } from './lifecycle';

/** Just enough of a document: its visibility, and the event that says it changed. */
function fakeDocument() {
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const become = (state: 'hidden' | 'visible') => {
    doc.visibilityState = state;
    doc.dispatchEvent(new Event('visibilitychange'));
  };
  return { doc: doc as unknown as Document, become };
}

describe('the page being shown again', () => {
  it('is reported each time the page becomes visible after being hidden', () => {
    const { doc, become } = fakeDocument();
    let shown = 0;
    onPageShown(doc, () => (shown += 1));
    become('hidden');
    expect(shown).toBe(0);
    become('visible');
    expect(shown).toBe(1);
    become('hidden');
    become('visible');
    expect(shown).toBe(2);
  });

  it('is not reported while the page stays hidden', () => {
    const { doc, become } = fakeDocument();
    let shown = 0;
    onPageShown(doc, () => (shown += 1));
    become('hidden');
    become('hidden');
    expect(shown).toBe(0);
  });
});
