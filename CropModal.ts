import {
  App,
  Modal,
  TFile,
  Vault,
  MarkdownView,
  Editor,
Notice
} from "obsidian";

interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class CropModal extends Modal {
  constructor(
    app: App,
    private imageLinks: string[],
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

    const select = contentEl.createEl("select");
    this.imageLinks.forEach(link => {
      const option = document.createElement("option");
      option.value = link;
      option.text = link;
      select.appendChild(option);
    });

    const confirmBtn = contentEl.createEl("button", { text: "Crop selected" });
    confirmBtn.onclick = async () => {
      const selected = select.value.split("|")[0];
      const imgFile = this.app.metadataCache.getFirstLinkpathDest(selected, this.file.path);
      if (!imgFile) {
        new Notice("Image file not found");
        return;
      }
      this.openCropInterface(imgFile, selected);
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

    const canvas = this.contentEl.createEl("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    let crop: CropData = { x: 0, y: 0, width: 100, height: 100 };
    let isDrawing = false;
    let startX = 0, startY = 0;

    canvas.onmousedown = (e) => {
      startX = e.offsetX;
      startY = e.offsetY;
      isDrawing = true;
    };
    canvas.onmousemove = (e) => {
      if (!isDrawing) return;
      const x = e.offsetX;
      const y = e.offsetY;
      crop = {
        x: Math.min(startX, x),
        y: Math.min(startY, y),
        width: Math.abs(x - startX),
        height: Math.abs(y - startY)
      };
      ctx.drawImage(img, 0, 0);
      ctx.strokeStyle = "red";
      ctx.lineWidth = 2;
      ctx.strokeRect(crop.x, crop.y, crop.width, crop.height);
    };
    canvas.onmouseup = () => {
      isDrawing = false;
    };

    const acceptBtn = this.contentEl.createEl("button", { text: "Accept" });
    acceptBtn.onclick = () => {
      const linkRegex = new RegExp(`!\\[\\[${rawLink}(\\|.*?)?\\]\]`, "g");
      const newLink = `![[${rawLink}|${crop.height}x${crop.width}_Shift${crop.y}x${crop.x}]]`;

      const editor = this.view.editor;
      const fullText = editor.getValue();
      const replaced = fullText.replace(linkRegex, newLink);
      editor.setValue(replaced);
      (this.app as any).plugins.getPlugin('obsidian-image-crop').processImageCrop();
      this.close();
    };

    const cancelBtn = this.contentEl.createEl("button", { text: "Cancel" });
    cancelBtn.onclick = () => this.close();
  }
}
