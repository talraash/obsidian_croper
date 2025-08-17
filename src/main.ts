import { Plugin, MarkdownView, Notice, TFile } from "obsidian";
import { CropModal } from "./CropModal";
import { registerImageCropRenderer } from "./ImageCropRenderer";
import { ImageCropPluginSettings, DEFAULT_SETTINGS, ImageCropSettingTab } from "./ImageCropPluginSettings";
import { ImageCropPluginInterface } from "./types";

export default class ImageCropPlugin extends Plugin implements ImageCropPluginInterface {
  settings!: ImageCropPluginSettings;
  processImageCrop?: () => void;

  async onload() {
    await this.loadSettings();
    
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
    this.addSettingTab(new ImageCropSettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}