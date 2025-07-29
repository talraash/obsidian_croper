import { Plugin, MarkdownView, Notice, TFile } from "obsidian";
import { CropModal } from "./CropModal";
import { registerImageCropRenderer } from "./ImageCropRenderer";

export default class ImageCropPlugin extends Plugin {
  async onload() {
    // Добавляем кнопку "Crop"
    this.addRibbonIcon("crop", "Crop image", async () => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view) {
        new Notice("No active markdown view");
        return;
      }
      const file = view.file as TFile;
      const content = await this.app.vault.read(file);

      // Извлечение всех изображений из текущей заметки
      const matches = [...content.matchAll(/!\[\[(.+?\.(png|jpg|jpeg|webp))(?:\|.*?)?\]\]/gi)];
      const imageLinks = Array.from(new Set(matches.map(m => m[1])));

      if (imageLinks.length === 0) {
        new Notice("No images found in current note");
        return;
      }

      // Открываем модал кадрирования, передаём плагин как первый аргумент
      new CropModal(this, this.app, file, view, this.app.vault).open();
    });

    // Регистрируем кастомный рендерер
    registerImageCropRenderer(this);
  }

  onunload() {
    // Очистка при выгрузке плагина при необходимости
  }
}
