import { Plugin } from "obsidian";

export function registerImageCropRenderer(plugin: Plugin) {
  const CROP_PATTERN = /^(\d+)x(\d+)_Shift(\d+)x(\d+)$/;

  async function processEmbed(embed: HTMLElement) {
    if (embed.hasAttribute('data-cropper-processed')) return;

    const alt = embed.getAttribute('alt') || '';
    const match = alt.match(CROP_PATTERN);
    if (!match) return;

    const [, h, w, dy, dx] = match;
    const height = parseInt(h, 10);
    const width = parseInt(w, 10);
    const offsetY = parseInt(dy, 10);
    const offsetX = parseInt(dx, 10);

    const img = embed.querySelector<HTMLImageElement>('img');
    if (!img) return;
    const url = img.src;

    await img.decode().catch(() => {});
    const originalWidth = img.naturalWidth;
    const originalHeight = img.naturalHeight;

    // Превращаем контейнер в область для показа кропа
    Object.assign(embed.style, {
      width: `${width}px`,
      height: `${height}px`,
      overflow: 'hidden',
      position: 'relative'
    });

    // Клонируем изображение и позиционируем
    const clone = img.cloneNode(true) as HTMLImageElement;
    Object.assign(clone.style, {
      position: 'absolute',
      width: `${originalWidth}px`,
      height: `${originalHeight}px`,
      left: `-${offsetX}px`,
      top: `-${offsetY}px`,
      maxWidth: 'none',
      maxHeight: 'none'
    });

    img.style.display = 'none';
    embed.appendChild(clone);
    embed.setAttribute('data-cropper-processed', 'true');

    clone.addEventListener('mouseenter', () => {
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

      clone.addEventListener('mouseleave', () => preview.remove(), { once: true });
    });
  }

  // Основная функция перерендеринга
  const runProcessing = () => {
    document
      .querySelectorAll<HTMLElement>('.internal-embed.media-embed.image-embed.is-loaded')
      .forEach(embed => {
        processEmbed(embed);
      });
  };

  // Экспортируем функцию на экземпляр плагина
  (plugin as any).processImageCrop = runProcessing;

  // Подписки на события
  plugin.registerEvent(
    plugin.app.workspace.on('layout-change', runProcessing)
  );
  plugin.registerEvent(
    plugin.app.workspace.on('active-leaf-change', runProcessing)
  );

  // Наблюдатель за DOM
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of Array.from(m.addedNodes)) {
        if (node instanceof HTMLElement && node.matches('.internal-embed.media-embed.image-embed.is-loaded')) {
          processEmbed(node);
        } else if (node instanceof HTMLElement) {
          node
            .querySelectorAll<HTMLElement>('.internal-embed.media-embed.image-embed.is-loaded')
            .forEach(embed => processEmbed(embed));
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
