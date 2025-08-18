import { Plugin } from "obsidian";
import { ImageCropPluginInterface } from "./types";

export function registerImageCropRenderer(plugin: ImageCropPluginInterface) {
  const CROP_PATTERN = /^(\d+)x(\d+)_Shift(\d+)x(\d+)(?:_Scale([0-9.]+))?$/;

  async function processEmbed(embed: HTMLElement) {
    if (embed.hasAttribute('data-cropper-processed')) return;

    const alt = embed.getAttribute('alt') || '';
    const match = alt.match(CROP_PATTERN);
    if (!match) return;

    const [, heightStr, widthStr, offsetYStr, offsetXStr, scaleStr] = match;
    const height = parseInt(heightStr, 10);
    const width = parseInt(widthStr, 10);
    const offsetY = parseInt(offsetYStr, 10);
    const offsetX = parseInt(offsetXStr, 10);
    const scale = scaleStr ? parseFloat(scaleStr) : 1;

    const img = embed.querySelector<HTMLImageElement>('img');
    if (!img) return;
    const url = img.src;
    
    try {
      await img.decode();
    } catch (e) {
      console.error("Image decoding failed", e);
      return;
    }
    
    const originalWidth = img.naturalWidth;
    const originalHeight = img.naturalHeight;

    embed.classList.add("image-crop-embed");
    embed.style.width = `${width * scale}px`;
    embed.style.height = `${height * scale}px`;

    // Create a clone of the image with the specified crop
    const clone = document.createElement('img');
    clone.src = url;
    clone.classList.add("image-crop-clone");
    Object.assign(clone.style, {
      width: `${originalWidth * scale}px`,
      height: `${originalHeight * scale}px`,
      left: `-${offsetX * scale}px`,
      top: `-${offsetY * scale}px`,
    });

    img.style.display = 'none';
    embed.appendChild(clone);
    embed.setAttribute('data-cropper-processed', 'true');

    // Hover preview functionality
    if (plugin.settings.showPreviewOnHover) {
      let preview: HTMLDivElement | null = null;
      let cleanupListener: (() => void) | null = null;

      const createPreview = () => {
        if (preview) return;
        
        preview = document.createElement('div');
        preview.classList.add("image-crop-preview-box");
        
        const full = document.createElement('img');
        full.src = url;
        full.classList.add("image-crop-preview-img-full");
        
        preview.appendChild(full);
        document.body.appendChild(preview);

        const globalMouseHandler = (e: MouseEvent) => {
          if (!preview) return;
          
          const hoveredElement = document.elementFromPoint(e.clientX, e.clientY);
          const shouldPersist = hoveredElement === preview || 
                              hoveredElement === embed || 
                              embed.contains(hoveredElement);
          
          if (!shouldPersist) {
            removePreview();
          }
        };

        document.addEventListener('mousemove', globalMouseHandler);
        cleanupListener = () => {
          document.removeEventListener('mousemove', globalMouseHandler);
        };
      };

      const removePreview = () => {
        if (preview && preview.isConnected) {
          document.body.removeChild(preview);
        }
        preview = null;
        cleanupListener?.();
      };

      embed.addEventListener('mouseenter', createPreview);
      embed.addEventListener('mouseleave', () => {});
    }
  }

  function runProcessing() {
    document.querySelectorAll<HTMLElement>('.internal-embed.media-embed.image-embed.is-loaded').forEach(embed => {
      processEmbed(embed).catch(e => console.error('Image processing failed', e));
    });
  }

  plugin.processImageCrop = runProcessing;

  plugin.registerEvent(
    plugin.app.workspace.on('layout-change', runProcessing)
  );
  
  plugin.registerEvent(
    plugin.app.workspace.on('active-leaf-change', runProcessing)
  );

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (node instanceof HTMLElement) {
          if (node.matches('.internal-embed.media-embed.image-embed.is-loaded')) {
            processEmbed(node).catch(e => console.error('Mutation processing failed', e));
          }
          
          node.querySelectorAll<HTMLElement>('.internal-embed.media-embed.image-embed.is-loaded').forEach(embed => {
            processEmbed(embed).catch(e => console.error('Nested processing failed', e));
          });
        }
      }
    }
  });
  
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
}
