import { App, Modal, TFile, Notice, Vault, MarkdownView, Plugin } from "obsidian";

interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

export class CropModal extends Modal {
  private scaleInput!: HTMLInputElement;
  private selectedFile: TFile | null = null;
  private zoomLevel: number = 1.0;

  constructor(
    private plugin: Plugin,
    app: App,
    private file: TFile,
    private view: MarkdownView,
    private vault: Vault
  ) {
    super(app);
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Select image to crop" });

    // Search input for filtering images
    const searchInput = contentEl.createEl("input", {
      type: "text",
      placeholder: "Search images...",
      cls: "image-crop-search"
    }) as HTMLInputElement;
    searchInput.style.width = "100%";
    searchInput.style.marginBottom = "10px";

    // Main container for images and preview
    const container = contentEl.createDiv({ cls: "image-crop-container" }) as HTMLDivElement;
    container.style.display = "flex";
    container.style.gap = "20px";

    // List of images
    const listContainer = container.createDiv({ cls: "image-crop-list" }) as HTMLDivElement;
    listContainer.style.flex = "1";
    listContainer.style.maxHeight = "400px";
    listContainer.style.overflowY = "auto";

    // Preview for selected image
    const previewContainer = container.createDiv({ cls: "image-crop-preview" }) as HTMLDivElement;
    previewContainer.style.flex = "1";
    previewContainer.style.display = "flex";
    previewContainer.style.flexDirection = "column";
    previewContainer.style.alignItems = "center";

    previewContainer.createEl("h3", { text: "Preview" });
    const imgPreview = previewContainer.createEl("img", {
      attr: { id: "image-crop-preview-img" }
    }) as HTMLImageElement;
    imgPreview.style.maxWidth = "100%";
    imgPreview.style.maxHeight = "300px";

    // Get all image files in the vault
    const imageFiles = this.app.vault.getFiles().filter(f => {
      const ext = f.extension ? f.extension.toLowerCase() : "";
      return ["png", "jpg", "jpeg", "webp", "gif", "bmp", "tiff", "svg"].includes(ext);
    });

    // Render the list of images
    const renderList = (filter: string = "") => {
      listContainer.empty();
      const filtered = imageFiles.filter(file => 
        file.name.toLowerCase().includes(filter.toLowerCase())
      );

      if (filtered.length === 0) {
        listContainer.createDiv({ 
          text: "No images found", 
          cls: "image-crop-no-results"
        });
        return;
      }

      filtered.forEach(file => {
        const item = listContainer.createDiv({
          text: file.name,
          cls: "image-crop-item"
        }) as HTMLDivElement;
        item.style.cursor = "pointer";
        item.style.padding = "5px";
        item.style.borderBottom = "1px solid var(--background-modifier-border)";

        item.onclick = async () => {
          // Clear previous selection
          const items = listContainer.querySelectorAll(".image-crop-item") as NodeListOf<HTMLDivElement>;
          items.forEach(el => {
            el.style.backgroundColor = "";
          });
          item.style.backgroundColor = "var(--background-modifier-hover)";

          // Load and display the selected image
          try {
            const arrayBuffer = await this.vault.readBinary(file);
            const blob = new Blob([arrayBuffer]);
            const url = URL.createObjectURL(blob);
            imgPreview.src = url;
            this.selectedFile = file;
          } catch (error) {
            console.error("Error loading image preview:", error);
            new Notice("Failed to load image preview");
          }
        };
      });
    };

    // Initial render of the image list
    renderList();

    // Search functionality
    searchInput.addEventListener("input", (e) => {
      const value = (e.target as HTMLInputElement).value;
      renderList(value);
    });

    // Buttons for next and cancel
    const buttonContainer = contentEl.createDiv({ cls: "image-crop-buttons" }) as HTMLDivElement;
    buttonContainer.style.marginTop = "15px";
    buttonContainer.style.display = "flex";
    buttonContainer.style.gap = "10px";

    const nextBtn = buttonContainer.createEl("button", { text: "Next" }) as HTMLButtonElement;
    nextBtn.disabled = true;
    
    const cancelBtn = buttonContainer.createEl("button", { 
      text: "Cancel"
    }) as HTMLButtonElement;

    // Next button should be disabled until an image is selected
    imgPreview.addEventListener("load", () => {
      nextBtn.disabled = false;
    });

    // Button click handlers
    nextBtn.onclick = () => {
      if (this.selectedFile) {
        this.openCropInterface(this.selectedFile, this.selectedFile.name);
      }
    };

    cancelBtn.onclick = () => this.close();
  }

    private async openCropInterface(imgFile: TFile, rawLink: string) {
      const arrayBuffer = await this.vault.readBinary(imgFile);
      const blob = new Blob([arrayBuffer]);
      const url = URL.createObjectURL(blob);

      const img = new Image();
      img.src = url;
      await img.decode();

      this.contentEl.empty();
      this.contentEl.createEl("h2", { text: rawLink });

      // Canvas container for cropping
      const canvasContainer = this.contentEl.createDiv({
          cls: "image-crop-canvas-container"
      }) as HTMLDivElement;
      canvasContainer.style.overflow = "auto";
      canvasContainer.style.maxHeight = "60vh";
      canvasContainer.style.border = "1px solid var(--background-modifier-border)";
      canvasContainer.style.borderRadius = "4px";
      canvasContainer.style.padding = "10px";
      canvasContainer.style.backgroundColor = "var(--background-primary)";

      const canvas = canvasContainer.createEl("canvas") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;
      
      // Save original dimensions
      const origWidth = img.width;
      const origHeight = img.height;
      
      // Canvas size based on zoom level
      const setCanvasSize = () => {
          canvas.width = origWidth * this.zoomLevel;
          canvas.height = origHeight * this.zoomLevel;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      
      // Initial canvas setup
      setCanvasSize();

      const info = this.contentEl.createEl("div");
      let crop: CropData = { x: 0, y: 0, width: 100, height: 100, scale: 1 };
      let drawing = false;
      let startX = 0, startY = 0;
      let isPanning = false;
      let startPanX = 0, startPanY = 0;
      let startScrollLeft = 0, startScrollTop = 0;

      // Function to convert canvas coordinates to original image coordinates
      const toOriginalCoords = (x: number, y: number) => {
          return {
              x: (x / canvas.width) * origWidth,
              y: (y / canvas.height) * origHeight
          };
      };

      canvas.onmousedown = (e: MouseEvent) => { 
          const rect = canvas.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          
          // Right button (2) or middle button (1) for panning
          if (e.button === 2 || e.button === 1) {
              e.preventDefault();
              isPanning = true;
              startPanX = e.clientX;
              startPanY = e.clientY;
              startScrollLeft = canvasContainer.scrollLeft;
              startScrollTop = canvasContainer.scrollTop;
              canvas.style.cursor = 'grabbing';
              return;
          }
          
          // Left button: start selection
          const origCoords = toOriginalCoords(x, y);
          
          startX = origCoords.x;
          startY = origCoords.y;
          drawing = true;
      };
      
      canvas.onmousemove = (e: MouseEvent) => {
          if (isPanning) {
              const dx = e.clientX - startPanX;
              const dy = e.clientY - startPanY;
              canvasContainer.scrollLeft = startScrollLeft - dx;
              canvasContainer.scrollTop = startScrollTop - dy;
              return;
          }
          
          if (!drawing) return;
          
          const rect = canvas.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const origCoords = toOriginalCoords(x, y);
          
          crop.x = Math.min(startX, origCoords.x);
          crop.y = Math.min(startY, origCoords.y);
          crop.width = Math.abs(origCoords.x - startX);
          crop.height = Math.abs(origCoords.y - startY);
          
          // Clear the canvas and redraw the image
          setCanvasSize();
          
          // Draw the selection rectangle
          ctx.strokeStyle = "red";
          ctx.lineWidth = 2;
          ctx.strokeRect(
              (crop.x / origWidth) * canvas.width, 
              (crop.y / origHeight) * canvas.height, 
              (crop.width / origWidth) * canvas.width, 
              (crop.height / origHeight) * canvas.height
          );
          
          // Round the coordinates and dimensions for display
          const roundedX = Math.round(crop.x);
          const roundedY = Math.round(crop.y);
          const roundedWidth = Math.round(crop.width);
          const roundedHeight = Math.round(crop.height);
          
          info.setText(
              `x:${roundedX} y:${roundedY} ` +
              `w:${roundedWidth} h:${roundedHeight} ` +
              `zoom:${this.zoomLevel.toFixed(1)}x`
          );
      };
      
      canvas.onmouseup = (e: MouseEvent) => { 
          drawing = false; 
          if (isPanning) {
              isPanning = false;
              canvas.style.cursor = '';
          }
      };
      
      canvas.onmouseleave = (e: MouseEvent) => { 
          drawing = false; 
          if (isPanning) {
              isPanning = false;
              canvas.style.cursor = '';
          }
      };
      
      // Block context menu
      canvas.oncontextmenu = (e) => {
          e.preventDefault();
      };

      // Zoom controls
      const zoomContainer = this.contentEl.createDiv({
          cls: "image-crop-zoom-controls"
      }) as HTMLDivElement;
      zoomContainer.style.margin = "15px 0";
      zoomContainer.style.display = "flex";
      zoomContainer.style.alignItems = "center";
      zoomContainer.style.gap = "10px";
      
      zoomContainer.createEl("label", { text: "Zoom:" });
      
      const zoomSlider = zoomContainer.createEl("input") as HTMLInputElement;
      zoomSlider.type = "range";
      zoomSlider.min = "0.1";
      zoomSlider.max = "2.0";
      zoomSlider.step = "0.1";
      zoomSlider.value = "1.0";
      zoomSlider.style.flex = "1";
      
      const zoomValue = zoomContainer.createEl("span", { 
          text: "1.0x" 
      }) as HTMLSpanElement;
      zoomValue.style.minWidth = "50px";
      zoomValue.style.textAlign = "right";

      // Zoom update function
      const updateZoom = (newZoom: number) => {
          this.zoomLevel = newZoom;
          zoomSlider.value = newZoom.toString();
          zoomValue.textContent = `${newZoom.toFixed(1)}x`;
          setCanvasSize();
          
          // Redraw the selection rectangle if it exists
          if (crop.width > 0 && crop.height > 0) {
              ctx.strokeStyle = "red";
              ctx.lineWidth = 2;
              ctx.strokeRect(
                  (crop.x / origWidth) * canvas.width, 
                  (crop.y / origHeight) * canvas.height, 
                  (crop.width / origWidth) * canvas.width, 
                  (crop.height / origHeight) * canvas.height
              );
          }
      };
      
      zoomSlider.addEventListener("input", (e) => {
          const value = parseFloat((e.target as HTMLInputElement).value);
          updateZoom(value);
      });

      // Scale input for output image
      const scaleContainer = this.contentEl.createDiv({ 
          cls: "image-crop-scale" 
      }) as HTMLDivElement;
      scaleContainer.style.margin = "15px 0";
      scaleContainer.style.display = "flex";
      scaleContainer.style.alignItems = "center";
      scaleContainer.style.gap = "10px";
      
      scaleContainer.createEl("label", { text: "Output Scale:" });
      this.scaleInput = scaleContainer.createEl("input") as HTMLInputElement;
      this.scaleInput.type = "number";
      this.scaleInput.value = "1";
      this.scaleInput.min = "0.1";
      this.scaleInput.step = "0.1";
      this.scaleInput.style.width = "80px";

      // Accept and Cancel buttons
      const buttonContainer = this.contentEl.createDiv({ 
          cls: "image-crop-buttons" 
      }) as HTMLDivElement;
      buttonContainer.style.display = "flex";
      buttonContainer.style.gap = "10px";
      buttonContainer.style.justifyContent = "flex-end";

      const acceptBtn = buttonContainer.createEl("button", { 
          text: "Accept" 
      }) as HTMLButtonElement;
      
      const cancelBtn = buttonContainer.createEl("button", { 
          text: "Cancel" 
      }) as HTMLButtonElement;

      acceptBtn.onclick = () => {
          // Round the coordinates and dimensions for the output link
          const roundedX = Math.round(crop.x);
          const roundedY = Math.round(crop.y);
          const roundedWidth = Math.round(crop.width);
          const roundedHeight = Math.round(crop.height);
          
          const scale = parseFloat(this.scaleInput.value) || 1;
          const scaleParam = scale !== 1 ? `_Scale${scale}` : "";
          
          // Create the alias for the cropped image with rounded dimensions
          const alias = `${roundedHeight}x${roundedWidth}_Shift${roundedY}x${roundedX}${scaleParam}`;
          const newLink = `![[${imgFile.name}|${alias}]]`;

          // Insert the new link at the end of the current markdown file
          const editor = this.view.editor;
          const end = editor.lastLine();
          editor.replaceRange("\n" + newLink + "\n", { line: end, ch: 0 });

          // Call render function to update the view
          if ((this.plugin as any).processImageCrop) {
              (this.plugin as any).processImageCrop();
          }

          this.close();
      };

      cancelBtn.onclick = () => this.close();
  }
}