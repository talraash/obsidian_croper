import { Plugin, MarkdownView, TFile, Notice } from "obsidian";
import { CropModal } from "./CropModal";
import { registerImageCropRenderer } from "./ImageCropRenderer";

export default class ImageCropPlugin extends Plugin {
  async onload() {
    this.addRibbonIcon("crop", "Crop image", async () => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view) {
        new Notice("No active markdown view");
        return;
      }
      const file = view.file;
      const content = await this.app.vault.read(file);

      const imageLinks = [...content.matchAll(/!\[\[(.+?)\]\]/g)]
        .map(match => match[1])
        .filter(link => /\.(png|jpg|jpeg|webp)$/i.test(link.split("|")[0]));

      if (imageLinks.length === 0) {
        new Notice("No images found in note");
        return;
      }

      new CropModal(this.app, imageLinks, file, view, this.app.vault).open();
    });

    // Подключаем обработчик кропа в preview
    registerImageCropRenderer(this);
  }

  onunload() {
    // Удаление слушателей, если будет нужно
  }
}

