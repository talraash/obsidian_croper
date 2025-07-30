import { Plugin } from "obsidian";

/**
 * Registers a renderer to process cropped images in Live Preview and Preview modes.
 */
export function registerImageCropRenderer(plugin: Plugin) {
  // Updated pattern to match new crop format: height x width_ShiftYxX[_ScaleZ]
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

    // Apply container styles with scaling
    Object.assign(embed.style, {
      width: `${width * scale}px`,
      height: `${height * scale}px`,
      overflow: 'hidden',
      position: 'relative',
      display: 'inline-block',
      maxWidth: '100%'
    });

    // Create cropped image clone
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

    // Add hover preview functionality with improved cleanup
    let preview: HTMLDivElement | null = null;
    let cleanupListener: (() => void) | null = null;

    const createPreview = () => {
      if (preview) return;
      
      preview = document.createElement('div');
      Object.assign(preview.style, {
        position: 'fixed',
        top: '10px',
        right: '10px',
        zIndex: '9999',
        border: '1px solid var(--background-modifier-border)',
        background: 'var(--background-primary)',
        padding: '5px',
        borderRadius: '4px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
      });
      
      const full = document.createElement('img');
      full.src = url;
      full.style.maxWidth = 'min(80vw, 400px)';
      full.style.maxHeight = '60vh';
      full.style.display = 'block';
      
      preview.appendChild(full);
      document.body.appendChild(preview);

      // Global mouse move handler to track cursor position
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
      
      if (cleanupListener) {
        cleanupListener();
        cleanupListener = null;
      }
    };

    embed.addEventListener('mouseenter', createPreview);
    embed.addEventListener('mouseleave', () => {
      // Don't remove immediately - let global handler decide
    });
  }

  function runProcessing() {
    document.querySelectorAll<HTMLElement>('.internal-embed.media-embed.image-embed.is-loaded').forEach(embed => {
      processEmbed(embed).catch(e => console.error('Image processing failed', e));
    });
  }

  // Expose processing function for modal
  (plugin as any).processImageCrop = runProcessing;

  // Register workspace events
  plugin.registerEvent(
    plugin.app.workspace.on('layout-change', runProcessing)
  );
  
  plugin.registerEvent(
    plugin.app.workspace.on('active-leaf-change', runProcessing)
  );

  // Add mutation observer for dynamic content
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          // Process single embedded image
          if (node.matches('.internal-embed.media-embed.image-embed.is-loaded')) {
            processEmbed(node).catch(e => console.error('Mutation processing failed', e));
          }
          
          // Process nested images
          const embeds = node.querySelectorAll<HTMLElement>('.internal-embed.media-embed.image-embed.is-loaded');
          for (const embed of embeds) {
            processEmbed(embed).catch(e => console.error('Nested processing failed', e));
          }
        }
      }
    }
  });
  
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
}