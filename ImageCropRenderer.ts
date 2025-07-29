import { Plugin } from "obsidian";

/**
 * Registers a renderer to process cropped images in Live Preview and Preview modes.
 */
export function registerImageCropRenderer(plugin: Plugin) {
  const CROP_PATTERN = /^(\d+)x(\d+)_Shift(\d+)x(\d+)(?:_Scale([0-9.]+))?$/;

  async function processEmbed(embed: HTMLElement) {
    if (embed.hasAttribute('data-cropper-processed')) return;

    const alt = embed.getAttribute('alt') || '';
    const match = alt.match(CROP_PATTERN);
    if (!match) return;

    const [, h, w, dy, dx, scaleStr] = match;
    const height = parseInt(h, 10);
    const width = parseInt(w, 10);
    const offsetY = parseInt(dy, 10);
    const offsetX = parseInt(dx, 10);
    const scale = scaleStr ? parseFloat(scaleStr) : 1;

    const img = embed.querySelector<HTMLImageElement>('img');
    if (!img) return;
    const url = img.src;
    await img.decode().catch(() => {});
    const originalWidth = img.naturalWidth;
    const originalHeight = img.naturalHeight;

    // Container dimensions scaled by 'scale' factor
    Object.assign(embed.style, {
      width: `${width * scale}px`,
      height: `${height * scale}px`,
      overflow: 'hidden',
      position: 'relative',
      display: 'inline-block'
    });

    // Create clone with cropping and scaling
    const clone = document.createElement('img');
    clone.src = url;
    Object.assign(clone.style, {
      position: 'absolute',
      width: `${originalWidth * scale}px`,
      height: `${originalHeight * scale}px`,
      left: `-${offsetX * scale}px`,
      top: `-${offsetY * scale}px`,
      maxWidth: 'none',
      maxHeight: 'none'
    });

    img.style.display = 'none';
    embed.appendChild(clone);
    embed.setAttribute('data-cropper-processed', 'true');

    // Hover preview of full image
    embed.addEventListener('mouseenter', () => {
      const preview = document.createElement('div');
      Object.assign(preview.style, {
        position: 'fixed',
        top: '10px',
        right: '10px',
        zIndex: '9999',
        border: '1px solid #666',
        background: '#fff',
        padding: '5px'
      });
      const full = document.createElement('img');
      full.src = url;
      full.style.maxWidth = '400px';
      preview.appendChild(full);
      document.body.appendChild(preview);

      embed.addEventListener('mouseleave', () => {
        preview.remove();
      }, { once: true });
    });
  }

  function runProcessing() {
    document.querySelectorAll<HTMLElement>('.internal-embed.media-embed.image-embed.is-loaded').forEach(embed => {
      processEmbed(embed);
    });
  }

  // Expose for external calls
  (plugin as any).processImageCrop = runProcessing;

  // Register events
  plugin.registerEvent(
    plugin.app.workspace.on('layout-change', runProcessing)
  );
  plugin.registerEvent(
    plugin.app.workspace.on('active-leaf-change', runProcessing)
  );

  // MutationObserver for dynamic changes
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of Array.from(m.addedNodes)) {
        if (node instanceof HTMLElement) {
          if (node.matches('.internal-embed.media-embed.image-embed.is-loaded')) {
            processEmbed(node);
          }
          node.querySelectorAll<HTMLElement>('.internal-embed.media-embed.image-embed.is-loaded').forEach(embed => processEmbed(embed));
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
