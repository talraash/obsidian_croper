import { Plugin, MarkdownView, Notice, TFile } from "obsidian";
import { CropModal } from "./CropModal";
import { registerImageCropRenderer } from "./ImageCropRenderer";

export default class ImageCropPlugin extends Plugin {
  async onload() {
    this.addRibbonIcon("crop", "Crop image", () => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view) {
        new Notice("No active markdown view");
        return;
      }
      new CropModal(
        this,
        this.app,
        view.file as TFile,
        view,
        this.app.vault
      ).open();
    });

    registerImageCropRenderer(this);
  }
}