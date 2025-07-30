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
      const ext = f.extension ? f.extension.toLowerCase() : "";
      return ["png", "jpg", "jpeg", "webp", "gif", "bmp", "tiff", "svg"].includes(ext);
    });

    // Функция рендеринга списка
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
          // Сброс предыдущего выбора
          const items = listContainer.querySelectorAll(".image-crop-item") as NodeListOf<HTMLDivElement>;
          items.forEach(el => {
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
      text: "Cancel"
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

      // Контейнер для холста
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
      
      // Сохраняем оригинальные размеры
      const origWidth = img.width;
      const origHeight = img.height;
      
      // Функция для установки размера холста
      const setCanvasSize = () => {
          canvas.width = origWidth * this.zoomLevel;
          canvas.height = origHeight * this.zoomLevel;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      
      // Первоначальная отрисовка
      setCanvasSize();

      const info = this.contentEl.createEl("div");
      let crop: CropData = { x: 0, y: 0, width: 100, height: 100, scale: 1 };
      let drawing = false;
      let startX = 0, startY = 0;

      // Функция для преобразования координат мыши в координаты оригинала
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
          const origCoords = toOriginalCoords(x, y);
          
          startX = origCoords.x;
          startY = origCoords.y;
          drawing = true;
      };
      
      canvas.onmousemove = (e: MouseEvent) => {
          if (!drawing) return;
          
          const rect = canvas.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const origCoords = toOriginalCoords(x, y);
          
          crop.x = Math.min(startX, origCoords.x);
          crop.y = Math.min(startY, origCoords.y);
          crop.width = Math.abs(origCoords.x - startX);
          crop.height = Math.abs(origCoords.y - startY);
          
          // Перерисовываем изображение
          setCanvasSize();
          
          // Рисуем прямоугольник выделения
          ctx.strokeStyle = "red";
          ctx.lineWidth = 2;
          ctx.strokeRect(
              (crop.x / origWidth) * canvas.width, 
              (crop.y / origHeight) * canvas.height, 
              (crop.width / origWidth) * canvas.width, 
              (crop.height / origHeight) * canvas.height
          );
          
          // Округляем значения для отображения
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
      
      canvas.onmouseup = () => { 
          drawing = false; 
      };
      
      canvas.onmouseleave = () => { 
          drawing = false; 
      };

      // Контролы масштабирования
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

      // Обработчики масштабирования
      const updateZoom = (newZoom: number) => {
          this.zoomLevel = newZoom;
          zoomSlider.value = newZoom.toString();
          zoomValue.textContent = `${newZoom.toFixed(1)}x`;
          setCanvasSize();
          
          // Перерисовываем выделение, если оно есть
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

      // Scale input для итогового масштаба
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

      // Кнопки Accept/Cancel
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
          // Округляем координаты и размеры до целых чисел
          const roundedX = Math.round(crop.x);
          const roundedY = Math.round(crop.y);
          const roundedWidth = Math.round(crop.width);
          const roundedHeight = Math.round(crop.height);
          
          const scale = parseFloat(this.scaleInput.value) || 1;
          const scaleParam = scale !== 1 ? `_Scale${scale}` : "";
          
          // Используем округленные значения
          const alias = `${roundedHeight}x${roundedWidth}_Shift${roundedY}x${roundedX}${scaleParam}`;
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