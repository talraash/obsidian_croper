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

    // Поисковая строка
    const searchInput = contentEl.createEl("input", {
      type: "text",
      placeholder: "Search images...",
      cls: "image-crop-search"
    }) as HTMLInputElement;
    searchInput.style.width = "100%";
    searchInput.style.marginBottom = "10px";

    // Контейнер для основного контента
    const container = contentEl.createDiv({ cls: "image-crop-container" }) as HTMLDivElement;
    container.style.display = "flex";
    container.style.gap = "20px";

    // Список изображений
    const listContainer = container.createDiv({ cls: "image-crop-list" }) as HTMLDivElement;
    listContainer.style.flex = "1";
    listContainer.style.maxHeight = "400px";
    listContainer.style.overflowY = "auto";

    // Область предпросмотра
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

    // Получение всех изображений хранилища
    const imageFiles = this.app.vault.getFiles().filter(f => {
      const ext = f.extension.toLowerCase();
      return ["png", "jpg", "jpeg", "webp", "gif", "bmp", "tiff", "svg"].includes(ext);
    });

    // Функция рендеринга списка
    const renderList = (filter: string = "") => {
      listContainer.empty();
      const filtered = imageFiles.filter(file => 
        file.name.toLowerCase().includes(filter.toLowerCase()) ||
        file.path.toLowerCase().includes(filter.toLowerCase())
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
          // Сброс предыдущего выбора
          document.querySelectorAll<HTMLDivElement>(".image-crop-item").forEach(el => {
            el.style.backgroundColor = "";
          });
          item.style.backgroundColor = "var(--background-modifier-hover)";

          // Загрузка превью
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

    // Инициализация списка
    renderList();

    // Обработка поиска
    searchInput.addEventListener("input", (e) => {
      const value = (e.target as HTMLInputElement).value;
      renderList(value);
    });

    // Кнопки управления
    const buttonContainer = contentEl.createDiv({ cls: "image-crop-buttons" }) as HTMLDivElement;
    buttonContainer.style.marginTop = "15px";
    buttonContainer.style.display = "flex";
    buttonContainer.style.gap = "10px";

    const nextBtn = buttonContainer.createEl("button", { text: "Next" }) as HTMLButtonElement;
    nextBtn.disabled = true;
    
    const cancelBtn = buttonContainer.createEl("button", { 
      text: "Cancel",
      cls: "image-crop-cancel"
    }) as HTMLButtonElement;

    // Обновление состояния кнопки Next
    imgPreview.addEventListener("load", () => {
      nextBtn.disabled = false;
    });

    // Обработчики кнопок
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

    const canvas = this.contentEl.createEl("canvas") as HTMLCanvasElement;
    const ctx = canvas.getContext("2d")!;
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const info = this.contentEl.createEl("div");
    let crop: CropData = { x: 0, y: 0, width: 100, height: 100, scale: 1 };
    let drawing = false;
    let startX = 0, startY = 0;

    canvas.onmousedown = (e: MouseEvent) => { 
      startX = e.offsetX; 
      startY = e.offsetY; 
      drawing = true; 
    };
    
    canvas.onmousemove = (e: MouseEvent) => {
      if (!drawing) return;
      const x = e.offsetX, y = e.offsetY;
      crop.x = Math.min(startX, x);
      crop.y = Math.min(startY, y);
      crop.width = Math.abs(x - startX);
      crop.height = Math.abs(y - startY);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      ctx.strokeStyle = "red";
      ctx.lineWidth = 2;
      ctx.strokeRect(crop.x, crop.y, crop.width, crop.height);
      info.setText(`x:${crop.x} y:${crop.y} w:${crop.width} h:${crop.height}`);
    };
    
    canvas.onmouseup = () => { drawing = false; };

    // Scale input
    const scaleContainer = this.contentEl.createDiv({ cls: "image-crop-scale" }) as HTMLDivElement;
    scaleContainer.style.margin = "15px 0";
    scaleContainer.style.display = "flex";
    scaleContainer.style.alignItems = "center";
    
    scaleContainer.createEl("label", { text: "Scale:" });
    this.scaleInput = scaleContainer.createEl("input") as HTMLInputElement;
    this.scaleInput.type = "number";
    this.scaleInput.value = "1";
    this.scaleInput.min = "0.1";
    this.scaleInput.step = "0.1";
    this.scaleInput.style.margin = "0 10px";

    // Кнопки Accept/Cancel
    const buttonContainer = this.contentEl.createDiv({ cls: "image-crop-buttons" }) as HTMLDivElement;
    buttonContainer.style.display = "flex";
    buttonContainer.style.gap = "10px";

    const acceptBtn = buttonContainer.createEl("button", { text: "Accept" }) as HTMLButtonElement;
    const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" }) as HTMLButtonElement;

    acceptBtn.onclick = () => {
      const scale = parseFloat(this.scaleInput.value) || 1;
      const scaleParam = scale !== 1 ? `_Scale${scale}` : "";
      const alias = `${crop.height}x${crop.width}_Shift${crop.y}x${crop.x}${scaleParam}`;
      const newLink = `![[${imgFile.name}|${alias}]]`;

      // Вставка в конец документа
      const editor = this.view.editor;
      const end = editor.lastLine();
      editor.replaceRange("\n" + newLink + "\n", { line: end, ch: 0 });

      // Вызов функции рендеринга
      if ((this.plugin as any).processImageCrop) {
        (this.plugin as any).processImageCrop();
      }

      this.close();
    };

    cancelBtn.onclick = () => this.close();
  }
}