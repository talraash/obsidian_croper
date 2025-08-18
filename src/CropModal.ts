import { App, Modal, TFile, Notice, Vault, MarkdownView, Plugin } from "obsidian";
import { ImageCropPluginInterface } from "./types";

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
    private plugin: ImageCropPluginInterface,
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

    // Search input with CSS class
    const searchInput = contentEl.createEl("input", {
      type: "text",
      placeholder: "Search images...",
      cls: "image-crop-search"
    }) as HTMLInputElement;
    
    // Main container with CSS class
    const container = contentEl.createDiv({ cls: "image-crop-container" });
    const listContainer = container.createDiv({ cls: "image-crop-list" });
    const previewContainer = container.createDiv({ cls: "image-crop-preview" });

    previewContainer.createEl("h3", { text: "Preview" });
    const imgPreview = previewContainer.createEl("img", {
      attr: { id: "image-crop-preview-img" },
      cls: "image-crop-preview-img"
    }) as HTMLImageElement;

    // Getting all image files in the vault
    const imageFiles = this.app.vault.getFiles().filter(f => {
      const ext = f.extension ? f.extension.toLowerCase() : "";
      return ["png", "jpg", "jpeg", "webp", "gif", "bmp", "tiff", "svg"].includes(ext);
    });

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
        
        item.onclick = async () => {
          listContainer.querySelectorAll(".image-crop-item").forEach(el => {
            (el as HTMLDivElement).style.backgroundColor = "";
          });
          item.style.backgroundColor = "var(--background-modifier-hover)";

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

    renderList();

    // Search
    searchInput.addEventListener("input", (e) => {
      renderList((e.target as HTMLInputElement).value);
    });

    // Buttion container with CSS class
    const buttonContainer = contentEl.createDiv({ cls: "image-crop-buttons" });
    const nextBtn = buttonContainer.createEl("button", { text: "Next" });
    const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
    (nextBtn as HTMLButtonElement).disabled = true;

    imgPreview.addEventListener("load", () => {
      (nextBtn as HTMLButtonElement).disabled = false;
    });

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

    // Canvas container with CSS class
    const canvasContainer = this.contentEl.createDiv({
        cls: "image-crop-canvas-container"
    }) as HTMLDivElement;
    
    const canvas = canvasContainer.createEl("canvas") as HTMLCanvasElement;
    const ctx = canvas.getContext("2d")!;
    
    const origWidth = img.width;
    const origHeight = img.height;
    
    const setCanvasSize = () => {
        canvas.width = origWidth * this.zoomLevel;
        canvas.height = origHeight * this.zoomLevel;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    
    setCanvasSize();

    const info = this.contentEl.createEl("div");
    let crop: CropData = { x: 0, y: 0, width: 100, height: 100, scale: 1 };
    let drawing = false;
    let startX = 0, startY = 0;
    let isPanning = false;
    let startPanX = 0, startPanY = 0;
    let startScrollLeft = 0, startScrollTop = 0;

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
        
        if (e.button === 2 || e.button === 1) {
            e.preventDefault();
            isPanning = true;
            startPanX = e.clientX;
            startPanY = e.clientY;
            startScrollLeft = canvasContainer.scrollLeft;
            startScrollTop = canvasContainer.scrollTop;
            return;
        }
        
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
        
        setCanvasSize();
        
        ctx.strokeStyle = "red";
        ctx.lineWidth = 2;
        ctx.strokeRect(
            (crop.x / origWidth) * canvas.width, 
            (crop.y / origHeight) * canvas.height, 
            (crop.width / origWidth) * canvas.width, 
            (crop.height / origHeight) * canvas.height
        );
        
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
    
    canvas.oncontextmenu = (e) => e.preventDefault();

    // Zoom controls
    const zoomContainer = this.contentEl.createDiv({ cls: "image-crop-zoom-controls" });
    zoomContainer.createEl("label", { text: "Zoom:" });
    
    const zoomSlider = zoomContainer.createEl("input") as HTMLInputElement;
    zoomSlider.type = "range";
    zoomSlider.min = "0.1";
    zoomSlider.max = "2.0";
    zoomSlider.step = "0.1";
    zoomSlider.value = "1.0";
    
    const zoomValue = zoomContainer.createEl("span", { text: "1.0x" });
    
    const updateZoom = (newZoom: number) => {
        this.zoomLevel = newZoom;
        zoomSlider.value = newZoom.toString();
        zoomValue.textContent = `${newZoom.toFixed(1)}x`;
        setCanvasSize();
        
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
        updateZoom(parseFloat((e.target as HTMLInputElement).value));
    });

    // Scale input
    const scaleContainer = this.contentEl.createDiv({ cls: "image-crop-scale" });
    scaleContainer.createEl("label", { text: "Output Scale:" });
    this.scaleInput = scaleContainer.createEl("input", { 
        cls: "image-crop-scale-input"
    }) as HTMLInputElement;
    this.scaleInput.type = "number";
    this.scaleInput.value = "1";
    this.scaleInput.min = "0.1";
    this.scaleInput.step = "0.1";

    const buttonContainer = this.contentEl.createDiv({ cls: "image-crop-buttons image-crop-buttons-end" });
    const acceptBtn = buttonContainer.createEl("button", { text: "Accept" });
    const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });

    acceptBtn.onclick = () => {
        const roundedX = Math.round(crop.x);
        const roundedY = Math.round(crop.y);
        const roundedWidth = Math.round(crop.width);
        const roundedHeight = Math.round(crop.height);
        
        const scale = parseFloat(this.scaleInput.value) || 1;
        const scaleParam = scale !== 1 ? `_Scale${scale}` : "";
        
        const alias = `${roundedHeight}x${roundedWidth}_Shift${roundedY}x${roundedX}${scaleParam}`;
        const newLink = `![[${imgFile.name}|${alias}]]`;

        const editor = this.view.editor;
        const end = editor.lastLine();
        editor.replaceRange("\n" + newLink + "\n", { line: end, ch: 0 });

        if ((this.plugin as any).processImageCrop) {
            (this.plugin as any).processImageCrop();
        }

        this.close();
    };

    cancelBtn.onclick = () => this.close();
  }
}
