/** @param {import('playwright').Page} page */
export async function installCaptionOverlay(page) {
  await page.addInitScript(() => {
    const ensureOverlay = () => {
      if (document.getElementById('review-demo-recording-caption')) {
        return;
      }
      const el = document.createElement('div');
      el.id = 'review-demo-recording-caption';
      el.setAttribute('data-testid', 'review-demo-recording-caption');
      Object.assign(el.style, {
        position: 'fixed',
        left: '0',
        right: '0',
        bottom: '0',
        zIndex: '2147483647',
        background: 'rgba(9, 9, 11, 0.94)',
        color: '#FAFAFA',
        padding: '18px 28px',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '22px',
        lineHeight: '1.35',
        borderTop: '4px solid #FF6B35',
        pointerEvents: 'none',
      });
      document.body.appendChild(el);
    };

    window.__setReviewDemoRecordingCaption = (primary, secondary) => {
      ensureOverlay();
      const el = document.getElementById('review-demo-recording-caption');
      if (!el) return;
      const secondaryLine = secondary
        ? `<div style="opacity:0.88;font-size:17px;margin-top:8px">${secondary}</div>`
        : '';
      el.innerHTML = `<div>${primary}</div>${secondaryLine}`;
    };
  });
}

/** @param {import('playwright').Page} page */
export async function setRecordingCaption(page, primary, secondary) {
  await page.evaluate(
    ({ primary, secondary }) => {
      window.__setReviewDemoRecordingCaption?.(primary, secondary);
    },
    { primary, secondary }
  );
}
