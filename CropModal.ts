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

    const noteText = await this.app.vault.read(this.file);
    const matches = [...noteText.matchAll(/!\[\[(.+?\.(png|jpg|jpeg|webp))(?:\|.*?)?\]\]/gi)];
    const imageLinks = Array.from(new Set(matches.map(m => m[1])));

    if (!imageLinks.length) {
      new Notice("No images in current note");
      this.close();
      return;
    }

    const select = contentEl.createEl("select");
    imageLinks.forEach(link => select.createEl("option", { text: link, value: link }));

    const nextBtn = contentEl.createEl("button", { text: "Next" });
    nextBtn.onclick = () => {
      const target = select.value;
      const imgFile = this.app.metadataCache.getFirstLinkpathDest(target, this.file.path);
      if (!imgFile) {
        new Notice("Image file not found");
        return;
      }
      this.openCropInterface(imgFile, target);
    };
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

    const canvas = this.contentEl.createEl("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const info = this.contentEl.createEl("div");
    let crop: CropData = { x: 0, y: 0, width: 100, height: 100, scale: 1 };
    let drawing = false;
    let startX = 0, startY = 0;

    canvas.onmousedown = e => { startX = e.offsetX; startY = e.offsetY; drawing = true; };
    canvas.onmousemove = e => {
      if (!drawing) return;
      const x = e.offsetX, y = e.offsetY;
      crop.x = Math.min(startX, x);
      crop.y = Math.min(startY, y);
      crop.width = Math.abs(x - startX);
      crop.height = Math.abs(y - startY);
      ctx.drawImage(img, 0, 0);
      ctx.strokeStyle = "red";
      ctx.lineWidth = 2;
      ctx.strokeRect(crop.x, crop.y, crop.width, crop.height);
      info.setText(`x:${crop.x} y:${crop.y} w:${crop.width} h:${crop.height}`);
    };
    canvas.onmouseup = () => { drawing = false; };

    // Scale input
    this.contentEl.createEl("label", { text: "Scale:" });
    this.scaleInput = this.contentEl.createEl("input");
    this.scaleInput.type = "number";
    this.scaleInput.value = "1";
    this.scaleInput.min = "0.1";
    this.scaleInput.step = "0.1";
    this.scaleInput.style.margin = "0 10px";

    const acceptBtn = this.contentEl.createEl("button", { text: "Accept" });
    acceptBtn.onclick = () => {
      const scale = parseFloat(this.scaleInput.value) || 1;
      const scaleParam = scale !== 1 ? `_Scale${scale}` : "";
      const alias = `${crop.height}x${crop.width}_Shift${crop.y}x${crop.x}${scaleParam}`;
      const pattern = new RegExp(`!\\[\\[${rawLink}(\\|.*?)?\\]\\]`, 'g');
      const newLink = `![[${rawLink}|${alias}]]`;

      const ed = this.view.editor;
      ed.setValue(ed.getValue().replace(pattern, newLink));

      // Re-render embed
      (this.plugin as any).processImageCrop();

      this.close();
    };

    const cancelBtn = this.contentEl.createEl("button", { text: "Cancel" });
    cancelBtn.onclick = () => this.close();
  }
}